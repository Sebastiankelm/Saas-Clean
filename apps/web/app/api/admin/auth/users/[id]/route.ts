import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '../../../utils';
import {
  assignRolesToUser,
  clearUserMfaFactors,
  getAdminUserById,
  recordUserAudit,
  resetUserPasswordFlag,
  updateAdminUserStatus,
  updateImpersonationGuard,
} from '@/lib/admin/auth-admin-service';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ban'), reason: z.string().optional() }),
  z.object({ action: z.literal('activate') }),
  z.object({ action: z.literal('reset-password') }),
  z.object({ action: z.literal('reset-mfa') }),
  z.object({ action: z.literal('impersonation-guard'), enabled: z.boolean() }),
  z.object({ action: z.literal('grant-admin'), roleIds: z.array(z.string().uuid()).min(1) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminUser();
    const actorAdminUserId = await requireAdminUserId(user.id);

    const payload = actionSchema.parse(await request.json());

    const targetUserId = params.id;

    switch (payload.action) {
      case 'ban': {
        const before = await getAdminUserById(targetUserId);
        await updateAdminUserStatus(targetUserId, { is_active: false });
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.banned', before, {
          is_active: false,
          reason: payload.reason ?? null,
        });
        break;
      }
      case 'activate': {
        const before = await getAdminUserById(targetUserId);
        await updateAdminUserStatus(targetUserId, { is_active: true });
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.reactivated', before, {
          is_active: true,
        });
        break;
      }
      case 'reset-password': {
        await resetUserPasswordFlag(targetUserId);
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.reset_password', null, null, {
          via: 'forcePasswordReset',
        });
        break;
      }
      case 'reset-mfa': {
        const before = await getAdminUserById(targetUserId);
        await clearUserMfaFactors(before?.auth_user_id ?? null);
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.reset_mfa', before, null);
        break;
      }
      case 'impersonation-guard': {
        await updateImpersonationGuard(targetUserId, payload.enabled);
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.impersonation_guard', null, {
          enabled: payload.enabled,
        });
        break;
      }
      case 'grant-admin': {
        await assignRolesToUser(targetUserId, payload.roleIds, actorAdminUserId);
        await recordUserAudit(actorAdminUserId, targetUserId, 'admin.users.grant_admin', null, {
          roleIds: payload.roleIds,
        });
        break;
      }
      default:
        break;
    }

    const updated = await getAdminUserById(targetUserId);

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to mutate admin user', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

