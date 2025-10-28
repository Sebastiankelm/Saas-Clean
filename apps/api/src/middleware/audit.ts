// @ts-nocheck
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, AuditContext } from '../types';
import type { Database, Json } from '@supabase-db';
import { optionalEnv } from '../env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const toJson = (value: unknown): Json | null => {
  if (value === undefined || value === null) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch (error) {
    console.warn('Failed to coerce value to JSON for audit logging', error);
    return null;
  }
};

const captureRequestBody = async (request: Request): Promise<unknown> => {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return await request.json();
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = await request.formData();
      return Object.fromEntries(params.entries());
    }
    if (contentType.startsWith('text/')) {
      return await request.text();
    }
  } catch (error) {
    console.warn('Failed to capture request body for audit logging', error);
  }
  return null;
};

const normaliseAuditContext = (context: AuditContext | undefined): AuditContext => {
  if (!context) {
    return {};
  }
  return context;
};

export const auditMiddleware = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();

    if (!MUTATING_METHODS.has(method) || optionalEnv.auditLogDisabled) {
      await next();
      return;
    }

    const clonedRequest = c.req.raw.clone();
    const requestBodyPromise = captureRequestBody(clonedRequest);

    await next();

    const auditContext = normaliseAuditContext(c.get('auditContext'));
    if (auditContext.skip) {
      return;
    }

    const supabaseAdmin = c.get('supabaseAdmin');
    const actor = c.get('actor');

    if (!supabaseAdmin) {
      throw new HTTPException(500, { message: 'Supabase admin client is not available.' });
    }

    const requestBody = auditContext.newValues ?? (await requestBodyPromise);

    const pathSegments = c.req.path.split('/').filter(Boolean);
    const resourceType = auditContext.resourceType ?? pathSegments[0] ?? 'unknown';

    const metadata = {
      ...(auditContext.metadata ?? {}),
      status: c.res.status,
      method,
      path: c.req.path,
    };

    const insertPayload: Database['admin']['Tables']['audit_log']['Insert'] = {
      actor_user_id: actor?.adminUserId ?? null,
      event_type: auditContext.eventType ?? `${method.toLowerCase()}_${resourceType}`,
      resource_type: resourceType,
      resource_identifier: auditContext.resourceIdentifier ?? pathSegments[1] ?? null,
      previous_values: toJson(auditContext.previousValues),
      new_values: toJson(requestBody),
      metadata: toJson(metadata),
      ip_address: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
    };

    const { error } = await supabaseAdmin
      .schema('admin')
      .from('audit_log')
      .insert(insertPayload);

    if (error) {
      console.error('Failed to persist audit log entry', error);
      throw new HTTPException(500, { message: 'Failed to persist audit log entry.' });
    }
  };
};
