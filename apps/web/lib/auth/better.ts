import { betterAuth, type InferAPI, APIError } from 'better-auth';
import { organization } from 'better-auth/plugins/organization';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import { getSupabaseAdminClient } from '@/lib/db/client';
import {
  ActivityType,
  type NewTeam,
  type NewTeamMember,
  type NewUser,
} from '@/lib/db/schema';
import { baseUrl as applicationBaseUrl, env } from '@/config/env';

const databaseUrl = env.POSTGRES_URL;
const authSecret = env.AUTH_SECRET;
const baseUrl = applicationBaseUrl ?? 'http://localhost:3000';

if (!databaseUrl) {
  throw new Error('POSTGRES_URL is not defined');
}

if (!authSecret) {
  throw new Error('AUTH_SECRET is not defined');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    env.POSTGRES_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },
});

const supabase = getSupabaseAdminClient();

const authInstance = betterAuth({
  baseURL: baseUrl,
  secret: authSecret,
  database: {
    dialect: new PostgresDialect({ pool }),
    type: 'postgres',
    casing: 'snake',
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      supabaseId: {
        type: 'number',
        required: false,
        input: false,
        returned: true,
      },
    },
  },
  integrations: [],
  plugins: [
    organization({
      teams: {
        enabled: true,
        defaultTeam: {
          enabled: true,
        },
      },
    }),
  ],
  databaseHooks: {
    account: {
      create: {
        async after(account, ctx) {
          if (account.providerId !== 'credential') {
            return;
          }

          const requestBody =
            (ctx?.context as unknown as { body?: Record<string, unknown> })?.
              body ?? {};
          const inviteId = requestBody?.inviteId
            ? Number(requestBody.inviteId)
            : undefined;

          const userRecord = await ctx?.context.internalAdapter.findUserById(
            account.userId,
            ctx?.context
          );

          if (!userRecord) {
            return;
          }

          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', userRecord.email)
            .maybeSingle();

          if (existingUser) {
            await ctx?.context.internalAdapter.updateUser(account.userId, {
              supabaseId: existingUser.id,
            });
            return;
          }

          if (!account.password) {
            return;
          }

          const newUser: NewUser = {
            email: userRecord.email,
            name: userRecord.name ?? null,
            password_hash: account.password,
            role: 'owner',
          } as NewUser;

          const { data: createdUser, error: createUserError } = await supabase
            .from('users')
            .insert(newUser)
            .select('*')
            .single();

          if (createUserError || !createdUser) {
            console.error('Failed to create Supabase user', createUserError);
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Failed to create Supabase user',
            });
          }

          if (typeof inviteId === 'number') {
            await ctx?.context.internalAdapter.updateUser(account.userId, {
              supabaseId: createdUser.id,
            });
            return;
          }

          const teamPayload: NewTeam = {
            name: `${userRecord.email}'s Team`,
          } as NewTeam;

          const { data: createdTeam, error: createTeamError } = await supabase
            .from('teams')
            .insert(teamPayload)
            .select('*')
            .single();

          if (createTeamError || !createdTeam) {
            console.error('Failed to create default team', createTeamError);
            return;
          }

          const memberPayload: NewTeamMember = {
            team_id: createdTeam.id,
            user_id: createdUser.id,
            role: 'owner',
          } as NewTeamMember;

          const { error: memberError } = await supabase
            .from('team_members')
            .insert(memberPayload);

          if (memberError) {
            console.error('Failed to create team member', memberError);
          }

          await Promise.all([
            supabase.from('activity_logs').insert({
              team_id: createdTeam.id,
              user_id: createdUser.id,
              action: ActivityType.CREATE_TEAM,
            }),
            supabase.from('activity_logs').insert({
              team_id: createdTeam.id,
              user_id: createdUser.id,
              action: ActivityType.SIGN_UP,
            }),
            supabase.rpc('refresh_team_views'),
            ctx?.context.internalAdapter.updateUser(account.userId, {
              supabaseId: createdUser.id,
            }),
          ]);
        },
      },
    },
    session: {
      create: {
        async after(session, ctx) {
          const user = await ctx?.context.internalAdapter.findUserById(
            session.userId,
            ctx?.context
          );

          if (!user?.supabaseId) {
            return;
          }

          const { data: membership } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user.supabaseId)
            .maybeSingle();

          if (!membership?.team_id) {
            return;
          }

          await supabase.from('activity_logs').insert({
            team_id: membership.team_id,
            user_id: user.supabaseId,
            action: ActivityType.SIGN_IN,
          });
        },
      },
      delete: {
        async after(session, ctx) {
          const user = await ctx?.context.internalAdapter.findUserById(
            session.userId,
            ctx?.context
          );

          if (!user?.supabaseId) {
            return;
          }

          const { data: membership } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user.supabaseId)
            .maybeSingle();

          if (!membership?.team_id) {
            return;
          }

          await supabase.from('activity_logs').insert({
            team_id: membership.team_id,
            user_id: user.supabaseId,
            action: ActivityType.SIGN_OUT,
          });
        },
      },
    },
  },
});

export const auth = authInstance;
export type AuthAPI = InferAPI<typeof auth>;

export async function validateSession(headersInit: HeadersInit) {
  const result = await auth.api.getSession({
    headers: headersInit,
    returnHeaders: true,
  });

  return result;
}
