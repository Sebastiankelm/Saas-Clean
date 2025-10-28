import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  referenceClientPlugin,
  referencePlugin,
  referenceServicePlugin,
  type ReferencePluginConfig,
} from '@saas-clean/plugins/plugins/reference';
import type {
  ClientPluginContext,
  PluginLogger,
  PluginStorage,
  ServicePluginContext,
} from '@saas-clean/plugins';

class MemoryStorage implements PluginStorage {
  #store = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.#store.get(key) as T | undefined) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.#store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.#store.delete(key);
  }

  async list(): Promise<string[]> {
    return [...this.#store.keys()];
  }
}

const logger: PluginLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const createServiceCtx = (
  config: ReferencePluginConfig
): ServicePluginContext<ReferencePluginConfig> => ({
  id: referenceServicePlugin.id,
  config,
  logger,
  storage: new MemoryStorage(),
  env: {},
  runtime: 'service',
  bindings: {},
  secrets: {},
});

const createClientCtx = (
  config: ReferencePluginConfig,
  storage: PluginStorage
): ClientPluginContext<ReferencePluginConfig> => ({
  id: referenceClientPlugin.id,
  config,
  logger,
  storage,
  env: {},
  runtime: 'client',
  services: {},
  bridge: {
    emit: vi.fn(),
  },
  mount: null,
});

describe('reference plugin contract', () => {
  it('executes service tasks and persists data to storage', async () => {
    const ctx = createServiceCtx(referencePlugin.defaults);

    await referenceServicePlugin.setup?.(ctx);

    const task = referenceServicePlugin.tasks?.[0];
    expect(task?.name).toBe('reference::heartbeat');

    await task?.execute(ctx);

    const stored = await ctx.storage.get<string>('reference:lastHeartbeatAt');
    expect(stored).toBeTruthy();
  });

  it('renders a welcome banner on the client', async () => {
    const storage = new MemoryStorage();
    const ctx = createClientCtx(referencePlugin.defaults, storage);
    const dom = new JSDOM('<div id="root"></div>');
    const target = dom.window.document.getElementById('root');
    expect(target).not.toBeNull();

    if (!target) return;

    await referenceClientPlugin.render?.(ctx, target);

    expect(target.innerHTML).toContain(referencePlugin.defaults.heading);
    expect(target.innerHTML).toContain(referencePlugin.defaults.message);

    await referenceClientPlugin.destroy?.(ctx, target);
    expect(target.innerHTML).toBe('');
  });
});
