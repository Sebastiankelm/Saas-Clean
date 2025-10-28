import { query } from '@/lib/admin/db';

export type AuditLogEntry = {
  id: number;
  actor_user_id: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  event_type: string;
  resource_type: string;
  resource_identifier: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  occurred_at: string;
};

export type AuditLogSearchParams = {
  resourceType?: string | null;
  resourceIdentifier?: string | null;
  eventType?: string | null;
  actorUserId?: string | null;
  actorIsNull?: boolean;
  search?: string | null;
  start?: Date | null;
  end?: Date | null;
  page?: number;
  pageSize?: number;
};

export type AuditLogSearchResult = {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type AuditLogFilters = {
  resourceTypes: string[];
  eventTypes: string[];
  actors: { id: string; displayName: string; avatarUrl: string | null }[];
};

export type AuditLogMetrics = {
  topEvents: { eventType: string; count: number }[];
  topResources: { resourceType: string; count: number }[];
  activityHeatmap: { date: string; hour: number; count: number }[];
};

export async function recordAuditEvent(params: {
  actorAdminUserId: string | null;
  eventType: string;
  resourceType: string;
  resourceIdentifier?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  const {
    actorAdminUserId,
    eventType,
    resourceType,
    resourceIdentifier,
    previousValues,
    newValues,
    metadata,
    ipAddress,
  } = params;

  await query(
    `insert into admin.audit_log (
       actor_user_id,
       event_type,
       resource_type,
       resource_identifier,
       previous_values,
       new_values,
       metadata,
       ip_address
     ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)` ,
    [
      actorAdminUserId,
      eventType,
      resourceType,
      resourceIdentifier ?? null,
      previousValues ? JSON.stringify(previousValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress ?? null,
    ]
  );
}

export async function searchAuditLogs(params: AuditLogSearchParams): Promise<AuditLogSearchResult> {
  const {
    resourceType,
    resourceIdentifier,
    eventType,
    actorUserId,
    actorIsNull,
    search,
    start,
    end,
  } = params;
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (resourceType) {
    conditions.push(`al.resource_type = $${index}`);
    values.push(resourceType);
    index += 1;
  }

  if (resourceIdentifier) {
    conditions.push(`al.resource_identifier = $${index}`);
    values.push(resourceIdentifier);
    index += 1;
  }

  if (eventType) {
    conditions.push(`al.event_type = $${index}`);
    values.push(eventType);
    index += 1;
  }

  if (actorIsNull) {
    conditions.push('al.actor_user_id is null');
  } else if (actorUserId) {
    conditions.push(`al.actor_user_id = $${index}`);
    values.push(actorUserId);
    index += 1;
  }

  if (search) {
    conditions.push(
      `(al.resource_identifier ilike $${index} or al.event_type ilike $${index} or al.metadata::text ilike $${index})`
    );
    values.push(`%${search}%`);
    index += 1;
  }

  if (start instanceof Date && !Number.isNaN(start.valueOf())) {
    conditions.push(`al.occurred_at >= $${index}`);
    values.push(start.toISOString());
    index += 1;
  }

  if (end instanceof Date && !Number.isNaN(end.valueOf())) {
    conditions.push(`al.occurred_at <= $${index}`);
    values.push(end.toISOString());
    index += 1;
  }

  const whereClause = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const dataQuery = `
    select
      al.id,
      al.actor_user_id,
      coalesce(u.display_name, 'System') as actor_display_name,
      u.avatar_url as actor_avatar_url,
      al.event_type,
      al.resource_type,
      al.resource_identifier,
      al.previous_values,
      al.new_values,
      al.metadata,
      al.ip_address,
      al.occurred_at
    from admin.audit_log al
    left join admin.users u on al.actor_user_id = u.id
    ${whereClause}
    order by al.occurred_at desc
    limit $${index}
    offset $${index + 1}
  `;

  const countQuery = `
    select count(*)::bigint as count
    from admin.audit_log al
    ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    query<AuditLogEntry>(dataQuery, [...values, pageSize, offset]),
    query<{ count: string }>(countQuery, values),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);

  return {
    entries: dataResult.rows,
    total,
    page,
    pageSize,
    hasMore: offset + dataResult.rows.length < total,
  };
}

export async function getAuditLogFilters(): Promise<AuditLogFilters> {
  const [resourceResult, eventResult, actorResult, systemResult] = await Promise.all([
    query<{ resource_type: string }>(
      `select distinct resource_type from admin.audit_log order by resource_type asc`
    ),
    query<{ event_type: string }>(
      `select distinct event_type from admin.audit_log order by event_type asc`
    ),
    query<{ id: string; display_name: string | null; avatar_url: string | null }>(
      `select distinct u.id, coalesce(u.display_name, '—') as display_name, u.avatar_url
       from admin.audit_log al
       join admin.users u on al.actor_user_id = u.id
       order by display_name asc`
    ),
    query<{ has_system: boolean }>(
      `select exists(select 1 from admin.audit_log where actor_user_id is null) as has_system`
    ),
  ]);

  const actors = actorResult.rows.map((row) => ({
    id: row.id,
    displayName: row.display_name ?? '—',
    avatarUrl: row.avatar_url,
  }));

  if (systemResult.rows[0]?.has_system) {
    actors.unshift({ id: 'system', displayName: 'System', avatarUrl: null });
  }

  return {
    resourceTypes: resourceResult.rows.map((row) => row.resource_type).filter((value) => Boolean(value)),
    eventTypes: eventResult.rows.map((row) => row.event_type).filter((value) => Boolean(value)),
    actors,
  };
}

export async function getAuditLogMetrics(params: { days?: number; heatmapHours?: number } = {}): Promise<AuditLogMetrics> {
  const days = Math.min(Math.max(params.days ?? 30, 1), 180);
  const heatmapHours = Math.min(Math.max(params.heatmapHours ?? 168, 24), 24 * 30);

  const [topEventsResult, topResourcesResult, heatmapResult] = await Promise.all([
    query<{ event_type: string; count: number }>(
      `select event_type, count(*)::int as count
       from admin.audit_log
       where occurred_at >= now() - interval '${days} days'
       group by event_type
       order by count desc
       limit 10`
    ),
    query<{ resource_type: string; count: number }>(
      `select resource_type, count(*)::int as count
       from admin.audit_log
       where occurred_at >= now() - interval '${days} days'
       group by resource_type
       order by count desc
       limit 10`
    ),
    query<{ bucket: string; hour: number; count: number }>(
      `select
         to_char(date_trunc('hour', occurred_at), 'YYYY-MM-DD"T"HH24:00:00Z') as bucket,
         extract(hour from occurred_at)::int as hour,
         count(*)::int as count
       from admin.audit_log
       where occurred_at >= now() - interval '${heatmapHours} hours'
       group by bucket, hour
       order by bucket asc`
    ),
  ]);

  const activityHeatmap = heatmapResult.rows.map((row) => ({
    date: row.bucket.slice(0, 10),
    hour: row.hour,
    count: Number(row.count ?? 0),
  }));

  return {
    topEvents: topEventsResult.rows.map((row) => ({ eventType: row.event_type, count: Number(row.count ?? 0) })),
    topResources: topResourcesResult.rows.map((row) => ({
      resourceType: row.resource_type,
      count: Number(row.count ?? 0),
    })),
    activityHeatmap,
  };
}
