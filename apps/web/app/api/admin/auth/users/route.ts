import { NextResponse } from 'next/server';
import { requireAdminUser, requireAdminUserId, AdminGuardError } from '../../utils';
import { listAdminUsers } from '@/lib/admin/auth-admin-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAdminUser();
    await requireAdminUserId(user.id);

    const users = await listAdminUsers();

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list admin users', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

