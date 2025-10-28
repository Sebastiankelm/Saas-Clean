import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '@/app/api/admin/utils';
import { removeSavedView } from '@/lib/admin/data-service';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminUser();
    const adminUserId = await requireAdminUserId(user.id);
    const viewId = params.id;

    if (!viewId) {
      return NextResponse.json({ error: 'Missing view identifier' }, { status: 400 });
    }

    await removeSavedView(viewId, adminUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete saved view', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
