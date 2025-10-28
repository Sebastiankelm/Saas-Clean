import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import { handleSubscriptionChange, stripe, upsertInvoice } from '@/lib/payments/stripe';
import { getTeamByStripeCustomerId } from '@/lib/db/queries';

const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.upcoming':
    case 'invoice.created':
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      
      if (customerId) {
        const team = await getTeamByStripeCustomerId(customerId);
        if (team) {
          await upsertInvoice(invoice, team.id);
        } else {
          console.error('Team not found for invoice customer:', customerId);
        }
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
