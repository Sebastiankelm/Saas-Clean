import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { updateAuditContext } from '../utils/audit';

const dashboardsRouter = new Hono<AppEnv>();

const visibilityEnum = z.enum(['private', 'team', 'public']);

const createDashboardSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: visibilityEnum.default('private'),
  teamId: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateDashboardSchema = createDashboardSchema.partial();

const ensureClient = (c: Context<AppEnv>) => {
  const supabase = c.get('supabaseClient');
  if (!supabase) {
    throw new HTTPException(500, { message: 'Supabase client is not available.' });
  }
  return supabase;
};

dashboardsRouter.get(
  '/',
  requirePermission({ anyOf: ['dashboards.read', 'dashboards.manage'] }),
  async (c) => {
    const supabase = ensureClient(c);

    const { data, error } = await supabase
      .schema('dashboards')
      .from('dashboards')
      .select('id, slug, title, description, visibility, team_id, metadata, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load dashboards.' });
    }

    return c.json({ dashboards: data });
  }
);

dashboardsRouter.post(
  '/',
  requirePermission({ permission: 'dashboards.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const actor = c.get('actor');
    const payload = createDashboardSchema.parse(await c.req.json());

    const insertPayload = {
      slug: payload.slug,
      title: payload.title,
      description: payload.description ?? null,
      visibility: payload.visibility,
      team_id: payload.teamId ?? null,
      metadata: payload.metadata ?? {},
      owner_user_id: actor?.adminUserId ?? null,
    };

    const { data, error } = await supabase
      .schema('dashboards')
      .from('dashboards')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.dashboard',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ dashboard: data }, 201);
  }
);

dashboardsRouter.patch(
  '/:id',
  requirePermission({ allOf: ['dashboards.manage'], anyOf: ['dashboards.read'], sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const id = c.req.param('id');
    const payload = updateDashboardSchema.parse(await c.req.json());

    const { data: existing, error: existingError } = await supabase
      .schema('dashboards')
      .from('dashboards')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError) {
      throw new HTTPException(existingError.code === 'PGRST116' ? 404 : 400, {
        message: existingError.message,
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (payload.slug !== undefined) updatePayload.slug = payload.slug;
    if (payload.title !== undefined) updatePayload.title = payload.title;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.visibility !== undefined) updatePayload.visibility = payload.visibility;
    if (payload.teamId !== undefined) updatePayload.team_id = payload.teamId;
    if (payload.metadata !== undefined) updatePayload.metadata = payload.metadata;

    const { data, error } = await supabase
      .schema('dashboards')
      .from('dashboards')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.dashboard',
      resourceIdentifier: id,
      previousValues: existing,
      newValues: data,
    });

    return c.json({ dashboard: data });
  }
);

export default dashboardsRouter;
