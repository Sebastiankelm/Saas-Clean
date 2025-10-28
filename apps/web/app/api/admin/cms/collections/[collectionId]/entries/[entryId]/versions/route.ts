import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import { listEntryVersions } from '@/lib/admin/cms-service';

export async function GET(
  _request: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    await requireAdminUser();
    const versions = await listEntryVersions(params.entryId);
    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS entry versions', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
