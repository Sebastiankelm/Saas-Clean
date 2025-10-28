import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listDashboardsForAdmin,
  createDashboard,
} from '@/lib/admin/dashboards-service';
import {
  resolveDashboardContext,
  getTeamsForUser,
  ensureDashboardVisibilityAccess,
} from './utils';
import { AdminGuardError } from '../utils';

export const dynamic = 'force-dynamic';

const createDashboardSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  teamId: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export async function GET() {
  try {
    const context = await resolveDashboardContext();
    const [dashboards, teams] = await Promise.all([
      listDashboardsForAdmin(context.adminUserId, context.teamIds, true),
      getTeamsForUser(context.teamIds),
    ]);

    return NextResponse.json({ dashboards, teams });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list dashboards', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await resolveDashboardContext();
    const payload = createDashboardSchema.parse(await request.json());

    ensureDashboardVisibilityAccess(payload.visibility, payload.teamId ?? null, context.teamIds);

    const dashboard = await createDashboard({
      slug: payload.slug,
      title: payload.title,
      description: payload.description ?? null,
      visibility: payload.visibility,
      teamId: payload.visibility === 'team' ? payload.teamId ?? null : null,
      metadata: payload.metadata ?? {},
      ownerUserId: context.adminUserId,
    });

    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    console.error('Failed to create dashboard', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
