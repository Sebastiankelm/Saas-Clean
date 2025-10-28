import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not defined');
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is not defined');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
}

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
