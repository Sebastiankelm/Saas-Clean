import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import {
  getCollectionById,
  updateCollection,
  type UpdateCollectionInput,
} from '@/lib/admin/cms-service';

const updateSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isSingleton: z.boolean().optional(),
  defaultLocale: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    await requireAdminUser();
    const collection = await getCollectionById(params.collectionId);

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    return NextResponse.json({ collection });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS collection', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    await requireAdminUser();
    const payload = updateSchema.parse(await request.json());

    const updated = await updateCollection(params.collectionId, payload as UpdateCollectionInput);
    return NextResponse.json({ collection: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update CMS collection', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
