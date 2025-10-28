import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import {
  createField,
  listFields,
  type CreateFieldInput,
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

export async function GET(
  _request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    await requireAdminUser();
    const fields = await listFields(params.collectionId);
    return NextResponse.json({ fields });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to load CMS fields', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    await requireAdminUser();
    const payload = fieldSchema.parse(await request.json());
    const field = await createField(params.collectionId, payload as CreateFieldInput);
    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create CMS field', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
