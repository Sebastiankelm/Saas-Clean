import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '@/app/api/admin/utils';
import {
  createEntry,
  listEntries,
  type CreateEntryInput,
  type ListEntriesOptions,
} from '@/lib/admin/cms-service';

const createEntrySchema = z.object({
  locale: z.string().min(1),
  slug: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  data: z.record(z.any()).optional(),
});

const querySchema = z.object({
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  locale: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    await requireAdminUser();
    const url = new URL(request.url);
    const query = querySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      locale: url.searchParams.get('locale') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });

    const entries = await listEntries(params.collectionId, query as ListEntriesOptions);
    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS entries', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const user = await requireAdminUser();
    const payload = createEntrySchema.parse(await request.json());
    const adminUserId = await requireAdminUserId(user.id);

    const entry = await createEntry(
      params.collectionId,
      payload as CreateEntryInput,
      adminUserId
    );

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create CMS entry', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
