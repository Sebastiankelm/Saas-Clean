import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '../../utils';
import { getAuditLogMetrics } from '@/lib/admin/audit-log-service';

const paramsSchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
  heatmapHours: z.coerce.number().int().min(24).max(720).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const parsed = paramsSchema.parse({
      days: url.searchParams.get('days') ?? undefined,
      heatmapHours: url.searchParams.get('heatmapHours') ?? undefined,
    });

    const metrics = await getAuditLogMetrics(parsed);

    return NextResponse.json(metrics);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load audit metrics', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
