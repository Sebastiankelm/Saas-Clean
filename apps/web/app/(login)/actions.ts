'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  ActivityType,
  type NewActivityLog,
  type NewTeam,
  type NewTeamMember,
  type NewUser,
  type Team,
  type TeamMember,
  type User,
} from '@/lib/db/schema';
import {
  comparePasswords,
  hashPassword,
  setSession,
} from '@/lib/auth/session';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/middleware';
import { getSupabaseAdminClient } from '@/lib/db/client';

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
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const { data: foundUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();

  if (userError || !foundUser) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password,
    };
  }

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.password_hash
  );

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password,
    };
  }

  let team: Team | null = null;
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', foundUser.id)
    .maybeSingle();

  if (membership?.team_id) {
    const { data: teamRecord } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .maybeSingle();
    team = teamRecord ?? null;
  }

  await Promise.all([
    setSession({ id: foundUser.id }),
    logActivity(team?.id, foundUser.id, ActivityType.SIGN_IN),
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team, priceId });
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    password_hash: passwordHash,
    role: 'owner',
  } as unknown as NewUser;

  const { data: createdUser, error: createUserError } = await supabase
    .from('users')
    .insert(newUser)
    .select('*')
    .single();

  if (createUserError || !createdUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  let teamId: number | null = null;
  let userRole: TeamMember['role'] = 'owner';
  let createdTeam: Team | null = null;

  if (inviteId) {
    const { data: invitation } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', Number(inviteId))
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (!invitation) {
      return { error: 'Invalid or expired invitation.', email, password };
    }

    teamId = invitation.team_id;
    userRole = invitation.role;

    await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    const { data: teamRecord } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle();
    createdTeam = teamRecord ?? null;

    await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION);
  } else {
    const newTeam: NewTeam = {
      name: `${email}'s Team`,
    } as NewTeam;

    const { data: teamRecord, error: createTeamError } = await supabase
      .from('teams')
      .insert(newTeam)
      .select('*')
      .single();

    if (createTeamError || !teamRecord) {
      return {
        error: 'Failed to create team. Please try again.',
        email,
        password,
      };
    }

    teamId = teamRecord.id;
    createdTeam = teamRecord;

    await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM);
  }

  if (!teamId) {
    return {
      error: 'Failed to associate user with a team. Please try again.',
      email,
      password,
    };
  }

  const newTeamMember: NewTeamMember = {
    user_id: createdUser.id,
    team_id: teamId,
    role: userRole,
  } as unknown as NewTeamMember;

  const { error: memberError } = await supabase
    .from('team_members')
    .insert(newTeamMember);

  if (memberError) {
    console.error('Failed to create team member', memberError);
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  await Promise.all([
    logActivity(teamId, createdUser.id, ActivityType.SIGN_UP),
    setSession({ id: createdUser.id }),
    refreshTeamViews(),
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ team: createdTeam, priceId });
  }

  redirect('/dashboard');
});

export async function signOut() {
  const user = (await getUser()) as User;
  const userWithTeam = await getUserWithTeam(user.id);
  await logActivity(userWithTeam?.team_id, user.id, ActivityType.SIGN_OUT);
  (await cookies()).delete('session');
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
  async (data, _, user) => {
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

    (await cookies()).delete('session');
    redirect('/sign-in');
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
