import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
  requireAdminUserId,
} from '@/app/api/admin/utils';
import {
  createCollection,
  listCollections,
  type CreateCollectionInput,
} from '@/lib/admin/cms-service';

const fieldSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.string().min(1),
  description: z.string().optional().nullable(),
  config: z.record(z.any()).optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  position: z.number().int().optional(),
});

const createCollectionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isSingleton: z.boolean().optional(),
  defaultLocale: z.string().optional(),
  fields: z.array(fieldSchema).optional(),
});

export async function GET() {
  try {
    await requireAdminUser();
    const collections = await listCollections();
    return NextResponse.json({ collections });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS collections', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    const payload = createCollectionSchema.parse(await request.json());
    const adminUserId = await requireAdminUserId(user.id);

    const created = await createCollection(payload as CreateCollectionInput, adminUserId);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create CMS collection', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
