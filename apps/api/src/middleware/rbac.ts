import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types';
import type { Database } from '@supabase-db';
import { verifyCaptchaToken } from '../services/captcha';

const ensurePermission = async (c: Parameters<MiddlewareHandler<AppEnv>>[0], permission: string): Promise<boolean> => {
  const cache = c.get('permissions');
  if (!cache) {
    throw new HTTPException(500, { message: 'Permission cache is not initialised.' });
  }

  if (cache.has(permission)) {
    return cache.get(permission) ?? false;
  }

  const supabase = c.get('supabaseClient');
  if (!supabase) {
    throw new HTTPException(500, { message: 'Supabase client is not available in the request context.' });
  }

  type HasPermissionArgs = Database['admin']['Functions']['has_permission']['Args'];
  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: HasPermissionArgs) => Promise<{ data: boolean | null; error: unknown }>)(
    'has_permission',
    { p_permission_key: permission } satisfies HasPermissionArgs
  );

  if (error) {
    throw new HTTPException(500, { message: `Failed to resolve permission: ${permission}` });
  }

  const allowed = Boolean(data);
  cache.set(permission, allowed);
  return allowed;
};

export type PermissionGuardOptions = {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  sensitive?: boolean;
};

const normalise = (value?: string | string[]): string[] => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

export const requirePermission = (options: PermissionGuardOptions): MiddlewareHandler<AppEnv> => {
  const anyOf = normalise(options.anyOf ?? options.permission ?? []);
  const allOf = normalise(options.allOf);

  return async (c, next) => {
    const uniquePermissions = new Set<string>([...anyOf, ...allOf].filter(Boolean));

    if (uniquePermissions.size > 0) {
      const evaluations = await Promise.all(
        [...uniquePermissions].map(async (permission) => ensurePermission(c, permission))
      );
      const permissionMap = new Map<string, boolean>();
      [...uniquePermissions].forEach((permission, index) => {
        permissionMap.set(permission, evaluations[index]);
      });

      const anySatisfied = anyOf.length === 0 || anyOf.some((permission) => permissionMap.get(permission));
      const allSatisfied = allOf.length === 0 || allOf.every((permission) => permissionMap.get(permission));

      if (!anySatisfied || !allSatisfied) {
        throw new HTTPException(403, { message: 'Insufficient permissions to perform this action.' });
      }
    }

    if (options.sensitive) {
      const actor = c.get('actor');
      if (!actor?.mfaVerified) {
        const captchaToken =
          c.req.header('x-captcha-token') ??
          c.req.header('x-turnstile-token') ??
          c.req.header('x-hcaptcha-token');

        if (!captchaToken) {
          throw new HTTPException(403, {
            message: 'Sensitive actions require a verified MFA factor or a valid captcha token.',
          });
        }

        const ip =
          c.req.header('cf-connecting-ip') ??
          c.req.header('x-forwarded-for') ??
          c.req.header('x-real-ip') ??
          undefined;

        const captchaValid = await verifyCaptchaToken(captchaToken, ip);
        if (!captchaValid) {
          throw new HTTPException(403, { message: 'Captcha verification failed.' });
        }
      }
    }

    await next();
  };
};
