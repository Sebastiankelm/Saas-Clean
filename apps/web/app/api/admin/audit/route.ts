import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import { getAuditLogs } from '@/lib/admin/data-service';

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('resourceType');
    const resourceId = url.searchParams.get('resourceId');
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '25');

    if (!resourceType) {
      return NextResponse.json({ error: 'Missing resourceType parameter' }, { status: 400 });
    }

    const result = await getAuditLogs(
      resourceType,
      resourceId,
      Number.isNaN(page) ? 1 : page,
      Number.isNaN(pageSize) ? 25 : pageSize
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to fetch audit logs', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
