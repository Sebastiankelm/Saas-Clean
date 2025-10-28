import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { updateAuditContext } from '../utils/audit';

const cmsRouter = new Hono<AppEnv>();

const createCollectionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  isSingleton: z.boolean().optional().default(false),
  defaultLocale: z.string().default('en'),
});

const updateCollectionSchema = createCollectionSchema.partial();

cmsRouter.get(
  '/collections',
  requirePermission({ anyOf: ['cms.collections.read', 'cms.entries.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const { data, error } = await supabase
      .schema('cms')
      .from('collections')
      .select('id, slug, name, description, icon, is_singleton, default_locale, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load collections.' });
    }

    return c.json({ collections: data });
  }
);

cmsRouter.post(
  '/collections',
  requirePermission({ permission: 'cms.collections.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    const actor = c.get('actor');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = createCollectionSchema.parse(await c.req.json());

    const insertPayload = {
      slug: payload.slug,
      name: payload.name,
      description: payload.description ?? null,
      icon: payload.icon ?? null,
      is_singleton: payload.isSingleton,
      default_locale: payload.defaultLocale,
      created_by: actor?.adminUserId ?? null,
    };

    const { data, error } = await supabase
      .schema('cms')
      .from('collections')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.collection',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ collection: data }, 201);
  }
);

cmsRouter.patch(
  '/collections/:id',
  requirePermission({ allOf: ['cms.collections.manage'], anyOf: ['cms.collections.read'], sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');
    const payload = updateCollectionSchema.parse(await c.req.json());

    const { data: existing, error: existingError } = await supabase
      .schema('cms')
      .from('collections')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError) {
      throw new HTTPException(existingError.code === 'PGRST116' ? 404 : 400, {
        message: existingError.message,
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (payload.slug !== undefined) updatePayload.slug = payload.slug;
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.description !== undefined) updatePayload.description = payload.description;
    if (payload.icon !== undefined) updatePayload.icon = payload.icon;
    if (payload.isSingleton !== undefined) updatePayload.is_singleton = payload.isSingleton;
    if (payload.defaultLocale !== undefined) updatePayload.default_locale = payload.defaultLocale;

    const { data, error } = await supabase
      .schema('cms')
      .from('collections')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.collection',
      resourceIdentifier: id,
      previousValues: existing,
      newValues: data,
    });

    return c.json({ collection: data });
  }
);

// =============================================================================
// FIELDS ENDPOINTS
// =============================================================================

const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  field_type: z.string().min(1),
  is_required: z.boolean().optional().default(false),
  is_unique: z.boolean().optional().default(false),
  is_localized: z.boolean().optional().default(false),
  default_value: z.any().optional(),
  validation_rules: z.record(z.any()).optional(),
  config: z.record(z.any()).optional(),
  sort_order: z.number().int().optional(),
});

const updateFieldSchema = fieldSchema.partial();

cmsRouter.get(
  '/collections/:collectionId/fields',
  requirePermission({ anyOf: ['cms.fields.read', 'cms.collections.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const collectionId = c.req.param('collectionId');

    const { data, error } = await supabase
      .schema('cms')
      .from('fields')
      .select('id, collection_id, name, label, field_type, is_required, is_unique, is_localized, default_value, validation_rules, config, sort_order, created_at')
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load fields.' });
    }

    return c.json({ fields: data });
  }
);

cmsRouter.post(
  '/collections/:collectionId/fields',
  requirePermission({ permission: 'cms.fields.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    const actor = c.get('actor');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const collectionId = c.req.param('collectionId');
    const payload = fieldSchema.parse(await c.req.json());

    const insertPayload = {
      collection_id: collectionId,
      name: payload.name,
      label: payload.label,
      field_type: payload.field_type,
      is_required: payload.is_required,
      is_unique: payload.is_unique,
      is_localized: payload.is_localized,
      default_value: payload.default_value ?? null,
      validation_rules: payload.validation_rules ?? null,
      config: payload.config ?? null,
      sort_order: payload.sort_order ?? 0,
    };

    const { data, error } = await supabase
      .schema('cms')
      .from('fields')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.field',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ field: data }, 201);
  }
);

cmsRouter.patch(
  '/fields/:id',
  requirePermission({ permission: 'cms.fields.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');
    const payload = updateFieldSchema.parse(await c.req.json());

    const updatePayload: Record<string, unknown> = {};
    if (payload.name !== undefined) updatePayload.name = payload.name;
    if (payload.label !== undefined) updatePayload.label = payload.label;
    if (payload.field_type !== undefined) updatePayload.field_type = payload.field_type;
    if (payload.is_required !== undefined) updatePayload.is_required = payload.is_required;
    if (payload.is_unique !== undefined) updatePayload.is_unique = payload.is_unique;
    if (payload.is_localized !== undefined) updatePayload.is_localized = payload.is_localized;
    if (payload.default_value !== undefined) updatePayload.default_value = payload.default_value;
    if (payload.validation_rules !== undefined) updatePayload.validation_rules = payload.validation_rules;
    if (payload.config !== undefined) updatePayload.config = payload.config;
    if (payload.sort_order !== undefined) updatePayload.sort_order = payload.sort_order;

    const { data, error } = await supabase
      .schema('cms')
      .from('fields')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.field',
      resourceIdentifier: id,
      newValues: data,
    });

    return c.json({ field: data });
  }
);

cmsRouter.delete(
  '/fields/:id',
  requirePermission({ permission: 'cms.fields.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .schema('cms')
      .from('fields')
      .delete()
      .eq('id', id);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.field',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

// =============================================================================
// ENTRIES ENDPOINTS
// =============================================================================

const entrySchema = z.object({
  locale: z.string().min(2),
  slug: z.string().optional(),
  status: z.enum(['draft', 'review', 'published', 'archived']).optional().default('draft'),
  data: z.record(z.any()).optional().default({}),
});

const updateEntrySchema = entrySchema.partial();

cmsRouter.get(
  '/collections/:collectionId/entries',
  requirePermission({ anyOf: ['cms.entries.read', 'cms.collections.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const collectionId = c.req.param('collectionId');
    const status = c.req.query('status');
    const locale = c.req.query('locale');
    const limit = Number.parseInt(c.req.query('limit') ?? '20', 10);
    const offset = Number.parseInt(c.req.query('offset') ?? '0', 10);

    let query = supabase
      .schema('cms')
      .from('entries')
      .select('id, collection_id, locale, slug, status, data, author_id, published_at, created_at, updated_at')
      .eq('collection_id', collectionId);

    if (status) {
      query = query.eq('status', status);
    }

    if (locale) {
      query = query.eq('locale', locale);
    }

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load entries.' });
    }

    return c.json({
      entries: data,
      pagination: {
        limit,
        offset,
        total: count ?? 0,
        hasMore: count ? offset + limit < count : false,
      },
    });
  }
);

cmsRouter.get(
  '/entries/:id',
  requirePermission({ anyOf: ['cms.entries.read', 'cms.collections.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');

    const { data, error } = await supabase
      .schema('cms')
      .from('entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load entry.' });
    }

    if (!data) {
      throw new HTTPException(404, { message: 'Entry not found.' });
    }

    return c.json({ entry: data });
  }
);

cmsRouter.post(
  '/collections/:collectionId/entries',
  requirePermission({ permission: 'cms.entries.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    const actor = c.get('actor');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const collectionId = c.req.param('collectionId');
    const payload = entrySchema.parse(await c.req.json());

    const publishedAt = payload.status === 'published' ? new Date().toISOString() : null;

    const insertPayload = {
      collection_id: collectionId,
      locale: payload.locale,
      slug: payload.slug ?? null,
      status: payload.status,
      data: payload.data,
      author_id: actor?.adminUserId ?? null,
      published_at: publishedAt,
    };

    const { data, error } = await supabase
      .schema('cms')
      .from('entries')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.entry',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ entry: data }, 201);
  }
);

cmsRouter.patch(
  '/entries/:id',
  requirePermission({ permission: 'cms.entries.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');
    const payload = updateEntrySchema.parse(await c.req.json());

    const { data: existing, error: existingError } = await supabase
      .schema('cms')
      .from('entries')
      .select('*')
      .eq('id', id)
      .single();

    if (existingError) {
      throw new HTTPException(existingError.code === 'PGRST116' ? 404 : 400, {
        message: existingError.message,
      });
    }

    const updatePayload: Record<string, unknown> = {};
    if (payload.locale !== undefined) updatePayload.locale = payload.locale;
    if (payload.slug !== undefined) updatePayload.slug = payload.slug;
    if (payload.status !== undefined) {
      updatePayload.status = payload.status;
      if (payload.status === 'published') {
        updatePayload.published_at = new Date().toISOString();
      } else if (payload.status !== 'published' && existing.status === 'published') {
        updatePayload.published_at = null;
      }
    }
    if (payload.data !== undefined) updatePayload.data = payload.data;

    const { data, error } = await supabase
      .schema('cms')
      .from('entries')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.entry',
      resourceIdentifier: id,
      previousValues: existing,
      newValues: data,
    });

    return c.json({ entry: data });
  }
);

cmsRouter.delete(
  '/entries/:id',
  requirePermission({ permission: 'cms.entries.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .schema('cms')
      .from('entries')
      .delete()
      .eq('id', id);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.entry',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

// =============================================================================
// MEDIA ENDPOINTS
// =============================================================================

const mediaSchema = z.object({
  storage_path: z.string().min(1),
  filename: z.string().min(1),
  mime_type: z.string().optional(),
  size_bytes: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  alt_text: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

cmsRouter.get(
  '/media',
  requirePermission({ anyOf: ['cms.media.read', 'cms.collections.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const { data, error } = await supabase
      .schema('cms')
      .from('media')
      .select('id, storage_path, filename, mime_type, size_bytes, width, height, alt_text, metadata, uploaded_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new HTTPException(500, { message: 'Failed to load media.' });
    }

    return c.json({ media: data });
  }
);

cmsRouter.post(
  '/media',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    const actor = c.get('actor');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = mediaSchema.parse(await c.req.json());

    const insertPayload = {
      storage_path: payload.storage_path,
      filename: payload.filename,
      mime_type: payload.mime_type ?? null,
      size_bytes: payload.size_bytes ?? null,
      width: payload.width ?? null,
      height: payload.height ?? null,
      alt_text: payload.alt_text ?? null,
      metadata: payload.metadata ?? null,
      uploaded_by: actor?.adminUserId ?? null,
    };

    const { data, error } = await supabase
      .schema('cms')
      .from('media')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.media',
      resourceIdentifier: data.id,
      newValues: data,
    });

    return c.json({ media: data }, 201);
  }
);

cmsRouter.delete(
  '/media/:id',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const id = c.req.param('id');

    const { error } = await supabase
      .schema('cms')
      .from('media')
      .delete()
      .eq('id', id);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'cms.media',
      resourceIdentifier: id,
    });

    return c.json({ success: true });
  }
);

export default cmsRouter;
