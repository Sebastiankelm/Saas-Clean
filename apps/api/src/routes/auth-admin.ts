import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { updateAuditContext } from '../utils/audit';

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
});

const updateUserSchema = createUserSchema.partial();

const ensureClient = (c: Context<AppEnv>) => {
  const supabase = c.get('supabaseClient');
  if (!supabase) {
    throw new HTTPException(500, { message: 'Supabase client is not available.' });
  }
  return supabase;
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

    updateAuditContext(c, {
      resourceType: 'admin.user',
      resourceIdentifier: data.id,
      newValues: data,
    });

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

    updateAuditContext(c, {
      resourceType: 'admin.user',
      resourceIdentifier: id,
      previousValues: existing,
      newValues: data,
    });

    return c.json({ user: data });
  }
);

export default authAdminRouter;
