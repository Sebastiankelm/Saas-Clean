import type { PluginCommonContext, PluginDefinition } from './types';

export interface ClientBridge {
  emit: (event: string, payload?: unknown) => void;
  request?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface ClientPluginContext<
  TConfig = Record<string, unknown>,
  TServices = Record<string, unknown>
> extends PluginCommonContext<TConfig> {
  runtime: 'client';
  services: TServices;
  bridge: ClientBridge;
  mount?: HTMLElement | null;
}

export interface ClientPlugin<
  TConfig = Record<string, unknown>,
  TServices = Record<string, unknown>
> extends PluginDefinition<ClientPluginContext<TConfig, TServices>, TConfig> {
  render?: (
    ctx: ClientPluginContext<TConfig, TServices>,
    target: HTMLElement
  ) => Promise<void> | void;
  destroy?: (
    ctx: ClientPluginContext<TConfig, TServices>,
    target: HTMLElement
  ) => Promise<void> | void;
}

export const createClientPlugin = <
  TConfig = Record<string, unknown>,
  TServices = Record<string, unknown>
>(definition: ClientPlugin<TConfig, TServices>): ClientPlugin<TConfig, TServices> => definition;
