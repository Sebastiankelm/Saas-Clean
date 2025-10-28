import { getUser } from '@/lib/db/queries';
import { query } from '@/lib/admin/db';

export class AdminGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminGuardError';
    this.status = status;
  }
}

export async function requireAdminUser() {
  const user = await getUser();

  if (!user) {
    throw new AdminGuardError('Unauthorized', 401);
  }

  if (user.role !== 'admin') {
    throw new AdminGuardError('Forbidden', 403);
  }

  return user;
}

export async function resolveAdminUserId(appUserId: number) {
  const result = await query<{ id: string }>(
    `select id from admin.users where app_user_id = $1 limit 1`,
    [appUserId]
  );

  return result.rows[0]?.id ?? null;
}

export async function requireAdminUserId(appUserId: number) {
  const adminUserId = await resolveAdminUserId(appUserId);

  if (!adminUserId) {
    throw new Error('Admin user profile not provisioned for current user');
  }

  return adminUserId;
}
