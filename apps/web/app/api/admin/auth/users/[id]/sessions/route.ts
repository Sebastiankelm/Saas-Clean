import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '../../../../utils';
import { getAdminUserById, listUserSessions } from '@/lib/admin/auth-admin-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminUser();
    await requireAdminUserId(user.id);

    const target = await getAdminUserById(params.id);

    if (!target) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const sessions = await listUserSessions(target.auth_user_id ?? null);

    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list user sessions', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

