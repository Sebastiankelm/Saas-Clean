import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { updateAuditContext, markAuditSkipped } from '../utils/audit';

const authAdminRouter = new Hono<AppEnv>();

const createUserSchema = z.object({
  authUserId: z.string().uuid().optional(),
  appUserId: z.number().int().positive().optional(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  locale: z.string().default('en'),
  timezone: z.string().default('UTC'),
  isActive: z.boolean().default(true),
  preferences: z.record(z.any()).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

const updateUserSchema = createUserSchema.partial();

const ensureClient = (c: Context<AppEnv>) => {
  const supabase = c.get('supabaseClient');
  if (!supabase) {
    throw new HTTPException(500, { message: 'Supabase client is not available.' });
  }
  return supabase;
};

const syncUserRoles = async (
  supabase: ReturnType<typeof ensureClient>,
  userId: string,
  roleIds: string[] | undefined,
  assignedBy: string | null
) => {
  if (!roleIds?.length) {
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .schema('admin')
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId);

  if (existingError) {
    throw new HTTPException(400, { message: existingError.message });
  }

  const existingSet = new Set((existing ?? []).map((row) => row.role_id));
  const toInsert = roleIds.filter((roleId) => !existingSet.has(roleId));

  if (!toInsert.length) {
    return;
  }

  const { error } = await supabase
    .schema('admin')
    .from('user_roles')
    .insert(
      toInsert.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
      }))
    );

  if (error) {
    throw new HTTPException(400, { message: error.message });
  }
};

const recordAuditEntry = async (
  supabase: ReturnType<typeof ensureClient>,
  actorAdminUserId: string | null,
  eventType: string,
  resourceId: string,
  previousValues: unknown,
  newValues: unknown,
  metadata?: Record<string, unknown>
) => {
  const { error } = await supabase.schema('admin').from('audit_log').insert({
    actor_user_id: actorAdminUserId,
    event_type: eventType,
    resource_type: 'admin.users',
    resource_identifier: resourceId,
    previous_values: previousValues ?? null,
    new_values: newValues ?? null,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error('Failed to record auth-admin audit entry', error);
  }
};

authAdminRouter.get(
  '/users',
  requirePermission({ anyOf: ['system.roles.read', 'system.permissions.read'] }),
  async (c) => {
    const supabase = ensureClient(c);

    const { data, error } = await supabase
      .schema('admin')
      .from('users')
      .select('id, auth_user_id, app_user_id, display_name, avatar_url, locale, timezone, is_active, last_sign_in_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load admin users.' });
    }

    return c.json({ users: data });
  }
);

authAdminRouter.post(
  '/users',
  requirePermission({ permission: 'system.roles.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const payload = createUserSchema.parse(await c.req.json());
    const actor = c.get('actor');

    const insertPayload = {
      auth_user_id: payload.authUserId ?? null,
      app_user_id: payload.appUserId ?? null,
      display_name: payload.displayName,
      avatar_url: payload.avatarUrl ?? null,
      locale: payload.locale,
      timezone: payload.timezone,
      is_active: payload.isActive,
      preferences: payload.preferences ?? {},
    };

    const { data, error } = await supabase
      .schema('admin')
      .from('users')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    await syncUserRoles(supabase, data.id, payload.roleIds, actor?.adminUserId ?? null);

    updateAuditContext(c, {
      eventType: 'admin.users.created',
      resourceType: 'admin.user',
      resourceIdentifier: data.id,
      newValues: data,
    });

    await recordAuditEntry(
      supabase,
      actor?.adminUserId ?? null,
      'admin.users.created',
      data.id,
      null,
      {
        ...data,
        roleIds: payload.roleIds ?? [],
      }
    );

    return c.json({ user: data }, 201);
  }
);

authAdminRouter.patch(
  '/users/:id',
  requirePermission({ allOf: ['system.roles.manage'], anyOf: ['system.roles.read'], sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const id = c.req.param('id');
    const payload = updateUserSchema.parse(await c.req.json());
    const actor = c.get('actor');

    const { data: existing, error: existingError } = await supabase
      .schema('admin')
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError) {
      throw new HTTPException(existingError.code === 'PGRST116' ? 404 : 400, {
        message: existingError.message,
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (payload.authUserId !== undefined) updatePayload.auth_user_id = payload.authUserId;
    if (payload.appUserId !== undefined) updatePayload.app_user_id = payload.appUserId;
    if (payload.displayName !== undefined) updatePayload.display_name = payload.displayName;
    if (payload.avatarUrl !== undefined) updatePayload.avatar_url = payload.avatarUrl;
    if (payload.locale !== undefined) updatePayload.locale = payload.locale;
    if (payload.timezone !== undefined) updatePayload.timezone = payload.timezone;
    if (payload.isActive !== undefined) updatePayload.is_active = payload.isActive;
    if (payload.preferences !== undefined) updatePayload.preferences = payload.preferences;

    const { data, error } = await supabase
      .schema('admin')
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    await syncUserRoles(supabase, id, payload.roleIds, actor?.adminUserId ?? null);

    updateAuditContext(c, {
      eventType: 'admin.users.updated',
      resourceType: 'admin.user',
      resourceIdentifier: id,
      previousValues: existing,
      newValues: data,
    });

    await recordAuditEntry(
      supabase,
      actor?.adminUserId ?? null,
      'admin.users.updated',
      id,
      existing,
      {
        ...data,
        roleIds: payload.roleIds ?? [],
      }
    );

    return c.json({ user: data });
  }
);

// =============================================================================
// SUPABASE AUTH USER MANAGEMENT
// =============================================================================

const banUserSchema = z.object({
  until: z.string().optional(), // ISO date string
  reason: z.string().optional(),
});

const updateAuthUserSchema = z.object({
  email: z.string().email().optional(),
  banUntil: z.string().optional(),
  confirmed: z.boolean().optional(),
  role: z.string().optional(),
  userMetadata: z.record(z.any()).optional(),
  appMetadata: z.record(z.any()).optional(),
});

authAdminRouter.get(
  '/auth-users',
  requirePermission({ permission: 'system.user_management' }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const page = Number.parseInt(c.req.query('page') ?? '1', 10);
    const perPage = Number.parseInt(c.req.query('perPage') ?? '50', 10);

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to list auth users.' });
    }

    markAuditSkipped(c);
    return c.json({ users: data.users, total: data.total });
  }
);

authAdminRouter.get(
  '/auth-users/:id',
  requirePermission({ permission: 'system.user_management' }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);

    if (error) {
      throw new HTTPException(404, { message: 'Auth user not found.' });
    }

    markAuditSkipped(c);
    return c.json({ user: data.user });
  }
);

authAdminRouter.post(
  '/auth-users/:id/ban',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    const supabase = ensureClient(c);
    const actor = c.get('actor');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');
    const payload = banUserSchema.parse(await c.req.json());
    
    // Prevent self-ban
    if (id === actor?.authUserId) {
      throw new HTTPException(400, { message: 'Cannot ban yourself.' });
    }

    const banUntil = payload.until ? new Date(payload.until).toISOString() : null;

    // Update admin.users table to deactivate
    const { data: adminUser } = await supabase
      .schema('admin')
      .from('users')
      .select('*')
      .eq('auth_user_id', id)
      .maybeSingle();

    if (!adminUser) {
      throw new HTTPException(404, { message: 'Admin user not found.' });
    }

    const { data, error } = await supabase
      .schema('admin')
      .from('users')
      .update({ is_active: false })
      .eq('id', adminUser.id)
      .select()
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.banned',
      resourceType: 'auth.user',
      resourceIdentifier: id,
      metadata: {
        reason: payload.reason,
        until: banUntil,
      },
    });

    return c.json({ user: data.user });
  }
);

authAdminRouter.post(
  '/auth-users/:id/unban',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');

    // Find and activate admin user
    const { data: adminUser } = await supabase
      .schema('admin')
      .from('users')
      .select('*')
      .eq('auth_user_id', id)
      .maybeSingle();

    if (!adminUser) {
      throw new HTTPException(404, { message: 'Admin user not found.' });
    }

    const { data, error } = await supabase
      .schema('admin')
      .from('users')
      .update({ is_active: true })
      .eq('id', adminUser.id)
      .select()
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.unbanned',
      resourceType: 'auth.user',
      resourceIdentifier: id,
    });

    return c.json({ user: data });
  }
);

authAdminRouter.post(
  '/auth-users/:id/verify',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email_confirm: true,
    });

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.verified',
      resourceType: 'auth.user',
      resourceIdentifier: id,
    });

    return c.json({ user: data.user });
  }
);

authAdminRouter.post(
  '/auth-users/:id/reset-password',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');
    const { redirectTo } = await c.req.json();

    // Get user email first
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (!userData.user?.email) {
      throw new HTTPException(400, { message: 'User email not found.' });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userData.user.email,
      options: {
        redirectTo: redirectTo || undefined,
      },
    });

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.password_reset',
      resourceType: 'auth.user',
      resourceIdentifier: id,
    });

    return c.json({ link: data.properties?.action_link });
  }
);

authAdminRouter.post(
  '/auth-users/:id/delete',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    const actor = c.get('actor');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');

    // Prevent self-delete
    if (id === actor?.authUserId) {
      throw new HTTPException(400, { message: 'Cannot delete yourself.' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.deleted',
      resourceType: 'auth.user',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

authAdminRouter.patch(
  '/auth-users/:id',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    const actor = c.get('actor');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');
    const payload = updateAuthUserSchema.parse(await c.req.json());

    const updateData: {
      email?: string;
      ban_until?: string | null;
      email_confirm?: boolean;
      role?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    } = {};

    if (payload.email !== undefined) {
      updateData.email = payload.email;
    }
    if (payload.banUntil !== undefined) {
      updateData.ban_until = payload.banUntil || null;
    }
    if (payload.confirmed !== undefined) {
      updateData.email_confirm = payload.confirmed;
    }
    if (payload.role !== undefined) {
      updateData.role = payload.role;
    }
    if (payload.userMetadata !== undefined) {
      updateData.user_metadata = payload.userMetadata;
    }
    if (payload.appMetadata !== undefined) {
      updateData.app_metadata = payload.appMetadata;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updateData);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.updated',
      resourceType: 'auth.user',
      resourceIdentifier: id,
      newValues: updateData,
    });

    return c.json({ user: data.user });
  }
);

// Get user sessions (get user and return session info from metadata)
authAdminRouter.get(
  '/auth-users/:id/sessions',
  requirePermission({ permission: 'system.user_management' }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);

    if (error) {
      throw new HTTPException(500, { message: error.message });
    }

    // Return session info from user data
    markAuditSkipped(c);
    return c.json({ 
      sessions: data.user?.app_metadata?.sessions || [],
      user: data.user
    });
  }
);

// Sign out user from all sessions
authAdminRouter.post(
  '/auth-users/:id/signout-all',
  requirePermission({ permission: 'system.user_management', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const id = c.req.param('id');

    const { error } = await supabaseAdmin.auth.admin.signOut(id, 'global');

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      eventType: 'auth.user.signed_out_all',
      resourceType: 'auth.user',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

// Grant/Revoke admin access (via app_metadata)
authAdminRouter.post(
  '/auth-users/:id/grant-admin-access',
  requirePermission({ permission: 'system.roles.manage', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    const supabase = ensureClient(c);
    const actor = c.get('actor');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const authUserId = c.req.param('id');
    const payload = await c.req.json();

    // Update auth user app_metadata
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        supamode_access: true,
      },
    });

    if (authError) {
      throw new HTTPException(400, { message: authError.message });
    }

    // Get or create admin user record
    const { data: existingAdmin } = await supabase
      .schema('admin')
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    let adminUserId = existingAdmin?.id;

    if (!adminUserId) {
      // Create admin user record using RPC function
      // We need to get app_user_id from public.users first
      const { data: publicUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUserId)
        .maybeSingle();

      if (publicUser) {
        const { error: createError } = await supabase.rpc('admin.grant_admin_access', {
          p_app_user_id: publicUser.id,
          p_role_id: payload.roleId || null,
        });

        if (createError) {
          console.error('Failed to create admin user:', createError);
        } else {
          // Fetch the newly created admin user
          const { data: newAdminUser } = await supabase
            .schema('admin')
            .from('users')
            .select('id')
            .eq('app_user_id', publicUser.id)
            .maybeSingle();
          
          adminUserId = newAdminUser?.id;
        }
      }
    }

    updateAuditContext(c, {
      eventType: 'auth.user.admin_access_granted',
      resourceType: 'auth.user',
      resourceIdentifier: authUserId,
      metadata: {
        roleId: payload.roleId,
      },
    });

    return c.json({ user: authUser.user, adminUserId });
  }
);

authAdminRouter.post(
  '/auth-users/:id/revoke-admin-access',
  requirePermission({ permission: 'system.roles.manage', sensitive: true }),
  async (c) => {
    const supabaseAdmin = c.get('supabaseAdmin');
    const supabase = ensureClient(c);
    const actor = c.get('actor');
    
    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const authUserId = c.req.param('id');

    // Prevent self-revoke
    if (authUserId === actor?.authUserId) {
      throw new HTTPException(400, { message: 'Cannot revoke your own admin access.' });
    }

    // Update auth user app_metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      app_metadata: {
        supamode_access: false,
      },
    });

    if (authError) {
      throw new HTTPException(400, { message: authError.message });
    }

    // Optionally deactivate or delete admin user record
    // For now, we'll just deactivate
    const { data: adminUser } = await supabase
      .schema('admin')
      .from('users')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (adminUser) {
      await supabase
        .schema('admin')
        .from('users')
        .update({ is_active: false })
        .eq('id', adminUser.id);
    }

    updateAuditContext(c, {
      eventType: 'auth.user.admin_access_revoked',
      resourceType: 'auth.user',
      resourceIdentifier: authUserId,
    });

    return c.json({ success: true });
  }
);

export default authAdminRouter;
