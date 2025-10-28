import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  resolveAdminUserId,
} from '../utils';
import { recordAuditEvent } from '@/lib/admin/audit-log-service';
import { getSupabaseAdminClient } from '@/lib/db/client';

const listSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['name', 'created_at', 'updated_at', 'last_accessed_at']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const uploadSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().optional(),
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  data: z.string().min(1),
});

function normalizePath(path: string | undefined) {
  if (!path) {
    return '';
  }

  return path
    .split('/')
    .filter((segment) => segment.length)
    .join('/');
}

export async function GET(request: Request) {
  try {
    const user = await requireAdminUser();
    const url = new URL(request.url);
    const query = listSchema.parse({
      bucket: url.searchParams.get('bucket') || undefined,
      path: url.searchParams.get('path') || undefined,
      search: url.searchParams.get('search') || undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      sort: url.searchParams.get('sort') || undefined,
      order: url.searchParams.get('order') || undefined,
    });

    const supabase = getSupabaseAdminClient();
    const listPath = normalizePath(query.path);
    const offset = (query.page - 1) * query.limit;

    const { data, error } = await supabase.storage.from(query.bucket).list(listPath, {
      limit: query.limit,
      offset,
      sortBy: {
        column: query.sort ?? 'name',
        order: query.order ?? 'asc',
      },
      search: query.search && query.search.length ? query.search : undefined,
    });

    if (error) {
      throw error;
    }

    const hasMore = Array.isArray(data) ? data.length === query.limit : false;
    const actorAdminUserId = await resolveAdminUserId(user.id);
    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;

    await recordAuditEvent({
      actorAdminUserId,
      eventType: 'storage.objects.list',
      resourceType: 'storage.bucket',
      resourceIdentifier: query.bucket,
      metadata: {
        path: listPath,
        search: query.search ?? null,
        page: query.page,
        limit: query.limit,
        sort: query.sort ?? 'name',
        order: query.order ?? 'asc',
      },
      ipAddress,
    });

    return NextResponse.json({
      bucket: query.bucket,
      path: listPath,
      page: query.page,
      pageSize: query.limit,
      hasMore,
      search: query.search ?? null,
      objects: data ?? [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list storage objects', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    const payload = uploadSchema.parse(await request.json());
    const adminUserId = await resolveAdminUserId(user.id);

    const supabase = getSupabaseAdminClient();
    const [, base64Data = payload.data] = payload.data.split(',');
    const buffer = Buffer.from(base64Data, 'base64');
    const normalizedPath = normalizePath(payload.path);
    const storagePath = normalizedPath ? `${normalizedPath}/${payload.fileName}` : payload.fileName;

    const { error } = await supabase.storage.from(payload.bucket).upload(storagePath, buffer, {
      contentType: payload.contentType ?? 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;

    await recordAuditEvent({
      actorAdminUserId: adminUserId,
      eventType: 'storage.objects.upload',
      resourceType: 'storage.bucket',
      resourceIdentifier: `${payload.bucket}:${storagePath}`,
      newValues: {
        bucket: payload.bucket,
        path: storagePath,
        contentType: payload.contentType ?? null,
        sizeBytes: buffer.length,
      },
      metadata: {
        originalFileName: payload.fileName,
      },
      ipAddress,
    });

    return NextResponse.json({
      bucket: payload.bucket,
      path: storagePath,
      size: buffer.length,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to upload storage object', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
