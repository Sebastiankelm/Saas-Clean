import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
  resolveAdminUserId,
} from '@/app/api/admin/utils';
import {
  getSavedViews,
  upsertSavedView,
} from '@/lib/admin/data-service';

const saveViewSchema = z.object({
  resourceType: z.string().min(1),
  teamId: z.number().int().optional().nullable(),
  view: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    visibility: z.enum(['private', 'team', 'public']).default('private'),
    filters: z.record(z.any()).optional(),
    config: z.record(z.any()).optional(),
  }),
});

export async function GET(request: Request) {
  try {
    const user = await requireAdminUser();
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('resource');
    const teamIdParam = url.searchParams.get('teamId');

    if (!resourceType) {
      return NextResponse.json({ error: 'Missing resource parameter' }, { status: 400 });
    }

    const adminUserId = await resolveAdminUserId(user.id);
    const teamId = teamIdParam ? Number(teamIdParam) : undefined;

    const views = await getSavedViews(
      resourceType,
      adminUserId,
      Number.isNaN(teamId) ? undefined : teamId ?? null
    );

    return NextResponse.json({ views });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to fetch saved views', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    const payload = saveViewSchema.parse(await request.json());
    const adminUserId = await requireAdminUserId(user.id);

    const saved = await upsertSavedView(
      payload.resourceType,
      adminUserId,
      {
        id: payload.view.id,
        name: payload.view.name,
        description: payload.view.description ?? null,
        visibility: payload.view.visibility,
        filters: payload.view.filters ?? {},
        config: payload.view.config ?? {},
      },
      payload.teamId ?? null
    );

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to save view', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
