import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { markAuditSkipped } from '../utils/audit';

const auditRouter = new Hono<AppEnv>();

const listSchema = z.object({
  limit: z.number().int().positive().max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

auditRouter.get(
  '/logs',
  requirePermission({ permission: 'system.audit.read' }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const rawQuery = c.req.query();
    const limit = rawQuery.limit !== undefined ? Number.parseInt(rawQuery.limit, 10) : undefined;
    const offset = rawQuery.offset !== undefined ? Number.parseInt(rawQuery.offset, 10) : undefined;
    const query = listSchema.parse({
      limit: Number.isNaN(limit) ? undefined : limit,
      offset: Number.isNaN(offset) ? undefined : offset,
    });

    const { data, error, count } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('*', { count: 'estimated' })
      .order('occurred_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch audit log.' });
    }

    markAuditSkipped(c);
    return c.json({ entries: data, count });
  }
);

auditRouter.get(
  '/logs/:id',
  requirePermission({ permission: 'system.audit.read' }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = Number.parseInt(c.req.param('id'), 10);
    if (Number.isNaN(id)) {
      throw new HTTPException(400, { message: 'Audit log identifier must be a number.' });
    }

    const { data, error } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch audit entry.' });
    }

    if (!data) {
      throw new HTTPException(404, { message: 'Audit entry not found.' });
    }

    markAuditSkipped(c);
    return c.json({ entry: data });
  }
);

export default auditRouter;
