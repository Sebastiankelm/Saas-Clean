// @ts-nocheck
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
  actorUserId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
      actorUserId: rawQuery.actorUserId,
      eventType: rawQuery.eventType,
      resourceType: rawQuery.resourceType,
      resourceId: rawQuery.resourceId,
      startDate: rawQuery.startDate,
      endDate: rawQuery.endDate,
    });

    let dbQuery = supabase
      .schema('admin')
      .from('audit_log')
      .select('*', { count: 'estimated' });

    // Apply filters
    if (query.actorUserId) {
      dbQuery = dbQuery.eq('actor_user_id', query.actorUserId);
    }

    if (query.eventType) {
      dbQuery = dbQuery.eq('event_type', query.eventType);
    }

    if (query.resourceType) {
      dbQuery = dbQuery.eq('resource_type', query.resourceType);
    }

    if (query.resourceId) {
      dbQuery = dbQuery.eq('resource_id', query.resourceId);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('occurred_at', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('occurred_at', query.endDate);
    }

    const { data, error, count } = await dbQuery
      .order('occurred_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch audit log.' });
    }

    markAuditSkipped(c);
    return c.json({ 
      entries: data,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: count ?? 0,
        hasMore: count ? query.offset + query.limit < count : false,
      },
    });
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

// Get audit logs by actor user ID
auditRouter.get(
  '/logs/by-actor/:userId',
  requirePermission({ permission: 'system.audit.read' }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const userId = c.req.param('userId');
    const limit = Number.parseInt(c.req.query('limit') ?? '50', 10);
    const offset = Number.parseInt(c.req.query('offset') ?? '0', 10);

    const { data, error, count } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('*', { count: 'estimated' })
      .eq('actor_user_id', userId)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch audit log by actor.' });
    }

    markAuditSkipped(c);
    return c.json({
      entries: data,
      pagination: {
        limit,
        offset,
        total: count ?? 0,
        hasMore: count ? offset + limit < count : false,
      },
    });
  }
);

// Get event types for filtering
auditRouter.get(
  '/event-types',
  requirePermission({ permission: 'system.audit.read' }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const { data, error } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('event_type')
      .order('event_type', { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch event types.' });
    }

    const uniqueEventTypes = [...new Set(data?.map((entry) => entry.event_type).filter(Boolean))];

    markAuditSkipped(c);
    return c.json({ eventTypes: uniqueEventTypes });
  }
);

// Get resource types for filtering
auditRouter.get(
  '/resource-types',
  requirePermission({ permission: 'system.audit.read' }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const { data, error } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('resource_type')
      .order('resource_type', { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to fetch resource types.' });
    }

    const uniqueResourceTypes = [...new Set(data?.map((entry) => entry.resource_type).filter(Boolean))];

    markAuditSkipped(c);
    return c.json({ resourceTypes: uniqueResourceTypes });
  }
);

export default auditRouter;
