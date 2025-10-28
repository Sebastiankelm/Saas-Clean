import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '../../../../../utils';
import {
  getAdminUserById,
  invalidateSession,
  recordUserAudit,
} from '@/lib/admin/auth-admin-service';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const user = await requireAdminUser();
    const actorAdminUserId = await requireAdminUserId(user.id);

    const target = await getAdminUserById(params.id);
    if (!target) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    await invalidateSession(params.sessionId);

    await recordUserAudit(actorAdminUserId, params.id, 'admin.users.session_revoked', null, {
      sessionId: params.sessionId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to revoke session', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

