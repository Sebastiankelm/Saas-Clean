import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '@/app/api/admin/utils';
import {
  createMediaRecord,
  listMedia,
} from '@/lib/admin/cms-service';
import { getSupabaseAdminClient } from '@/lib/db/client';

const listSchema = z.object({
  bucket: z.string().min(1).default('cms'),
  path: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  collectionId: z.string().uuid().optional(),
});

const uploadSchema = z.object({
  bucket: z.string().min(1).default('cms'),
  path: z.string().optional().nullable(),
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  data: z.string().min(1),
  collectionId: z.string().uuid().optional(),
  title: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

const deleteSchema = z.object({
  bucket: z.string().min(1).default('cms'),
  paths: z.array(z.string().min(1)).min(1),
});

export async function GET(request: Request) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const query = listSchema.parse({
      bucket: url.searchParams.get('bucket') ?? undefined,
      path: url.searchParams.get('path') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      collectionId: url.searchParams.get('collectionId') ?? undefined,
    });

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(query.bucket)
      .list(query.path ?? '', {
        limit: query.limit,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      throw error;
    }

    const records = await listMedia(query.collectionId ?? null);

    return NextResponse.json({ objects: data, records });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to list media assets', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    const payload = uploadSchema.parse(await request.json());
    const adminUserId = await requireAdminUserId(user.id);

    const supabase = getSupabaseAdminClient();
    const [, base64Payload = payload.data] = payload.data.split(',');
    const buffer = Buffer.from(base64Payload, 'base64');
    const storagePath = payload.path
      ? `${payload.path.replace(/\/+$/u, '')}/${payload.fileName}`
      : payload.fileName;

    const { error } = await supabase.storage
      .from(payload.bucket)
      .upload(storagePath, buffer, {
        contentType: payload.contentType ?? 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const record = await createMediaRecord({
      collectionId: payload.collectionId ?? null,
      title: payload.title ?? null,
      fileName: payload.fileName,
      storagePath: `${payload.bucket}/${storagePath}`,
      mimeType: payload.contentType ?? null,
      sizeBytes: buffer.length,
      metadata: payload.metadata ?? {},
      createdBy: adminUserId,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to upload media asset', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminUser();
    const payload = deleteSchema.parse(await request.json());

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from(payload.bucket).remove(payload.paths);
    if (error) {
      throw error;
    }

    return NextResponse.json({ removed: payload.paths });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete media asset', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
