import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
import type { Database } from '../../types.ts';

type TaskName = 'daily_reports' | 'cleanup_invitations' | 'sync_billing';
type TaskPayload = Record<string, unknown> | null | undefined;
type TaskResult = Record<string, unknown>;

type TaskContext = {
  supabase: SupabaseClient<Database>;
  now: Date;
  payload: TaskPayload;
};

type TaskHandler = (context: TaskContext) => Promise<TaskResult>;

const FUNCTION_NAME = 'task';
const DEFAULT_HEADERS = { 'content-type': 'application/json' } as const;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase environment variables are not configured.');
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  {
    maxRetries = 3,
    baseDelayMs = 250,
    maxDelayMs = 2_000,
    onRetry,
  }: RetryOptions = {}
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      onRetry?.(error, attempt + 1, delay);
      console.warn(
        `Task execution failed (attempt ${attempt + 1}). Retrying in ${delay}ms`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown task failure');
}

async function logFunctionRun(entry: {
  taskName: TaskName;
  status: 'success' | 'failure';
  message: string;
  metadata?: Record<string, unknown> | null;
  triggeredBy?: number | null;
}) {
  const { error } = await supabase.from('function_logs').insert({
    function_name: FUNCTION_NAME,
    task_name: entry.taskName,
    status: entry.status,
    message: entry.message,
    metadata: entry.metadata ?? null,
    triggered_by: entry.triggeredBy ?? null,
  });

  if (error) {
    console.error('Failed to persist function log entry', error);
  }
}

const tasks: Record<TaskName, TaskHandler> = {
  async daily_reports({ supabase: client, now }) {
    const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();

    const [{ data: newUsers, error: newUsersError }, { count: pendingInvitationCount, error: pendingInvitesError }] = await Promise.all([
      client
        .from('users')
        .select('id, created_at')
        .gte('created_at', oneDayAgo),
      client
        .from('invitations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    if (newUsersError) {
      throw newUsersError;
    }

    if (pendingInvitesError) {
      throw pendingInvitesError;
    }

    return {
      generatedAt: now.toISOString(),
      newUserCount: newUsers?.length ?? 0,
      pendingInvitations: pendingInvitationCount ?? 0,
    } satisfies TaskResult;
  },
  async cleanup_invitations({ supabase: client, now }) {
    const expirationThreshold = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    const { data, error } = await client
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('status', 'pending')
      .lt('invited_at', expirationThreshold)
      .select('id, email');

    if (error) {
      throw error;
    }

    return {
      revokedCount: data?.length ?? 0,
      revokedInvitationIds: data?.map((invitation) => invitation.id) ?? [],
      cutoff: expirationThreshold,
    } satisfies TaskResult;
  },
  async sync_billing({ supabase: client }) {
    const { error: refreshError } = await client.rpc('refresh_team_views');
    if (refreshError) {
      throw refreshError;
    }

    const { data: subscriptions, error: subscriptionError } = await client
      .from('subscriptions')
      .select('id, status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (subscriptionError) {
      throw subscriptionError;
    }

    return {
      refreshed: true,
      lastSubscription: subscriptions?.[0] ?? null,
    } satisfies TaskResult;
  },
};

function isTaskName(value: unknown): value is TaskName {
  return value === 'daily_reports' || value === 'cleanup_invitations' || value === 'sync_billing';
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: DEFAULT_HEADERS,
    });
  }

  let body: { task?: unknown; payload?: TaskPayload; triggered_by?: unknown };
  try {
    body = await req.json();
  } catch (error) {
    console.error('Failed to parse request payload', error);
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: DEFAULT_HEADERS,
    });
  }

  const { task, payload, triggered_by: triggeredBy } = body ?? {};

  if (!isTaskName(task)) {
    return new Response(JSON.stringify({ error: 'Unknown or missing task parameter' }), {
      status: 400,
      headers: DEFAULT_HEADERS,
    });
  }

  const now = new Date();
  const taskContext: TaskContext = {
    supabase,
    now,
    payload: payload ?? null,
  };

  try {
    const result = await retryWithBackoff(() => tasks[task](taskContext), {
      onRetry: (error, attempt, delayMs) => {
        console.warn(`Retrying task "${task}" (attempt ${attempt + 1}) in ${delayMs}ms`, error);
      },
    });

    await logFunctionRun({
      taskName: task,
      status: 'success',
      message: `${task} completed successfully`,
      metadata: { result },
      triggeredBy: typeof triggeredBy === 'number' ? triggeredBy : null,
    });

    return new Response(
      JSON.stringify({
        task,
        status: 'success',
        result,
      }),
      {
        status: 200,
        headers: DEFAULT_HEADERS,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown task error';

    await logFunctionRun({
      taskName: task,
      status: 'failure',
      message,
      metadata: {
        payload: payload ?? null,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error ?? null,
      },
      triggeredBy: typeof triggeredBy === 'number' ? triggeredBy : null,
    });

    console.error(`Task "${task}" failed`, error);

    return new Response(
      JSON.stringify({
        task,
        status: 'failure',
        error: message,
      }),
      {
        status: 500,
        headers: DEFAULT_HEADERS,
      }
    );
  }
});
