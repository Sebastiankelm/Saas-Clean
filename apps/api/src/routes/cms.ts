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

export default cmsRouter;
