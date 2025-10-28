import { NextResponse } from 'next/server';
import { AdminGuardError, requireAdminUser, requireAdminUserId } from '../../utils';
import { fetchAdminRoles } from '@/lib/admin/auth-admin-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAdminUser();
    await requireAdminUserId(user.id);

    const roles = await fetchAdminRoles();

    return NextResponse.json({ roles });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list admin roles', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

