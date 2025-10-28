export type PluginIdentifier = `${string}/${string}`;

export interface PluginMeta {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  icon?: string;
}

export interface PluginLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child?: (scope: string) => PluginLogger;
}

export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null> | T | null;
  set<T = unknown>(key: string, value: T): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  list?(prefix?: string): Promise<string[]> | string[];
}

export interface PluginCommonContext<TConfig = Record<string, unknown>> {
  id: PluginIdentifier;
  config: TConfig;
  logger: PluginLogger;
  storage: PluginStorage;
  env: Record<string, string | undefined>;
  runtime: 'client' | 'service';
}

export interface PluginLifecycle<TContext> {
  setup?: (ctx: TContext) => Promise<void> | void;
  start?: (ctx: TContext) => Promise<void> | void;
  stop?: (ctx: TContext) => Promise<void> | void;
  teardown?: (ctx: TContext) => Promise<void> | void;
}

export interface PluginDefinition<TContext, TConfig = Record<string, unknown>>
  extends PluginLifecycle<TContext> {
  id: PluginIdentifier;
  meta: PluginMeta;
  defaults: TConfig;
}
