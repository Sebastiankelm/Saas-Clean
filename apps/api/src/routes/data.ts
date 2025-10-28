import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { markAuditSkipped } from '../utils/audit';

const dataRouter = new Hono<AppEnv>();

const querySchema = z.object({
  schema: z.enum(['public', 'admin', 'cms', 'dashboards']).default('public'),
  table: z.string().min(1),
  select: z.array(z.string().min(1)).optional(),
  filters: z.record(z.any()).optional(),
  limit: z.number().int().positive().max(500).default(50),
});

dataRouter.get(
  '/overview',
  requirePermission({ anyOf: ['data.overview.read', 'cms.collections.read', 'dashboards.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const [collections, entries, dashboards] = await Promise.all([
      supabase.schema('cms').from('collections').select('*', { count: 'exact', head: true }),
      supabase.schema('cms').from('entries').select('*', { count: 'exact', head: true }),
      supabase.schema('dashboards').from('dashboards').select('*', { count: 'exact', head: true }),
    ]);

    const errors = [collections.error, entries.error, dashboards.error].filter(Boolean);
    if (errors.length > 0) {
      throw new HTTPException(500, { message: 'Failed to load overview counts.' });
    }

    return c.json({
      summary: {
        collections: collections.count ?? 0,
        entries: entries.count ?? 0,
        dashboards: dashboards.count ?? 0,
      },
    });
  }
);

dataRouter.post(
  '/query',
  requirePermission({ anyOf: ['data.query.execute', 'dashboards.manage', 'cms.entries.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = querySchema.parse(await c.req.json());

    let query = supabase
      .schema(payload.schema)
      .from(payload.table)
      .select(payload.select?.join(',') ?? '*', { count: 'estimated' })
      .limit(payload.limit);

    if (payload.filters) {
      for (const [column, value] of Object.entries(payload.filters)) {
        if (value === undefined || value === null) {
          continue;
        }
        query = query.eq(column, value as never);
      }
    }

    const { data, error, count } = await query;
    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    markAuditSkipped(c);
    return c.json({ data, count });
  }
);

export default dataRouter;
