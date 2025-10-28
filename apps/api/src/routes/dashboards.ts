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

// =============================================================================
// DASHBOARD WIDGETS ENDPOINTS
// =============================================================================

const widgetSchema = z.object({
  widget_type: z.enum(['chart', 'metric', 'table']),
  name: z.string().min(1),
  config: z.record(z.any()),
  datasource: z.record(z.any()),
  position: z.record(z.any()).optional(),
});

const updateWidgetSchema = widgetSchema.partial();

dashboardsRouter.get(
  '/:dashboardId/widgets',
  requirePermission({ anyOf: ['dashboards.read', 'dashboards.manage'] }),
  async (c) => {
    const supabase = ensureClient(c);
    const dashboardId = c.req.param('dashboardId');

    const { data, error } = await supabase
      .schema('dashboards')
      .from('widgets')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load widgets.' });
    }

    return c.json({ widgets: data });
  }
);

dashboardsRouter.post(
  '/:dashboardId/widgets',
  requirePermission({ permission: 'dashboards.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const dashboardId = c.req.param('dashboardId');
    const payload = widgetSchema.parse(await c.req.json());

    const insertPayload = {
      dashboard_id: dashboardId,
      widget_type: payload.widget_type,
      name: payload.name,
      config: payload.config,
      datasource: payload.datasource,
      position: payload.position ?? null,
    };

    const { data, error } = await supabase
      .schema('dashboards')
      .from('widgets')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.widget',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ widget: data }, 201);
  }
);

dashboardsRouter.patch(
  '/widgets/:id',
  requirePermission({ permission: 'dashboards.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const id = c.req.param('id');
    const payload = updateWidgetSchema.parse(await c.req.json());

    const updatePayload: Record<string, unknown> = {};
    if (payload.widget_type !== undefined) updatePayload.widget_type = payload.widget_type;
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.config !== undefined) updatePayload.config = payload.config;
    if (payload.datasource !== undefined) updatePayload.datasource = payload.datasource;
    if (payload.position !== undefined) updatePayload.position = payload.position;

    const { data, error } = await supabase
      .schema('dashboards')
      .from('widgets')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.widget',
      resourceIdentifier: id,
      newValues: data,
    });

    return c.json({ widget: data });
  }
);

dashboardsRouter.delete(
  '/widgets/:id',
  requirePermission({ permission: 'dashboards.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const id = c.req.param('id');

    const { error } = await supabase
      .schema('dashboards')
      .from('widgets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.widget',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

// =============================================================================
// WIDGET LAYOUTS ENDPOINTS
// =============================================================================

const layoutSchema = z.object({
  viewport: z.enum(['mobile', 'tablet', 'desktop']),
  layout: z.record(z.any()),
});

dashboardsRouter.get(
  '/:dashboardId/layouts',
  requirePermission({ anyOf: ['dashboards.read', 'dashboards.manage'] }),
  async (c) => {
    const supabase = ensureClient(c);
    const dashboardId = c.req.param('dashboardId');
    const actor = c.get('actor');

    // Get user-specific layout
    const { data, error } = await supabase
      .schema('dashboards')
      .from('widget_layouts')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .eq('user_id', actor?.adminUserId);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load layouts.' });
    }

    return c.json({ layouts: data });
  }
);

dashboardsRouter.post(
  '/:dashboardId/layouts',
  requirePermission({ permission: 'dashboards.manage', sensitive: true }),
  async (c) => {
    const supabase = ensureClient(c);
    const dashboardId = c.req.param('dashboardId');
    const actor = c.get('actor');
    const payload = layoutSchema.parse(await c.req.json());

    if (!actor?.adminUserId) {
      throw new HTTPException(401, { message: 'User ID is required.' });
    }

    const insertPayload = {
      dashboard_id: dashboardId,
      user_id: actor.adminUserId,
      viewport: payload.viewport,
      layout: payload.layout,
    };

    const { data, error } = await supabase
      .schema('dashboards')
      .from('widget_layouts')
      .upsert(insertPayload, {
        onConflict: 'dashboard_id,user_id,viewport',
      })
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'dashboards.layout',
      resourceIdentifier: `${dashboardId}:${actor.adminUserId}:${payload.viewport}`,
      newValues: data,
    });

    return c.json({ layout: data }, 201);
  }
);

export default dashboardsRouter;
