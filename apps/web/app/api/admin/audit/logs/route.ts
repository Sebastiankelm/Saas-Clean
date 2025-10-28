import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '../../utils';
import {
  getAuditLogFilters,
  searchAuditLogs,
} from '@/lib/admin/audit-log-service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  resourceType: z.string().min(1).optional(),
  resourceIdentifier: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  start: z.string().min(1).optional(),
  end: z.string().min(1).optional(),
});

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date;
}

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      resourceType: url.searchParams.get('resourceType') || undefined,
      resourceIdentifier: url.searchParams.get('resourceIdentifier') || undefined,
      eventType: url.searchParams.get('eventType') || undefined,
      actorId: url.searchParams.get('actorId') || undefined,
      search: url.searchParams.get('search') || undefined,
      start: url.searchParams.get('start') || undefined,
      end: url.searchParams.get('end') || undefined,
    });

    const start = parseDate(parsed.start);
    const end = parseDate(parsed.end);
    const actorId = parsed.actorId?.trim();

    const [result, filters] = await Promise.all([
      searchAuditLogs({
        resourceType: parsed.resourceType ?? null,
        resourceIdentifier: parsed.resourceIdentifier ?? null,
        eventType: parsed.eventType ?? null,
        actorUserId:
          actorId && actorId !== 'system'
            ? actorId
            : null,
        actorIsNull: actorId === 'system',
        search: parsed.search ?? null,
        start,
        end,
        page: parsed.page,
        pageSize: parsed.pageSize,
      }),
      getAuditLogFilters(),
    ]);

    return NextResponse.json({
      ...result,
      filters,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to search audit logs', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
