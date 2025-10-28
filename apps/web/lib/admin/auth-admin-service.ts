import { z } from 'zod';
import { query, withClient } from '@/lib/admin/db';

const adminRoleSchema = z.object({
  assignment_id: z.string().uuid(),
  role_id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  rank: z.number().int(),
  assigned_at: z.string(),
  team_id: z.number().int().nullable(),
});

const mfaFactorSchema = z.object({
  id: z.string().uuid(),
  factor_type: z.string(),
  friendly_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable(),
  app_user_id: z.number().int().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  preferences: z.record(z.any()),
  locale: z.string(),
  timezone: z.string(),
  is_active: z.boolean(),
  last_sign_in_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  roles: z.array(adminRoleSchema),
  mfa_factors: z.array(mfaFactorSchema),
});

export type AdminUserRecord = z.infer<typeof adminUserSchema>;
export type AdminRoleAssignment = z.infer<typeof adminRoleSchema>;
export type AdminMfaFactor = z.infer<typeof mfaFactorSchema>;

const adminRoleSchemaLoose = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  rank: z.number().int(),
});

export type AdminRole = z.infer<typeof adminRoleSchemaLoose>;

const sessionTokenSchema = z.object({
  token_id: z.string().nullable(),
  session_id: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  not_after: z.string().nullable(),
  revoked_at: z.string().nullable(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
});

const sessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  not_before: z.string().nullable(),
  expires_at: z.string().nullable(),
  factor_id: z.string().nullable(),
  aal: z.string().nullable(),
  tokens: z.array(sessionTokenSchema),
});

export type AuthSessionRecord = z.infer<typeof sessionSchema>;

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const { rows } = await query<AdminUserRecord>(
    `select
       u.id,
       u.auth_user_id,
       u.app_user_id,
       u.display_name,
       u.avatar_url,
       u.preferences,
       u.locale,
       u.timezone,
       u.is_active,
       u.last_sign_in_at,
       u.created_at,
       u.updated_at,
       au.email,
       au.phone,
       coalesce(
         json_agg(
           json_build_object(
             'assignment_id', ur.id,
             'role_id', r.id,
             'slug', r.slug,
             'name', r.name,
             'rank', r.rank,
             'assigned_at', ur.assigned_at,
             'team_id', ur.team_id
           )
         ) filter (where ur.id is not null),
         '[]'
       ) as roles,
       coalesce(
         json_agg(
           json_build_object(
             'id', mf.id,
             'factor_type', mf.factor_type,
             'friendly_name', mf.friendly_name,
             'created_at', mf.created_at,
             'updated_at', mf.updated_at
           )
         ) filter (where mf.id is not null),
         '[]'
       ) as mfa_factors
     from admin.users u
     left join auth.users au on au.id = u.auth_user_id
     left join admin.user_roles ur on ur.user_id = u.id
     left join admin.roles r on r.id = ur.role_id
     left join auth.mfa_factors mf on mf.user_id = u.auth_user_id
     group by u.id, au.email, au.phone
     order by u.created_at desc`
  );

  return rows.map((row) => adminUserSchema.parse(row));
}

export async function getAdminUserById(id: string): Promise<AdminUserRecord | null> {
  const { rows } = await query<AdminUserRecord>(
    `select
       u.id,
       u.auth_user_id,
       u.app_user_id,
       u.display_name,
       u.avatar_url,
       u.preferences,
       u.locale,
       u.timezone,
       u.is_active,
       u.last_sign_in_at,
       u.created_at,
       u.updated_at,
       au.email,
       au.phone,
       coalesce(
         json_agg(
           json_build_object(
             'assignment_id', ur.id,
             'role_id', r.id,
             'slug', r.slug,
             'name', r.name,
             'rank', r.rank,
             'assigned_at', ur.assigned_at,
             'team_id', ur.team_id
           )
         ) filter (where ur.id is not null),
         '[]'
       ) as roles,
       coalesce(
         json_agg(
           json_build_object(
             'id', mf.id,
             'factor_type', mf.factor_type,
             'friendly_name', mf.friendly_name,
             'created_at', mf.created_at,
             'updated_at', mf.updated_at
           )
         ) filter (where mf.id is not null),
         '[]'
       ) as mfa_factors
     from admin.users u
     left join auth.users au on au.id = u.auth_user_id
     left join admin.user_roles ur on ur.user_id = u.id
     left join admin.roles r on r.id = ur.role_id
     left join auth.mfa_factors mf on mf.user_id = u.auth_user_id
     where u.id = $1
     group by u.id, au.email, au.phone`,
    [id]
  );

  const record = rows[0];
  return record ? adminUserSchema.parse(record) : null;
}

export async function updateAdminUserStatus(
  userId: string,
  updates: Partial<Pick<AdminUserRecord, 'is_active' | 'preferences'>>
): Promise<AdminUserRecord | null> {
  const result = await query<AdminUserRecord>(
    `update admin.users set
       is_active = coalesce($2, is_active),
       preferences = case when $3::jsonb is not null then $3::jsonb else preferences end,
       updated_at = now()
     where id = $1
     returning
       id,
       auth_user_id,
       app_user_id,
       display_name,
       avatar_url,
       preferences,
       locale,
       timezone,
       is_active,
       last_sign_in_at,
       created_at,
       updated_at,
       null::text as email,
       null::text as phone,
       '[]'::json as roles,
       '[]'::json as mfa_factors`,
    [userId, updates.is_active ?? null, updates.preferences ? JSON.stringify(updates.preferences) : null]
  );

  const record = result.rows[0];
  if (!record) {
    return null;
  }

  return adminUserSchema.parse({
    ...record,
    email: record.email,
    phone: record.phone,
    roles: [],
    mfa_factors: [],
  });
}

export async function fetchAdminRoles(): Promise<AdminRole[]> {
  const { rows } = await query<AdminRole>(
    `select id, slug, name, description, rank from admin.roles order by rank desc`
  );
  return rows.map((row) => adminRoleSchemaLoose.parse(row));
}

async function recordAuditEntry(params: {
  actorAdminUserId: string | null;
  eventType: string;
  resourceType: string;
  resourceIdentifier?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { actorAdminUserId, eventType, resourceType, resourceIdentifier, previousValues, newValues, metadata } = params;

  await query(
    `insert into admin.audit_log (
       actor_user_id,
       event_type,
       resource_type,
       resource_identifier,
       previous_values,
       new_values,
       metadata
     ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)` ,
    [
      actorAdminUserId,
      eventType,
      resourceType,
      resourceIdentifier ?? null,
      previousValues ? JSON.stringify(previousValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export async function assignRolesToUser(
  userId: string,
  roleIds: string[],
  actorAdminUserId: string | null
) {
  if (!roleIds.length) {
    return;
  }

  const inserted: string[] = [];

  await withClient(async (client) => {
    await client.query('begin');
    try {
      const { rows: existingRows } = await client.query<{ role_id: string }>(
        `select role_id from admin.user_roles where user_id = $1`,
        [userId]
      );

      const existing = new Set(existingRows.map((row) => row.role_id));
      const toInsert = roleIds.filter((roleId) => !existing.has(roleId));

      for (const roleId of toInsert) {
        await client.query(
          `insert into admin.user_roles (user_id, role_id, assigned_by) values ($1, $2, $3)` ,
          [userId, roleId, actorAdminUserId]
        );
        inserted.push(roleId);
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });

  for (const roleId of inserted) {
    await recordAuditEntry({
      actorAdminUserId,
      eventType: 'admin.user_roles.assigned',
      resourceType: 'admin.user_roles',
      resourceIdentifier: `${userId}:${roleId}`,
      previousValues: null,
      newValues: { userId, roleId },
    });
  }
}

export async function recordUserAudit(
  actorAdminUserId: string | null,
  userId: string,
  eventType: string,
  previousValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  metadata: Record<string, unknown> | null = null
) {
  await recordAuditEntry({
    actorAdminUserId,
    eventType,
    resourceType: 'admin.users',
    resourceIdentifier: userId,
    previousValues,
    newValues,
    metadata,
  });
}

export async function resetUserPasswordFlag(userId: string) {
  await query(
    `update admin.users
     set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{forcePasswordReset}', 'true'::jsonb),
         updated_at = now()
     where id = $1`,
    [userId]
  );
}

export async function clearUserMfaFactors(authUserId: string | null) {
  if (!authUserId) {
    return;
  }

  await query(`delete from auth.mfa_factors where user_id = $1`, [authUserId]);
}

export async function updateImpersonationGuard(userId: string, enabled: boolean) {
  await query(
    `update admin.users
     set preferences = jsonb_set(coalesce(preferences, '{}'::jsonb), '{impersonationGuard}', $2::jsonb, true),
         updated_at = now()
     where id = $1`,
    [userId, enabled ? 'true' : 'false']
  );
}

export async function listUserSessions(authUserId: string | null): Promise<AuthSessionRecord[]> {
  if (!authUserId) {
    return [];
  }

  const { rows } = await query<AuthSessionRecord>(
    `select
       s.id,
       s.user_id,
       s.created_at,
       s.updated_at,
       s.not_before,
       s.expires_at,
       s.factor_id,
       s.aal,
       coalesce(
         json_agg(
           json_build_object(
             'token_id', rt.id,
             'session_id', s.id,
             'created_at', rt.created_at,
             'updated_at', rt.updated_at,
             'not_after', rt.not_after,
             'revoked_at', rt.revoked_at,
             'ip', rt.ip,
             'user_agent', rt.user_agent
           )
         ) filter (where rt.id is not null),
         '[]'
       ) as tokens
     from auth.sessions s
     left join auth.refresh_tokens rt on rt.session_id = s.id
     where s.user_id = $1
     group by s.id
     order by s.created_at desc`,
    [authUserId]
  );

  return rows.map((row) => sessionSchema.parse(row));
}

export async function invalidateSession(sessionId: string) {
  await withClient(async (client) => {
    await client.query('begin');
    try {
      await client.query(`delete from auth.refresh_tokens where session_id = $1`, [sessionId]);
      await client.query(`delete from auth.sessions where id = $1`, [sessionId]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

