import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import { queryTableData, type QueryRequest } from '@/lib/admin/data-service';

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const body = (await request.json()) as QueryRequest;

    if (!body?.schema || !body?.table) {
      return NextResponse.json(
        { error: 'Missing schema or table' },
        { status: 400 }
      );
    }

    const result = await queryTableData(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to query table data', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
