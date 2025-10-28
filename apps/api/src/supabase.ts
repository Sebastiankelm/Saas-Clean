import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '@supabase-db';
import { env } from './env';
import type { AppSupabaseClient } from './types';

const clientOptions: SupabaseClientOptions<'public'> = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

let adminClient: AppSupabaseClient | null = null;

export const getSupabaseAdminClient = (): AppSupabaseClient => {
  if (!adminClient) {
    adminClient = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, clientOptions);
  }
  return adminClient;
};

export const createSupabaseUserClient = (accessToken?: string): AppSupabaseClient => {
  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;

  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    ...clientOptions,
    global: {
      headers,
    },
  });
};
