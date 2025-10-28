import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import {
  getTableMetadata,
  listAdminTables,
} from '@/lib/admin/data-service';

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const schema = url.searchParams.get('schema');
    const table = url.searchParams.get('table');

    if (schema && table) {
      const metadata = await getTableMetadata(schema, table);
      return NextResponse.json(metadata);
    }

    const tables = await listAdminTables();
    return NextResponse.json({ tables });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to fetch tables metadata', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
