import { AdminGuardError, requireAdminUser, requireAdminUserId } from '@/app/api/admin/utils';
import type { User } from '@/lib/db/schema';
import { query } from '@/lib/admin/db';

export type AdminDashboardContext = {
  user: User;
  adminUserId: string;
  teamIds: number[];
};

export async function resolveDashboardContext(): Promise<AdminDashboardContext> {
  const user = await requireAdminUser();
  const adminUserId = await requireAdminUserId(user.id);
  const teamIds = await getTeamIdsForUser(user.id);

  return { user, adminUserId, teamIds };
}

export async function getTeamIdsForUser(userId: number): Promise<number[]> {
  const { rows } = await query<{ team_id: number }>(
    `select team_id
     from public.team_members
     where user_id = $1`,
    [userId]
  );

  return rows.map((row) => row.team_id);
}

export type TeamSummary = {
  id: number;
  name: string;
};

export async function getTeamsForUser(teamIds: number[]): Promise<TeamSummary[]> {
  if (!teamIds.length) {
    return [];
  }

  const { rows } = await query<TeamSummary>(
    `select id, name
     from public.teams
     where id = any($1::bigint[])
     order by name asc`,
    [teamIds]
  );

  return rows;
}

export function ensureDashboardVisibilityAccess(
  visibility: string,
  teamId: number | null,
  teamIds: number[]
) {
  if (visibility === 'team' && (!teamId || !teamIds.includes(teamId))) {
    throw new AdminGuardError('Forbidden', 403);
  }

  if (visibility !== 'team' && teamId !== null) {
    throw new AdminGuardError('Invalid team assignment', 400);
  }
}
