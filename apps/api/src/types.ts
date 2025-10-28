import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@supabase-db';

export type AppSupabaseClient = SupabaseClient<Database>;

export interface ActorContext {
  authUserId: string;
  adminUserId?: string;
  email?: string;
  mfaVerified: boolean;
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
}

export interface AuditContext {
  eventType?: string;
  resourceType?: string;
  resourceIdentifier?: string | null;
  previousValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown>;
  skip?: boolean;
}

export interface AppVariables {
  supabaseAdmin: AppSupabaseClient;
  supabaseClient: AppSupabaseClient;
  actor: ActorContext | null;
  permissions: Map<string, boolean>;
  auditContext: AuditContext;
  requestBody?: unknown;
}

export type AppEnv = {
  Variables: AppVariables;
};
