import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getDashboardById,
  listDashboardWidgets,
  getWidgetLayout,
  updateDashboard,
  canAccessDashboardRecord,
} from '@/lib/admin/dashboards-service';
import {
  resolveDashboardContext,
  ensureDashboardVisibilityAccess,
} from '../utils';
import { AdminGuardError } from '../../utils';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(['private', 'team', 'public']).optional(),
  teamId: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await resolveDashboardContext();
    const dashboard = await getDashboardById(params.id);

    if (!dashboard) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    if (
      !canAccessDashboardRecord({
        dashboard,
        adminUserId: context.adminUserId,
        teamIds: context.teamIds,
        includePublic: true,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [widgets, layout] = await Promise.all([
      listDashboardWidgets(params.id),
      getWidgetLayout(params.id, context.adminUserId, 'desktop'),
    ]);

    return NextResponse.json({ dashboard, widgets, layout: layout ?? [] });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load dashboard', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await resolveDashboardContext();
    const dashboard = await getDashboardById(params.id);

    if (!dashboard) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    if (
      !canAccessDashboardRecord({
        dashboard,
        adminUserId: context.adminUserId,
        teamIds: context.teamIds,
        includePublic: true,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = updateSchema.parse(await request.json());

    const nextVisibility = payload.visibility ?? dashboard.visibility;
    const nextTeamId =
      nextVisibility === 'team'
        ? payload.teamId ?? dashboard.team_id
        : null;

    ensureDashboardVisibilityAccess(nextVisibility, nextTeamId, context.teamIds);

    const updated = await updateDashboard(params.id, {
      slug: payload.slug,
      title: payload.title,
      description: payload.description,
      visibility: nextVisibility,
      teamId: nextTeamId,
      metadata: payload.metadata,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json({ dashboard: updated });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    console.error('Failed to update dashboard', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
