import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchWidgetData } from '@/lib/admin/dashboard-widgets.server';
import { resolveDashboardContext } from '../utils';
import { AdminGuardError } from '../../utils';

export const dynamic = 'force-dynamic';

const widgetDataSchema = z.object({
  definitionKey: z.string().min(1),
  config: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    await resolveDashboardContext();
    const payload = widgetDataSchema.parse(await request.json());
    const data = await fetchWidgetData(payload.definitionKey, payload.config ?? {});
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    console.error('Failed to load widget data', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
