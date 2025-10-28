import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';
import { getSupabaseAdminClient } from './client';
import type {
  ActivityLog,
  Team,
  TeamBillingSummary,
  TeamDataWithMembers,
  TeamMember,
  TeamMemberWithUser,
  User,
} from './schema';

const supabase = getSupabaseAdminClient();

type SessionData = {
  user: { id: number };
  expires: string;
};

async function getSessionUserId(): Promise<number | null> {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const sessionData = (await verifyToken(sessionCookie.value)) as SessionData;
    if (!sessionData?.user?.id) {
      return null;
    }
    if (new Date(sessionData.expires) < new Date()) {
      return null;
    }
    return sessionData.user.id;
  } catch (error) {
    console.error('Failed to verify session token', error);
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user', error);
    return null;
  }

  return data;
}

export async function getTeamByStripeCustomerId(
  customerId: string
): Promise<(Team & { billingSummary: TeamBillingSummary | null }) | null> {
  const { data: summary, error: summaryError } = await supabase
    .from('team_billing_mv')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (summaryError) {
    console.error('Failed to fetch team billing summary', summaryError);
    return null;
  }

  if (!summary) {
    return null;
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', summary.team_id)
    .maybeSingle();

  if (teamError) {
    console.error('Failed to fetch team', teamError);
    return null;
  }

  if (!team) {
    return null;
  }

  return {
    ...team,
    billingSummary: summary,
  };
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    stripePriceId: string | null;
    planName: string | null;
    subscriptionStatus: string;
    currentPeriodEnd: string | null;
  }
) {
  if (!subscriptionData.stripeSubscriptionId) {
    const { error: removeError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('team_id', teamId);

    if (removeError) {
      console.error('Failed to remove subscription', removeError);
      throw removeError;
    }

    await supabase.rpc('refresh_team_views');
    return;
  }

  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        team_id: teamId,
        stripe_subscription_id: subscriptionData.stripeSubscriptionId,
        stripe_product_id: subscriptionData.stripeProductId,
        stripe_price_id: subscriptionData.stripePriceId,
        status: subscriptionData.subscriptionStatus,
        plan_name: subscriptionData.planName,
        current_period_end: subscriptionData.currentPeriodEnd,
      },
      { onConflict: 'stripe_subscription_id' }
    );

  if (upsertError) {
    console.error('Failed to upsert subscription', upsertError);
    throw upsertError;
  }

  const { error: refreshError } = await supabase.rpc('refresh_team_views');
  if (refreshError) {
    console.error('Failed to refresh team views after subscription update', refreshError);
  }
}

export async function getUserWithTeam(userId: number) {
  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    console.error('Failed to fetch team membership', membershipError);
    return null;
  }

  if (!membership) {
    return null;
  }

  return membership;
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, action, occurred_at, ip_address, user_id, team_id')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ActivityLog[];
}

async function getTeamMembers(teamId: number): Promise<TeamMemberWithUser[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `id, role, joined_at, team_id, user_id, user:users!inner(
        id, name, email
      )`
    )
    .eq('team_id', teamId);

  if (error) {
    console.error('Failed to fetch team members', error);
    return [];
  }

  return (
    data?.map((member) => ({
      id: member.id,
      team_id: member.team_id,
      user_id: member.user_id,
      role: member.role as TeamMember['role'],
      joined_at: member.joined_at,
      user: member.user,
    })) ?? []
  );
}

export async function getTeamForUser(): Promise<TeamDataWithMembers | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('Failed to fetch membership for user', membershipError);
    return null;
  }

  if (!membership) {
    return null;
  }

  const teamId = membership.team_id;

  const [{ data: team, error: teamError }, members, { data: billingSummary, error: billingError }] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
    getTeamMembers(teamId),
    supabase.from('team_billing_mv').select('*').eq('team_id', teamId).maybeSingle(),
  ]);

  if (teamError) {
    console.error('Failed to fetch team data', teamError);
    return null;
  }

  if (billingError) {
    console.error('Failed to fetch billing summary', billingError);
  }

  if (!team) {
    return null;
  }

  return {
    ...team,
    teamMembers: members,
    billingSummary: billingSummary ?? null,
  };
}
