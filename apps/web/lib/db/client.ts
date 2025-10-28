import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';
import { env } from '@/config/env';

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const globalOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export type SupabaseDatabase = Database;
export type SupabaseClientType = SupabaseClient<Database>;

let adminClient: SupabaseClientType | null = null;

export function getSupabaseAdminClient(): SupabaseClientType {
  if (!adminClient) {
    adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, globalOptions);
  }
  return adminClient;
}

export function createSupabaseServerClient(accessToken?: string): SupabaseClientType {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    ...globalOptions,
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    },
  });
}

export function createSupabaseEdgeClient(accessToken?: string): SupabaseClientType {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    ...globalOptions,
    global: {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'x-client-info': 'edge',
      },
    },
  });
}
