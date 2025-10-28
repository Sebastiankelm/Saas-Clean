import { z } from 'zod';
import { query, withClient } from '@/lib/admin/db';
import { getSupabaseAdminClient } from '@/lib/db/client';

export const collectionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  is_singleton: z.boolean(),
  default_locale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CmsCollection = z.infer<typeof collectionSchema>;

export const fieldSchema = z.object({
  id: z.string().uuid(),
  collection_id: z.string().uuid(),
  field_key: z.string(),
  label: z.string(),
  field_type: z.string(),
  description: z.string().nullable(),
  config: z.record(z.any()),
  is_required: z.boolean(),
  is_unique: z.boolean(),
  position: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CmsField = z.infer<typeof fieldSchema>;

export const entrySchema = z.object({
  id: z.string().uuid(),
  collection_id: z.string().uuid(),
  status: z.enum(['draft', 'review', 'published', 'archived']),
  locale: z.string(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  data: z.record(z.any()),
  published_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CmsEntry = z.infer<typeof entrySchema>;

export const entryVersionSchema = z.object({
  id: z.number().int(),
  entry_id: z.string().uuid(),
  version_number: z.number().int(),
  snapshot: z.record(z.any()),
  created_by: z.string().nullable(),
  created_at: z.string(),
});

export type CmsEntryVersion = z.infer<typeof entryVersionSchema>;

export const mediaSchema = z.object({
  id: z.string().uuid(),
  collection_id: z.string().uuid().nullable(),
  title: z.string().nullable(),
  file_name: z.string(),
  storage_path: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().int().nullable(),
  metadata: z.record(z.any()),
  created_by: z.string().nullable(),
  created_at: z.string(),
});

export type CmsMedia = z.infer<typeof mediaSchema>;

export type CreateCollectionInput = {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  isSingleton?: boolean;
  defaultLocale?: string;
  fields?: Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    description?: string | null;
    config?: Record<string, unknown>;
    isRequired?: boolean;
    isUnique?: boolean;
    position?: number;
  }>;
};

export type UpdateCollectionInput = Partial<CreateCollectionInput>;

export type CreateFieldInput = {
  fieldKey: string;
  label: string;
  fieldType: string;
  description?: string | null;
  config?: Record<string, unknown>;
  isRequired?: boolean;
  isUnique?: boolean;
  position?: number;
};

export type UpdateFieldInput = Partial<CreateFieldInput>;

export type CreateEntryInput = {
  locale: string;
  slug?: string | null;
  title?: string | null;
  status?: 'draft' | 'review' | 'published' | 'archived';
  data?: Record<string, unknown>;
};

export type UpdateEntryInput = Partial<CreateEntryInput>;

export type ListEntriesOptions = {
  status?: 'draft' | 'review' | 'published' | 'archived';
  locale?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

async function triggerCmsWorkflow(event: {
  collectionId: string;
  entryId: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  version?: number;
  action: 'status_change' | 'update' | 'create';
}) {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.functions.invoke('task', {
      body: {
        type: 'cms.workflow',
        payload: event,
      },
    });
  } catch (error) {
    console.error('Failed to trigger CMS workflow edge function', error);
  }
}

export async function listCollections(): Promise<CmsCollection[]> {
  const { rows } = await query<CmsCollection>(
    `select id, slug, name, description, icon, is_singleton, default_locale, created_at, updated_at
     from cms.collections
     order by name asc`
  );
  return rows.map((row) => collectionSchema.parse(row));
}

export async function getCollectionById(id: string): Promise<CmsCollection | null> {
  const { rows } = await query<CmsCollection>(
    `select id, slug, name, description, icon, is_singleton, default_locale, created_at, updated_at
     from cms.collections
     where id = $1
     limit 1`,
    [id]
  );
  const record = rows[0];
  return record ? collectionSchema.parse(record) : null;
}

export async function createCollection(
  input: CreateCollectionInput,
  adminUserId: string
): Promise<{ collection: CmsCollection; fields: CmsField[] }>
{
  return withClient(async (client) => {
    await client.query('begin');
    try {
      const { rows: collectionRows } = await client.query<CmsCollection>(
        `insert into cms.collections (slug, name, description, icon, is_singleton, default_locale, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, slug, name, description, icon, is_singleton, default_locale, created_at, updated_at`,
        [
          input.slug,
          input.name,
          input.description ?? null,
          input.icon ?? null,
          input.isSingleton ?? false,
          input.defaultLocale ?? 'en',
          adminUserId,
        ]
      );

      const collection = collectionSchema.parse(collectionRows[0]);
      const fields: CmsField[] = [];

      const payloadFields = input.fields ?? [];
      for (let index = 0; index < payloadFields.length; index += 1) {
        const field = payloadFields[index];
        const { rows: fieldRows } = await client.query<CmsField>(
          `insert into cms.fields
             (collection_id, field_key, label, field_type, description, config, is_required, is_unique, position)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning id, collection_id, field_key, label, field_type, description, config, is_required, is_unique, position, created_at, updated_at`,
          [
            collection.id,
            field.fieldKey,
            field.label,
            field.fieldType,
            field.description ?? null,
            JSON.stringify(field.config ?? {}),
            field.isRequired ?? false,
            field.isUnique ?? false,
            field.position ?? index,
          ]
        );
        fields.push(fieldSchema.parse({ ...fieldRows[0], config: fieldRows[0].config ?? {} }));
      }

      await client.query('commit');
      return { collection, fields };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export async function updateCollection(
  id: string,
  input: UpdateCollectionInput
): Promise<CmsCollection> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.slug !== undefined) {
    assignments.push(`slug = $${values.length + 1}`);
    values.push(input.slug);
  }
  if (input.name !== undefined) {
    assignments.push(`name = $${values.length + 1}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    assignments.push(`description = $${values.length + 1}`);
    values.push(input.description ?? null);
  }
  if (input.icon !== undefined) {
    assignments.push(`icon = $${values.length + 1}`);
    values.push(input.icon ?? null);
  }
  if (input.isSingleton !== undefined) {
    assignments.push(`is_singleton = $${values.length + 1}`);
    values.push(input.isSingleton);
  }
  if (input.defaultLocale !== undefined) {
    assignments.push(`default_locale = $${values.length + 1}`);
    values.push(input.defaultLocale);
  }
  assignments.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await query<CmsCollection>(
    `update cms.collections
     set ${assignments.join(', ')}
     where id = $${values.length}
     returning id, slug, name, description, icon, is_singleton, default_locale, created_at, updated_at`,
    values
  );

  if (!rows[0]) {
    throw new Error('Collection not found');
  }

  return collectionSchema.parse(rows[0]);
}

export async function listFields(collectionId: string): Promise<CmsField[]> {
  const { rows } = await query<CmsField>(
    `select id, collection_id, field_key, label, field_type, description, config, is_required, is_unique, position, created_at, updated_at
     from cms.fields
     where collection_id = $1
     order by position asc, created_at asc`,
    [collectionId]
  );

  return rows.map((row) =>
    fieldSchema.parse({
      ...row,
      config: row.config ?? {},
    })
  );
}

export async function createField(
  collectionId: string,
  input: CreateFieldInput
): Promise<CmsField> {
  const { rows } = await query<CmsField>(
    `insert into cms.fields (collection_id, field_key, label, field_type, description, config, is_required, is_unique, position)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, collection_id, field_key, label, field_type, description, config, is_required, is_unique, position, created_at, updated_at`,
    [
      collectionId,
      input.fieldKey,
      input.label,
      input.fieldType,
      input.description ?? null,
      JSON.stringify(input.config ?? {}),
      input.isRequired ?? false,
      input.isUnique ?? false,
      input.position ?? 0,
    ]
  );

  const record = rows[0];
  if (!record) {
    throw new Error('Failed to create field');
  }

  return fieldSchema.parse({ ...record, config: record.config ?? {} });
}

export async function updateField(fieldId: string, input: UpdateFieldInput): Promise<CmsField> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.fieldKey !== undefined) {
    assignments.push(`field_key = $${assignments.length + 1}`);
    values.push(input.fieldKey);
  }
  if (input.label !== undefined) {
    assignments.push(`label = $${assignments.length + 1}`);
    values.push(input.label);
  }
  if (input.fieldType !== undefined) {
    assignments.push(`field_type = $${assignments.length + 1}`);
    values.push(input.fieldType);
  }
  if (input.description !== undefined) {
    assignments.push(`description = $${assignments.length + 1}`);
    values.push(input.description ?? null);
  }
  if (input.config !== undefined) {
    assignments.push(`config = $${assignments.length + 1}`);
    values.push(JSON.stringify(input.config ?? {}));
  }
  if (input.isRequired !== undefined) {
    assignments.push(`is_required = $${assignments.length + 1}`);
    values.push(input.isRequired);
  }
  if (input.isUnique !== undefined) {
    assignments.push(`is_unique = $${assignments.length + 1}`);
    values.push(input.isUnique);
  }
  if (input.position !== undefined) {
    assignments.push(`position = $${assignments.length + 1}`);
    values.push(input.position);
  }

  assignments.push(`updated_at = now()`);
  values.push(fieldId);

  const { rows } = await query<CmsField>(
    `update cms.fields
     set ${assignments.join(', ')}
     where id = $${values.length}
     returning id, collection_id, field_key, label, field_type, description, config, is_required, is_unique, position, created_at, updated_at`,
    values
  );

  if (!rows[0]) {
    throw new Error('Field not found');
  }

  return fieldSchema.parse({ ...rows[0], config: rows[0].config ?? {} });
}

export async function deleteField(fieldId: string): Promise<void> {
  await query('delete from cms.fields where id = $1', [fieldId]);
}

export async function listEntries(
  collectionId: string,
  options: ListEntriesOptions = {}
): Promise<CmsEntry[]> {
  const filters: string[] = ['collection_id = $1'];
  const values: unknown[] = [collectionId];
  let paramIndex = 2;

  if (options.status) {
    filters.push(`status = $${paramIndex}`);
    values.push(options.status);
    paramIndex += 1;
  }
  if (options.locale) {
    filters.push(`locale = $${paramIndex}`);
    values.push(options.locale);
    paramIndex += 1;
  }
  if (options.search) {
    filters.push(`(slug ilike $${paramIndex} or title ilike $${paramIndex})`);
    values.push(`%${options.search}%`);
    paramIndex += 1;
  }

  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  values.push(limit, offset);

  const { rows } = await query<CmsEntry>(
    `select id, collection_id, status, locale, slug, title, data, published_at, archived_at, created_by, updated_by, created_at, updated_at
     from cms.entries
     where ${filters.join(' and ')}
     order by updated_at desc
     limit $${values.length - 1}
     offset $${values.length}`,
    values
  );

  return rows.map((row) => entrySchema.parse({ ...row, data: row.data ?? {} }));
}

export async function getEntry(entryId: string): Promise<CmsEntry | null> {
  const { rows } = await query<CmsEntry>(
    `select id, collection_id, status, locale, slug, title, data, published_at, archived_at, created_by, updated_by, created_at, updated_at
     from cms.entries
     where id = $1
     limit 1`,
    [entryId]
  );

  const record = rows[0];
  return record ? entrySchema.parse({ ...record, data: record.data ?? {} }) : null;
}

function computeStatusPayload(
  status: 'draft' | 'review' | 'published' | 'archived'
) {
  if (status === 'published') {
    return {
      status: 'published',
      published_at: 'now()',
      archived_at: null,
    } as const;
  }

  if (status === 'archived') {
    return {
      status: 'archived',
      published_at: null,
      archived_at: 'now()',
    } as const;
  }

  return {
    status,
    published_at: null,
    archived_at: null,
  } as const;
}

export async function createEntry(
  collectionId: string,
  input: CreateEntryInput,
  adminUserId: string
): Promise<CmsEntry> {
  const statusPayload = computeStatusPayload(input.status ?? 'draft');
  const { rows } = await query<CmsEntry>(
    `insert into cms.entries
       (collection_id, status, locale, slug, title, data, published_at, archived_at, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6, ${statusPayload.published_at ? 'now()' : 'null'}, ${
      statusPayload.archived_at ? 'now()' : 'null'
    }, $7, $7)
     returning id, collection_id, status, locale, slug, title, data, published_at, archived_at, created_by, updated_by, created_at, updated_at`,
    [
      collectionId,
      statusPayload.status,
      input.locale,
      input.slug ?? null,
      input.title ?? null,
      JSON.stringify(input.data ?? {}),
      adminUserId,
    ]
  );

  const record = rows[0];
  if (!record) {
    throw new Error('Failed to create entry');
  }

  const parsed = entrySchema.parse({ ...record, data: record.data ?? {} });
  await triggerCmsWorkflow({
    collectionId,
    entryId: parsed.id,
    status: parsed.status,
    action: 'create',
  });
  return parsed;
}

export async function updateEntry(
  entryId: string,
  input: UpdateEntryInput,
  adminUserId: string
): Promise<CmsEntry> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.locale !== undefined) {
    assignments.push(`locale = $${assignments.length + 1}`);
    values.push(input.locale);
  }
  if (input.slug !== undefined) {
    assignments.push(`slug = $${assignments.length + 1}`);
    values.push(input.slug ?? null);
  }
  if (input.title !== undefined) {
    assignments.push(`title = $${assignments.length + 1}`);
    values.push(input.title ?? null);
  }
  if (input.data !== undefined) {
    assignments.push(`data = $${assignments.length + 1}`);
    values.push(JSON.stringify(input.data ?? {}));
  }

  let statusChanged = false;
  if (input.status !== undefined) {
    const payload = computeStatusPayload(input.status);
    assignments.push(`status = $${assignments.length + 1}`);
    values.push(payload.status);
    if (payload.published_at === 'now()') {
      assignments.push(`published_at = now()`);
    } else {
      assignments.push(`published_at = null`);
    }
    if (payload.archived_at === 'now()') {
      assignments.push(`archived_at = now()`);
    } else {
      assignments.push(`archived_at = null`);
    }
    statusChanged = true;
  }

  assignments.push(`updated_at = now()`);
  assignments.push(`updated_by = $${assignments.length + 1}`);
  values.push(adminUserId);
  values.push(entryId);

  const { rows } = await query<CmsEntry>(
    `update cms.entries
     set ${assignments.join(', ')}
     where id = $${values.length}
     returning id, collection_id, status, locale, slug, title, data, published_at, archived_at, created_by, updated_by, created_at, updated_at`,
    values
  );

  if (!rows[0]) {
    throw new Error('Entry not found');
  }

  const updated = entrySchema.parse({ ...rows[0], data: rows[0].data ?? {} });

  await triggerCmsWorkflow({
    collectionId: updated.collection_id,
    entryId: updated.id,
    status: updated.status,
    action: statusChanged ? 'status_change' : 'update',
  });

  return updated;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await query('delete from cms.entries where id = $1', [entryId]);
}

export async function listEntryVersions(entryId: string): Promise<CmsEntryVersion[]> {
  const { rows } = await query<CmsEntryVersion>(
    `select id, entry_id, version_number, snapshot, created_by, created_at
     from cms.entry_versions
     where entry_id = $1
     order by version_number desc
     limit 20`,
    [entryId]
  );

  return rows.map((row) => entryVersionSchema.parse({ ...row, snapshot: row.snapshot ?? {} }));
}

export async function listMedia(collectionId?: string | null): Promise<CmsMedia[]> {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (collectionId) {
    filters.push(`collection_id = $1`);
    values.push(collectionId);
  }

  const whereClause = filters.length ? `where ${filters.join(' and ')}` : '';

  const { rows } = await query<CmsMedia>(
    `select id, collection_id, title, file_name, storage_path, mime_type, size_bytes, metadata, created_by, created_at
     from cms.media
     ${whereClause}
     order by created_at desc
     limit 200`,
    values
  );

  return rows.map((row) => mediaSchema.parse({ ...row, metadata: row.metadata ?? {} }));
}

export type CreateMediaInput = {
  collectionId?: string | null;
  title?: string | null;
  fileName: string;
  storagePath: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export async function createMediaRecord(input: CreateMediaInput): Promise<CmsMedia> {
  const { rows } = await query<CmsMedia>(
    `insert into cms.media (collection_id, title, file_name, storage_path, mime_type, size_bytes, metadata, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (storage_path) do update set
       title = excluded.title,
       mime_type = excluded.mime_type,
       size_bytes = excluded.size_bytes,
       metadata = excluded.metadata,
       collection_id = excluded.collection_id,
       updated_at = now()
     returning id, collection_id, title, file_name, storage_path, mime_type, size_bytes, metadata, created_by, created_at`,
    [
      input.collectionId ?? null,
      input.title ?? null,
      input.fileName,
      input.storagePath,
      input.mimeType ?? null,
      input.sizeBytes ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.createdBy ?? null,
    ]
  );

  const record = rows[0];
  if (!record) {
    throw new Error('Failed to create media record');
  }

  return mediaSchema.parse({ ...record, metadata: record.metadata ?? {} });
}

