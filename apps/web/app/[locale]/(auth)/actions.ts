'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import {
  ActivityType,
  type NewActivityLog,
  type NewTeamMember,
  type Team,
  type TeamMember,
  type User,
  type Invitation,
} from '@/lib/db/schema';
import { comparePasswords, hashPassword } from '@/lib/auth/session';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { auth } from '@/lib/auth/better';
import { headers } from 'next/headers';
import { APIError } from 'better-auth';
import { defaultLocale, locales, type Locale } from '@/src/i18n/config';

const supabase = getSupabaseAdminClient();

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (!teamId) {
    return;
  }

  const newActivity = {
    team_id: teamId,
    user_id: userId,
    action: type,
    ip_address: ipAddress ?? null,
  } satisfies NewActivityLog;

  const { error } = await supabase.from('activity_logs').insert(newActivity);
  if (error) {
    console.error('Failed to log activity', error);
  }
}

async function refreshTeamViews() {
  const { error } = await supabase.rpc('refresh_team_views');
  if (error) {
    console.error('Failed to refresh materialized views', error);
  }
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
  locale: z.string().optional(),
});

function resolveLocale(value: string | null): Locale {
  if (value && locales.includes(value as Locale)) {
    return value as Locale;
  }

  return defaultLocale;
}

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;
  const headerList = await headers();
  const locale = resolveLocale(formData.get('locale') as string | null);

  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: headerList,
    });

    const { data: supabaseUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!supabaseUser) {
      return {
        error: 'Account is missing required data. Please contact support.',
        email,
        password,
      };
    }

    let team: Team | null = null;
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', supabaseUser.id)
      .maybeSingle();

    if (membership?.team_id) {
      const { data: teamRecord } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .maybeSingle();
      team = teamRecord ?? null;
    }

    const redirectTo = formData.get('redirect') as string | null;
    if (redirectTo === 'checkout') {
      const priceId = formData.get('priceId') as string;
      return createCheckoutSession({ team, priceId });
    }

    redirect(`/${locale}/dashboard`);
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error: 'Invalid email or password. Please try again.',
        email,
        password,
      };
    }

    console.error('Failed to sign in with Better Auth', error);
    return {
      error: 'Unable to sign in right now. Please try again later.',
      email,
      password,
    };
  }
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
  locale: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;
  const headerList = await headers();
  const locale = resolveLocale(formData.get('locale') as string | null);

  let invitation: Invitation | null = null;
  const numericInviteId = inviteId ? Number(inviteId) : null;

  if (inviteId) {
    if (Number.isNaN(numericInviteId)) {
      return { error: 'Invalid or expired invitation.', email, password };
    }

    const { data: invitationRecord } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', numericInviteId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (!invitationRecord) {
      return { error: 'Invalid or expired invitation.', email, password };
    }

    invitation = invitationRecord;
  }

  try {
    await auth.api.signUpEmail({
      body: { email, password, inviteId },
      headers: headerList,
    });
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error: 'Failed to create user. Please try again.',
        email,
        password,
      };
    }

    console.error('Failed to sign up with Better Auth', error);
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  const { data: createdUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!createdUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  let createdTeam: Team | null = null;

  if (invitation) {
    const { data: existingMemberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', createdUser.id);

    if (existingMemberships && existingMemberships.length > 0) {
      const ids = existingMemberships.map((membership) => membership.team_id);
      const { data: potentialTeams } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', ids);

      const defaultTeam = potentialTeams?.find(
        (teamRecord) => teamRecord?.name === `${email}'s Team`
      );

      if (defaultTeam) {
        await supabase
          .from('team_members')
          .delete()
          .eq('team_id', defaultTeam.id)
          .eq('user_id', createdUser.id);
        await supabase.from('teams').delete().eq('id', defaultTeam.id);
      }
    }

    await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    await supabase.from('team_members').insert({
      team_id: invitation.team_id,
      user_id: createdUser.id,
      role: invitation.role,
    } as NewTeamMember);

    const { data: invitedTeam } = await supabase
      .from('teams')
      .select('*')
      .eq('id', invitation.team_id)
      .maybeSingle();

    createdTeam = invitedTeam ?? null;

    await Promise.all([
      logActivity(invitation.team_id, createdUser.id, ActivityType.ACCEPT_INVITATION),
      logActivity(invitation.team_id, createdUser.id, ActivityType.SIGN_UP),
      refreshTeamViews(),
    ]);
  } else {
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', createdUser.id)
      .maybeSingle();

    if (membership?.team_id) {
      const { data: teamRecord } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .maybeSingle();
      createdTeam = teamRecord ?? null;
    }
  }

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: createdTeam, priceId });
  }

  redirect(`/${locale}/dashboard`);
});

export async function signOut() {
  const headerList = await headers();
  try {
    await auth.api.signOut({
      headers: headerList,
    });
  } catch (error) {
    console.error('Failed to sign out with Better Auth', error);
  }
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.password_hash
    );

    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.',
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.',
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.',
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', user.id),
      logActivity(userWithTeam?.team_id, user.id, ActivityType.UPDATE_PASSWORD),
    ]);

    return {
      success: 'Password updated successfully.',
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, formData, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.password_hash);
    if (!isPasswordValid) {
      return {
        password,
        error: 'Incorrect password. Account deletion failed.',
      };
    }

    const userWithTeam = await getUserWithTeam(user.id);

    await logActivity(
      userWithTeam?.team_id,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    await supabase
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        email: `${user.email}-${user.id}-deleted`,
      })
      .eq('id', user.id);

    if (userWithTeam?.team_id) {
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', user.id)
        .eq('team_id', userWithTeam.team_id);
      await refreshTeamViews();
    }

    const headerList = await headers();
    try {
      await auth.api.signOut({
        headers: headerList,
      });
    } catch (error) {
      console.error('Failed to clear Better Auth session during deletion', error);
    }

    const locale = resolveLocale(formData?.get('locale') as string | null);
    redirect(`/${locale}/sign-in`);
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    await Promise.all([
      supabase
        .from('users')
        .update({ name, email })
        .eq('id', user.id),
      logActivity(userWithTeam?.team_id, user.id, ActivityType.UPDATE_ACCOUNT),
    ]);

    return { name, success: 'Account updated successfully.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.number(),
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.team_id) {
      return { error: 'User is not part of a team' };
    }

    const { error: functionError } = await supabase.functions.invoke(
      'manage-roles',
      {
        body: {
          action: 'remove_member',
          team_id: userWithTeam.team_id,
          member_id: memberId,
          actor_id: user.id,
        },
      }
    );

    if (functionError) {
      return { error: functionError.message };
    }

    await logActivity(
      userWithTeam.team_id,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Team member removed successfully' };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner', 'admin']),
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.team_id) {
      return { error: 'User is not part of a team' };
    }

    const { error: functionError } = await supabase.functions.invoke(
      'manage-invitations',
      {
        body: {
          team_id: userWithTeam.team_id,
          email,
          role,
          invited_by: user.id,
        },
      }
    );

    if (functionError) {
      return { error: functionError.message };
    }

    await logActivity(
      userWithTeam.team_id,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER
    );

    return { success: 'Invitation sent successfully' };
  }
);
