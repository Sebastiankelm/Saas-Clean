import type { PluginCommonContext, PluginDefinition } from './types';

export interface ServiceBindings {
  supabase?: unknown;
  fetch?: typeof fetch;
  scheduler?: (task: ScheduledTask) => void;
}

export interface ScheduledTask<TContext = ServicePluginContext> {
  name: string;
  cron: string;
  execute: (ctx: TContext) => Promise<void> | void;
}

export interface ServicePluginContext<
  TConfig = Record<string, unknown>,
  TBindings extends ServiceBindings = ServiceBindings
> extends PluginCommonContext<TConfig> {
  runtime: 'service';
  bindings: TBindings;
  secrets: Record<string, string | undefined>;
}

export interface ServiceEndpoint<TContext = ServicePluginContext> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: (ctx: TContext, request: Request) => Promise<Response> | Response;
}

export interface ServicePlugin<
  TConfig = Record<string, unknown>,
  TBindings extends ServiceBindings = ServiceBindings
> extends PluginDefinition<ServicePluginContext<TConfig, TBindings>, TConfig> {
  tasks?: Array<ScheduledTask<ServicePluginContext<TConfig, TBindings>>>;
  endpoints?: Array<ServiceEndpoint<ServicePluginContext<TConfig, TBindings>>>;
}

export const createServicePlugin = <
  TConfig = Record<string, unknown>,
  TBindings extends ServiceBindings = ServiceBindings
>(definition: ServicePlugin<TConfig, TBindings>): ServicePlugin<TConfig, TBindings> => definition;
