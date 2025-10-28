import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdminGuardError,
  requireAdminUser,
} from '@/app/api/admin/utils';
import {
  deleteRecord,
  insertRecord,
  updateRecord,
} from '@/lib/admin/data-service';

const baseSchema = z.object({
  schema: z.string().min(1),
  table: z.string().min(1),
});

const createSchema = baseSchema.extend({
  values: z.record(z.any()),
});

const updateSchema = createSchema.extend({
  primaryKey: z.record(z.any()),
});

const deleteSchema = baseSchema.extend({
  primaryKey: z.record(z.any()),
});

export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const payload = createSchema.parse(await request.json());
    const record = await insertRecord({
      schema: payload.schema,
      table: payload.table,
      values: payload.values,
    });

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create record', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser();
    const payload = updateSchema.parse(await request.json());
    const record = await updateRecord({
      schema: payload.schema,
      table: payload.table,
      primaryKey: payload.primaryKey,
      values: payload.values,
    });

    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to update record', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminUser();
    const payload = deleteSchema.parse(await request.json());
    await deleteRecord({
      schema: payload.schema,
      table: payload.table,
      primaryKey: payload.primaryKey,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof AdminGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete record', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
