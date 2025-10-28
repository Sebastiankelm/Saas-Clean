import { stripe } from '../payments/stripe';
import { getSupabaseAdminClient } from './client';
import { hashPassword } from '@/lib/auth/session';

const supabase = getSupabaseAdminClient();

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800,
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200,
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      role: 'owner',
    })
    .select('id')
    .single();

  if (userError || !user) {
    throw userError ?? new Error('Failed to create initial user');
  }

  console.log('Initial user created.');

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: 'Test Team',
    })
    .select('id')
    .single();

  if (teamError || !team) {
    throw teamError ?? new Error('Failed to create initial team');
  }

  const { error: membershipError } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      user_id: user.id,
      role: 'owner',
    });

  if (membershipError) {
    throw membershipError;
  }

  await supabase.rpc('refresh_team_views');

  await createStripeProducts();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
