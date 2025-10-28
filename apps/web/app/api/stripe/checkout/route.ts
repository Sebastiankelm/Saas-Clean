import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/payments/stripe';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { auth } from '@/lib/auth/better';
import { updateTeamSubscription } from '@/lib/db/queries';

const supabase = getSupabaseAdminClient();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (!session.customer || typeof session.customer === 'string') {
      throw new Error('Invalid customer data from Stripe.');
    }

    const customerId = session.customer.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      throw new Error('No subscription found for this session.');
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });

    const price = subscription.items.data[0]?.price;

    if (!price) {
      throw new Error('No plan found for this subscription.');
    }

    const product = price.product as Stripe.Product;
    const productId = product.id;

    const userId = session.client_reference_id;
    if (!userId) {
      throw new Error("No user ID found in session's client_reference_id.");
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', Number(userId))
      .maybeSingle();

    if (userError || !user) {
      throw new Error('User not found in database.');
    }

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error('User is not associated with any team.');
    }

    await supabase
      .from('billing_customers')
      .upsert(
        {
          team_id: membership.team_id,
          stripe_customer_id: customerId,
          email: user.email,
        },
        { onConflict: 'stripe_customer_id' }
      );

    await updateTeamSubscription(membership.team_id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: productId,
      stripePriceId: price.id,
      planName: product.name,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    const sessionResult = (await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    })) as unknown as { headers?: Headers };

    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    const setCookieHeader = sessionResult?.headers?.get('set-cookie');
    if (setCookieHeader) {
      response.headers.set('set-cookie', setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
