import { NextResponse } from 'next/server';
import {
  AdminGuardError,
  requireAdminUser,
  resolveAdminUserId,
} from '../../utils';
import { recordAuditEvent } from '@/lib/admin/audit-log-service';
import { getSupabaseAdminClient } from '@/lib/db/client';

export async function GET(request: Request) {
  try {
    const user = await requireAdminUser();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    const actorAdminUserId = await resolveAdminUserId(user.id);
    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;

    await recordAuditEvent({
      actorAdminUserId,
      eventType: 'storage.buckets.list',
      resourceType: 'storage.bucket',
      resourceIdentifier: null,
      ipAddress,
    });

    return NextResponse.json({ buckets: data ?? [] });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list storage buckets', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
