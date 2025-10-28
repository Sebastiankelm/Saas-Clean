import { z } from 'zod';
import { query, withClient } from '@/lib/admin/db';

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse JSON field', error);
      return fallback;
    }
  }

  if (typeof value === 'object') {
    return value as T;
  }

  return fallback;
}

export const dashboardVisibilitySchema = z.enum(['private', 'team', 'public']);

export type DashboardVisibility = z.infer<typeof dashboardVisibilitySchema>;

export type DashboardRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  visibility: DashboardVisibility;
  team_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DashboardWidgetRecord = {
  id: string;
  dashboard_id: string;
  widget_key: string;
  widget_type: string;
  config: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WidgetLayoutRecord = {
  id: string;
  dashboard_id: string;
  user_id: string | null;
  viewport: string;
  layout: unknown;
  created_at: string;
  updated_at: string;
};

export type DashboardSummary = Pick<
  DashboardRecord,
  'id' | 'slug' | 'title' | 'description' | 'visibility' | 'team_id' | 'metadata' | 'updated_at'
>;

export type DashboardInput = {
  slug: string;
  title: string;
  description?: string | null;
  visibility: DashboardVisibility;
  teamId?: number | null;
  metadata?: Record<string, unknown>;
};

export type DashboardUpdateInput = Partial<DashboardInput>;

export type DashboardWidgetInput = {
  widgetKey: string;
  widgetType: string;
  config: Record<string, unknown>;
  position: number;
};

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export type LayoutPayload = {
  viewport: string;
  layout: LayoutItem[];
};

export async function listDashboardsForAdmin(
  adminUserId: string,
  teamIds: number[],
  includePublic = true
): Promise<DashboardSummary[]> {
  const { rows } = await query<DashboardRecord>(
    `select id, slug, title, description, owner_user_id, visibility, team_id, metadata, created_at, updated_at
     from dashboards.dashboards
     order by updated_at desc`
  );

  return rows
    .filter((dashboard) =>
      canAccessDashboardRecord({
        dashboard,
        adminUserId,
        teamIds,
        includePublic,
      })
    )
    .map((dashboard) => ({
      id: dashboard.id,
      slug: dashboard.slug,
      title: dashboard.title,
      description: dashboard.description,
      visibility: dashboard.visibility,
      team_id: dashboard.team_id,
      metadata: parseJsonField(dashboard.metadata, {} as Record<string, unknown>),
      updated_at: dashboard.updated_at,
    }));
}

export async function getDashboardById(
  id: string
): Promise<DashboardRecord | null> {
  const { rows } = await query<DashboardRecord>(
    `select id, slug, title, description, owner_user_id, visibility, team_id, metadata, created_at, updated_at
     from dashboards.dashboards
     where id = $1
     limit 1`,
    [id]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    ...rows[0],
    metadata: parseJsonField(rows[0].metadata, {} as Record<string, unknown>),
  };
}

export async function createDashboard(
  input: DashboardInput & { ownerUserId: string }
): Promise<DashboardRecord> {
  const { rows } = await query<DashboardRecord>(
    `insert into dashboards.dashboards (slug, title, description, owner_user_id, visibility, team_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, slug, title, description, owner_user_id, visibility, team_id, metadata, created_at, updated_at`,
    [
      input.slug,
      input.title,
      input.description ?? null,
      input.ownerUserId,
      input.visibility,
      input.visibility === 'team' ? input.teamId ?? null : input.visibility === 'public' ? null : null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  const dashboard = rows[0];

  return {
    ...dashboard,
    metadata: parseJsonField(dashboard.metadata, {} as Record<string, unknown>),
  };
}

export async function updateDashboard(
  id: string,
  updates: DashboardUpdateInput
): Promise<DashboardRecord | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (updates.slug !== undefined) {
    fields.push(`slug = $${index++}`);
    values.push(updates.slug);
  }
  if (updates.title !== undefined) {
    fields.push(`title = $${index++}`);
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${index++}`);
    values.push(updates.description ?? null);
  }
  if (updates.visibility !== undefined) {
    fields.push(`visibility = $${index++}`);
    values.push(updates.visibility);
  }
  if (updates.teamId !== undefined) {
    fields.push(`team_id = $${index++}`);
    values.push(updates.teamId ?? null);
  }
  if (updates.metadata !== undefined) {
    fields.push(`metadata = $${index++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  if (!fields.length) {
    const dashboard = await getDashboardById(id);
    return dashboard;
  }

  values.push(id);

  const { rows } = await query<DashboardRecord>(
    `update dashboards.dashboards
     set ${fields.join(', ')}, updated_at = now()
     where id = $${index}
     returning id, slug, title, description, owner_user_id, visibility, team_id, metadata, created_at, updated_at`,
    values
  );

  if (!rows[0]) {
    return null;
  }

  return {
    ...rows[0],
    metadata: parseJsonField(rows[0].metadata, {} as Record<string, unknown>),
  };
}

export async function listDashboardWidgets(dashboardId: string): Promise<DashboardWidgetRecord[]> {
  const { rows } = await query<DashboardWidgetRecord>(
    `select id, dashboard_id, widget_key, widget_type, config, position, created_at, updated_at
     from dashboards.dashboard_widgets
     where dashboard_id = $1
     order by position asc, created_at asc`,
    [dashboardId]
  );

  return rows.map((row) => ({
    ...row,
    config: parseJsonField(row.config, {} as Record<string, unknown>),
  }));
}

export async function replaceDashboardWidgets(
  dashboardId: string,
  widgets: DashboardWidgetInput[]
): Promise<void> {
  await withClient(async (client) => {
    await client.query('begin');
    try {
      await client.query(`delete from dashboards.dashboard_widgets where dashboard_id = $1`, [dashboardId]);

      for (const widget of widgets) {
        await client.query(
          `insert into dashboards.dashboard_widgets (dashboard_id, widget_key, widget_type, config, position)
           values ($1, $2, $3, $4, $5)`,
          [
            dashboardId,
            widget.widgetKey,
            widget.widgetType,
            JSON.stringify(widget.config ?? {}),
            widget.position,
          ]
        );
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export async function getWidgetLayout(
  dashboardId: string,
  adminUserId: string | null,
  viewport: string
): Promise<LayoutItem[] | null> {
  const { rows } = await query<{ layout: unknown }>(
    `select layout
     from dashboards.widget_layouts
     where dashboard_id = $1
       and viewport = $3
       and (
         ($2::uuid is not null and user_id = $2::uuid)
         or ($2::uuid is not null and user_id is null)
         or ($2::uuid is null and user_id is null)
       )
     order by case when user_id = $2::uuid then 0 else 1 end
     limit 1`,
    [dashboardId, adminUserId, viewport]
  );

  const layout = rows[0]?.layout;
  if (!layout) {
    return null;
  }

  if (typeof layout === 'string') {
    try {
      return JSON.parse(layout) as LayoutItem[];
    } catch (error) {
      console.error('Failed to parse widget layout payload', error);
      return null;
    }
  }

  return layout as LayoutItem[];
}

export async function upsertWidgetLayout(
  dashboardId: string,
  adminUserId: string | null,
  payload: LayoutPayload
): Promise<void> {
  await query(
    `insert into dashboards.widget_layouts (dashboard_id, user_id, viewport, layout)
     values ($1, $2, $3, $4)
     on conflict (dashboard_id, user_id, viewport)
     do update set layout = excluded.layout, updated_at = now()`,
    [dashboardId, adminUserId, payload.viewport, JSON.stringify(payload.layout ?? [])]
  );
}

export function canAccessDashboardRecord({
  dashboard,
  adminUserId,
  teamIds,
  includePublic,
}: {
  dashboard: DashboardRecord;
  adminUserId: string;
  teamIds: number[];
  includePublic?: boolean;
}): boolean {
  if (dashboard.owner_user_id && dashboard.owner_user_id === adminUserId) {
    return true;
  }

  if (dashboard.visibility === 'public') {
    return includePublic;
  }

  if (dashboard.visibility === 'team' && dashboard.team_id) {
    return teamIds.includes(dashboard.team_id);
  }

  return false;
}
