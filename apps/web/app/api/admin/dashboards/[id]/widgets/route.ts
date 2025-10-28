import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getDashboardById,
  canAccessDashboardRecord,
  replaceDashboardWidgets,
  listDashboardWidgets,
} from '@/lib/admin/dashboards-service';
import { resolveDashboardContext } from '../../utils';
import { AdminGuardError } from '../../../utils';

export const dynamic = 'force-dynamic';

const widgetSchema = z.object({
  widgetKey: z.string().min(1),
  widgetType: z.string().min(1),
  config: z.record(z.any()).default({}),
  position: z.number().int().nonnegative(),
});

const updateWidgetsSchema = z.object({
  widgets: z.array(widgetSchema),
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

    const payload = updateWidgetsSchema.parse(await request.json());

    await replaceDashboardWidgets(
      params.id,
      payload.widgets.map((widget) => ({
        widgetKey: widget.widgetKey,
        widgetType: widget.widgetType,
        config: widget.config ?? {},
        position: widget.position,
      }))
    );

    const widgets = await listDashboardWidgets(params.id);

    return NextResponse.json({ widgets });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    console.error('Failed to update dashboard widgets', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
