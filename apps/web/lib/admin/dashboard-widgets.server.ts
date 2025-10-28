import { query } from '@/lib/admin/db';

export type WidgetDataResponse =
  | { kind: 'metric'; value: number }
  | { kind: 'chart'; series: { label: string; value: number }[] }
  | { kind: 'table'; rows: Record<string, unknown>[] };

export async function fetchWidgetData(
  definitionKey: string,
  config: Record<string, unknown> | undefined
): Promise<WidgetDataResponse> {
  switch (definitionKey) {
    case 'admin.users.total': {
      const { rows } = await query<{ count: number }>(
        `select count(*)::int as count from admin.users where is_active = true`
      );
      return { kind: 'metric', value: Number(rows[0]?.count ?? 0) };
    }
    case 'cms.entries.total': {
      const status = typeof config?.status === 'string' ? config.status : null;
      const { rows } = await query<{ count: number }>(
        `select count(*)::int as count
         from cms.entries
         where $1::text is null or status = $1::text`,
        [status]
      );
      return { kind: 'metric', value: Number(rows[0]?.count ?? 0) };
    }
    case 'cms.entries.status-distribution': {
      const { rows } = await query<{ status: string; count: number }>(
        `select status, count(*)::int as count
         from cms.entries
         group by status
         order by status asc`
      );
      return {
        kind: 'chart',
        series: rows.map((row) => ({ label: row.status ?? 'unknown', value: Number(row.count ?? 0) })),
      };
    }
    case 'admin.audit.recent': {
      const limit = Number.isFinite(Number(config?.limit)) ? Number(config?.limit) : 10;
      const { rows } = await query<{
        occurred_at: string;
        actor: string | null;
        event_type: string;
        resource_type: string;
        resource_identifier: string | null;
      }>(
        `select
           to_char(al.occurred_at, 'YYYY-MM-DD HH24:MI:SS') as occurred_at,
           coalesce(u.display_name, '—') as actor,
           al.event_type,
           al.resource_type,
           al.resource_identifier
         from admin.audit_log al
         left join admin.users u on al.actor_user_id = u.id
         order by al.occurred_at desc
         limit $1`,
        [Math.min(Math.max(limit, 1), 50)]
      );
      return {
        kind: 'table',
        rows: rows.map((row) => ({
          occurred_at: row.occurred_at,
          actor: row.actor,
          event_type: row.event_type,
          resource: row.resource_identifier
            ? `${row.resource_type}#${row.resource_identifier}`
            : row.resource_type,
        })),
      };
    }
    default:
      return { kind: 'metric', value: 0 };
  }
}
