import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import { deleteField, updateField, type UpdateFieldInput } from '@/lib/admin/cms-service';

const updateSchema = z.object({
  fieldKey: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  fieldType: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  config: z.record(z.any()).optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { fieldId: string } }
) {
  try {
    await requireAdminUser();
    const payload = updateSchema.parse(await request.json());
    const field = await updateField(params.fieldId, payload as UpdateFieldInput);
    return NextResponse.json({ field });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update CMS field', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { fieldId: string } }
) {
  try {
    await requireAdminUser();
    await deleteField(params.fieldId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete CMS field', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
