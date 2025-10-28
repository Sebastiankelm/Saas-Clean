import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import type { Team, TeamBillingSummary } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription,
} from '@/lib/db/queries';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { baseUrl, env } from '@/config/env';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

const supabase = getSupabaseAdminClient();

type TeamWithBilling = Team & {
  billingSummary?: TeamBillingSummary | null;
};

export async function createCheckoutSession({
  team,
  priceId,
}: {
  team: TeamWithBilling | null;
  priceId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${baseUrl}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
    customer: team.billingSummary?.stripe_customer_id || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,
    },
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: TeamWithBilling) {
  if (!team.billingSummary?.stripe_customer_id) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    if (!team.billingSummary?.stripe_product_id) {
      throw new Error("Team's product is not available in billing summary");
    }

    const product = await stripe.products.retrieve(
      team.billingSummary.stripe_product_id
    );
    if (!product.active) {
      throw new Error("Team's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the team's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription',
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id),
            },
          ],
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other',
            ],
          },
        },
        payment_method_update: {
          enabled: true,
        },
      },
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: team.billingSummary!.stripe_customer_id!,
    return_url: `${baseUrl}/dashboard`,
    configuration: configuration.id,
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  const customerEmail =
    typeof subscription.customer_email === 'string'
      ? subscription.customer_email
      : null;

  const { error: customerError } = await supabase
    .from('billing_customers')
    .upsert(
      {
        team_id: team.id,
        stripe_customer_id: customerId,
        email: customerEmail,
      },
      { onConflict: 'stripe_customer_id' }
    );

  if (customerError) {
    console.error('Failed to upsert billing customer', customerError);
  }

  const price = subscription.items.data[0]?.price;
  const product = price?.product as Stripe.Product | string | undefined;
  const productId = typeof product === 'string' ? product : product?.id ?? null;
  const planName = typeof product === 'string' ? null : product?.name ?? null;
  const priceId = price?.id ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await updateTeamSubscription(team.id, {
    stripeSubscriptionId: subscriptionId,
    stripeProductId: productId,
    stripePriceId: priceId,
    planName,
    subscriptionStatus: status,
    currentPeriodEnd,
  });
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring',
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days,
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id,
  }));
}

export async function getTeamInvoices(stripeCustomerId: string) {
  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit: 100,
  });

  return invoices.data.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    billingReason: invoice.billing_reason,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
    periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
    createdAt: new Date(invoice.created * 1000),
  }));
}

export async function upsertInvoice(invoice: Stripe.Invoice, teamId: number) {
  const { error } = await supabase.from('invoices').upsert(
    {
      team_id: teamId,
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      billing_reason: invoice.billing_reason ?? null,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    },
    { onConflict: 'stripe_invoice_id' }
  );

  if (error) {
    console.error('Failed to upsert invoice', error);
    throw error;
  }
}