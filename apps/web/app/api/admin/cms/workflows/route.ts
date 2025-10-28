import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminGuardError, requireAdminUser } from '@/app/api/admin/utils';
import { getSupabaseAdminClient } from '@/lib/db/client';

const triggerSchema = z.object({
  functionName: z.string().min(1).default('task'),
  event: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = triggerSchema.parse(await request.json());

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.functions.invoke(payload.functionName, {
      body: {
        type: 'cms.workflow.manualTrigger',
        payload: payload.event ?? {},
      },
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to trigger workflow', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
