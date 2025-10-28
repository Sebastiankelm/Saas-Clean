import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '@/app/api/admin/utils';
import {
  deleteEntry,
  getEntry,
  updateEntry,
  type UpdateEntryInput,
} from '@/lib/admin/cms-service';

const updateSchema = z.object({
  locale: z.string().min(1).optional(),
  slug: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional(),
  data: z.record(z.any()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    await requireAdminUser();
    const entry = await getEntry(params.entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS entry', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    const user = await requireAdminUser();
    const payload = updateSchema.parse(await request.json());
    const adminUserId = await requireAdminUserId(user.id);
    const entry = await updateEntry(params.entryId, payload as UpdateEntryInput, adminUserId);
    return NextResponse.json({ entry });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update CMS entry', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    await requireAdminUser();
    await deleteEntry(params.entryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete CMS entry', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
