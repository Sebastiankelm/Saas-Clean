// @ts-nocheck
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

// Get buckets list
storageRouter.get(
  '/buckets',
  requirePermission({ anyOf: ['storage.read', 'cms.media.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw new HTTPException(500, { message: 'Failed to list buckets.' });
    }

    markAuditSkipped(c);
    return c.json({ buckets: data });
  }
);

// Rename or move file/folder
const renameSchema = z.object({
  bucket: z.string().min(1),
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
});

storageRouter.post(
  '/rename',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = renameSchema.parse(await c.req.json());

    // Copy to new location
    const { error: copyError } = await supabase.storage
      .from(payload.bucket)
      .copy(payload.fromPath, payload.toPath);

    if (copyError) {
      throw new HTTPException(400, { message: `Failed to copy: ${copyError.message}` });
    }

    // Delete old file
    const { error: deleteError } = await supabase.storage
      .from(payload.bucket)
      .remove([payload.fromPath]);

    if (deleteError) {
      console.error('Failed to delete old file:', deleteError);
      // Continue anyway
    }

    updateAuditContext(c, {
      resourceType: 'storage.object',
      resourceIdentifier: `${payload.bucket}:${payload.fromPath}`,
      metadata: {
        action: 'rename',
        newPath: payload.toPath,
      },
    });

    return c.json({ 
      success: true,
      fromPath: payload.fromPath,
      toPath: payload.toPath,
    });
  }
);

// Get public URL for public file
const publicUrlSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
});

storageRouter.post(
  '/public-url',
  requirePermission({ anyOf: ['storage.read', 'cms.media.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = publicUrlSchema.parse(await c.req.json());

    const { data } = await supabase.storage
      .from(payload.bucket)
      .getPublicUrl(payload.path);

    markAuditSkipped(c);
    return c.json({ 
      publicUrl: data.publicUrl,
    });
  }
);

// Get signed URL for private file (valid for 1 hour)
const signedUrlSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
  expiresIn: z.number().int().positive().max(3600).optional().default(3600),
});

storageRouter.post(
  '/signed-url',
  requirePermission({ anyOf: ['storage.read', 'cms.media.read'] }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = signedUrlSchema.parse(await c.req.json());

    const { data, error } = await supabase.storage
      .from(payload.bucket)
      .createSignedUrl(payload.path, payload.expiresIn);

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    markAuditSkipped(c);
    return c.json({ 
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + payload.expiresIn * 1000).toISOString(),
    });
  }
);

// Create folder
const createFolderSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
});

storageRouter.post(
  '/folders',
  requirePermission({ permission: 'cms.media.manage', sensitive: true }),
  async (c) => {
    const supabase = c.get('supabaseClient');
    if (!supabase) {
      throw new HTTPException(500, { message: 'Supabase client is not available.' });
    }

    const payload = createFolderSchema.parse(await c.req.json());

    // Create folder by uploading an empty marker file
    const folderMarkerPath = payload.path.endsWith('/') 
      ? `${payload.path}.folder` 
      : `${payload.path}/.folder`;

    const { data, error } = await supabase.storage
      .from(payload.bucket)
      .upload(folderMarkerPath, new Uint8Array(), {
        contentType: 'application/x-directory',
      });

    if (error) {
      throw new HTTPException(400, { message: error.message });
    }

    updateAuditContext(c, {
      resourceType: 'storage.folder',
      resourceIdentifier: `${payload.bucket}:${payload.path}`,
      newValues: { folderPath: payload.path },
    });

    return c.json({ 
      success: true,
      path: payload.path,
    }, 201);
  }
);

export default storageRouter;
