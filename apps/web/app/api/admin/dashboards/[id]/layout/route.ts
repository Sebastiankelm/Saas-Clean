import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getDashboardById,
  canAccessDashboardRecord,
  upsertWidgetLayout,
  getWidgetLayout,
} from '@/lib/admin/dashboards-service';
import { resolveDashboardContext } from '../../utils';
import { AdminGuardError } from '../../../utils';

export const dynamic = 'force-dynamic';

const layoutItemSchema = z.object({
  i: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  minW: z.number().int().positive().optional(),
  minH: z.number().int().positive().optional(),
  maxW: z.number().int().positive().optional(),
  maxH: z.number().int().positive().optional(),
});

const layoutSchema = z.object({
  viewport: z.string().min(1).default('desktop'),
  layout: z.array(layoutItemSchema),
});

export async function PUT(
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

    const payload = layoutSchema.parse(await request.json());

    await upsertWidgetLayout(params.id, context.adminUserId, {
      viewport: payload.viewport,
      layout: payload.layout,
    });

    const layout = await getWidgetLayout(params.id, context.adminUserId, payload.viewport);

    return NextResponse.json({ layout: layout ?? [] });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    console.error('Failed to update widget layout', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
