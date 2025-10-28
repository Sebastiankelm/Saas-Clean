import { getSupabaseAdminClient } from '@/lib/db/client';
import { getUser } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

const supabase = getSupabaseAdminClient();
const allowedTasks = new Set(['daily_reports', 'cleanup_invitations', 'sync_billing']);

type AdminTaskRequestBody = {
  task?: string;
  payload?: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: AdminTaskRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Failed to parse admin task request body', error);
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { task, payload } = body ?? {};

  if (!task || !allowedTasks.has(task)) {
    return Response.json({ error: 'Unknown or missing task value' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.functions.invoke('task', {
      body: {
        task,
        payload: payload ?? null,
        triggered_by: user.id,
      },
    });

    if (error) {
      console.error('Failed to invoke Supabase task function', error);
      return Response.json({ error: error.message ?? 'Task invocation failed' }, { status: 502 });
    }

    return Response.json(data ?? { task, status: 'unknown' });
  } catch (error) {
    console.error('Unexpected error while invoking task function', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
