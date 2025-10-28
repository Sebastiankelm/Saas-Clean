import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv, ActorContext } from '../types';
import { createSupabaseUserClient, getSupabaseAdminClient } from '../supabase';

const extractToken = (authorizationHeader?: string | null): string | null => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
};

export const authentication = (): MiddlewareHandler<AppEnv> => {
  const adminClient = getSupabaseAdminClient();

  return async (c, next) => {
    const token = extractToken(c.req.header('authorization'));
    if (!token) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header.' });
    }

    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data.user) {
      throw new HTTPException(401, { message: 'Invalid access token.' });
    }

    const { user } = data;
    const hasSupamodeAccess = Boolean(user.app_metadata?.supamode_access);
    if (!hasSupamodeAccess) {
      throw new HTTPException(403, { message: 'Supamode access is required to call this API.' });
    }

    const supabaseClient = createSupabaseUserClient(token);

    const { data: adminUserRecord } = await adminClient
      .schema('admin')
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const mfaVerified = Array.isArray((user as { factors?: Array<{ status: string }> }).factors)
      ? ((user as { factors?: Array<{ status: string }> }).factors ?? []).some((factor) => factor.status === 'verified')
      : user.user_metadata?.mfa_verified === true;

    const actor: ActorContext = {
      authUserId: user.id,
      adminUserId: adminUserRecord?.id ?? undefined,
      email: user.email ?? undefined,
      mfaVerified,
      appMetadata: (user.app_metadata ?? {}) as Record<string, unknown>,
      userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    };

    c.set('supabaseAdmin', adminClient);
    c.set('supabaseClient', supabaseClient);
    c.set('actor', actor);
    c.set('permissions', new Map());
    c.set('auditContext', {});

    await next();
  };
};
