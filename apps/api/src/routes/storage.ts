import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { Buffer } from 'node:buffer';
import type { AppEnv } from '../types';
import { requirePermission } from '../middleware/rbac';
import { markAuditSkipped, updateAuditContext } from '../utils/audit';

const storageRouter = new Hono<AppEnv>();

const listSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

const uploadSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  data: z.string().min(1),
  upsert: z.boolean().optional(),
});

const removeSchema = z.object({
  bucket: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1),
});

storageRouter.get(
  '/objects',
  requirePermission({ anyOf: ['cms.media.read', 'cms.collections.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const rawQuery = c.req.query();
    const limit = rawQuery.limit !== undefined ? Number.parseInt(rawQuery.limit, 10) : undefined;
    const query = listSchema.parse({
      bucket: rawQuery.bucket,
      path: rawQuery.path,
      limit: Number.isNaN(limit) ? undefined : limit,
    });

    const { data, error } = await supabase.storage
      .from(query.bucket)
      .list(query.path ?? '', {
        limit: query.limit,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    markAuditSkipped(c);
    return c.json({ objects: data });
  }
);

storageRouter.post(
  '/objects',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = uploadSchema.parse(await c.req.json());

    const [, base64Payload = payload.data] = payload.data.split(',');
    const buffer = Buffer.from(base64Payload, 'base64');
    const { data, error } = await supabase.storage
      .from(payload.bucket)
      .upload(payload.path, buffer, {
        contentType: payload.contentType,
        upsert: payload.upsert ?? false,
      });

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'storage.object',
      resourceIdentifier: `${payload.bucket}:${payload.path}`,
      newValues: {
        bucket: payload.bucket,
        path: payload.path,
        upsert: payload.upsert ?? false,
      },
    });

    return c.json({ object: data }, 201);
  }
);

storageRouter.delete(
  '/objects',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = removeSchema.parse(await c.req.json());

    const { data, error } = await supabase.storage.from(payload.bucket).remove(payload.paths);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'storage.object',
      resourceIdentifier: `${payload.bucket}:${payload.paths.join(',')}`,
      newValues: { removed: data },
    });

    return c.json({ removed: data });
  }
);

export default storageRouter;
