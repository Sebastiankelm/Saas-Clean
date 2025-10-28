import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '../../utils';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { recordAuditEvent } from '@/lib/admin/audit-log-service';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  actorUserId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminUser();

    const supabase = getSupabaseAdminClient();
    const url = new URL(request.url);
    const params = querySchema.parse({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
      actorUserId: url.searchParams.get('actorUserId') || undefined,
      eventType: url.searchParams.get('eventType') || undefined,
      resourceType: url.searchParams.get('resourceType') || undefined,
      resourceId: url.searchParams.get('resourceId') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
    });

    let query = supabase
      .schema('admin')
      .from('audit_log')
      .select('*', { count: 'exact' });

    if (params.actorUserId) {
      query = query.eq('actor_user_id', params.actorUserId);
    }

    if (params.eventType) {
      query = query.eq('event_type', params.eventType);
    }

    if (params.resourceType) {
      query = query.eq('resource_type', params.resourceType);
    }

    if (params.resourceId) {
      query = query.eq('resource_id', params.resourceId);
    }

    if (params.startDate) {
      query = query.gte('occurred_at', params.startDate);
    }

    if (params.endDate) {
      query = query.lte('occurred_at', params.endDate);
    }

    const { data, error, count } = await query
      .order('occurred_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) {
      throw error;
    }

    // Get resource types and event types for filters
    const { data: resourceTypes } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('resource_type')
      .order('resource_type');

    const { data: eventTypes } = await supabase
      .schema('admin')
      .from('audit_log')
      .select('event_type')
      .order('event_type');

    // Get actors
    const { data: actorsData } = await supabase
      .schema('admin')
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', data.map((entry) => entry.actor_user_id).filter(Boolean));

    const uniqueResourceTypes = [...new Set(resourceTypes?.map((r) => r.resource_type).filter(Boolean))];
    const uniqueEventTypes = [...new Set(eventTypes?.map((e) => e.event_type).filter(Boolean))];

    return NextResponse.json({
      entries: data,
      total: count ?? 0,
      page: Math.floor(params.offset / params.limit) + 1,
      pageSize: params.limit,
      hasMore: count ? params.offset + params.limit < count : false,
      filters: {
        resourceTypes: uniqueResourceTypes,
        eventTypes: uniqueEventTypes,
        actors: actorsData || [],
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
