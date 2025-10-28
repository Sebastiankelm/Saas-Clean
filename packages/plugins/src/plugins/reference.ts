import { createClientPlugin } from '../client';
import { createServicePlugin } from '../service';
import type {
  ClientPlugin,
  ClientPluginContext,
  PluginLogger,
  ServicePlugin,
  ServicePluginContext,
} from '../index';

export interface ReferencePluginConfig {
  heading: string;
  message: string;
  enabled: boolean;
}

const logInitialisation = (logger: PluginLogger, scope: string) => {
  if (logger.child) {
    logger.child(scope).info('initialised');
    return;
  }
  logger.info(`[${scope}] initialised`);
};

const defaults: ReferencePluginConfig = {
  heading: 'Witaj ponownie!',
  message: 'To jest przykładowa wiadomość dostarczona przez referencyjną wtyczkę.',
  enabled: true,
};

export const referenceServicePlugin: ServicePlugin<ReferencePluginConfig> =
  createServicePlugin({
    id: 'reference/welcome-banner-service',
    meta: {
      name: 'Reference welcome banner (service)',
      version: '1.0.0',
      description:
        'Demonstruje kontrakt serwisowy dla wtyczek — rejestruje zadania cron i endpointy webhooków.',
      author: 'SaaS Clean Team',
      tags: ['reference', 'welcome'],
    },
    defaults,
    async setup(ctx: ServicePluginContext<ReferencePluginConfig>) {
      logInitialisation(ctx.logger, ctx.id);
      if (!ctx.config.enabled) {
        ctx.logger.warn('Plugin disabled via config');
      }
    },
    tasks: [
      {
        name: 'reference::heartbeat',
        cron: '*/5 * * * *',
        async execute(ctx: ServicePluginContext<ReferencePluginConfig>) {
          if (!ctx.config.enabled) {
            return;
          }
          ctx.logger.debug('Heartbeat ping for %s', ctx.id);
          await ctx.storage.set('reference:lastHeartbeatAt', new Date().toISOString());
        },
      },
    ],
    endpoints: [
      {
        method: 'POST',
        path: '/reference/welcome/ping',
        async handler(ctx, request) {
          if (!ctx.config.enabled) {
            return new Response(JSON.stringify({ status: 'disabled' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          }

          const payload = await request.json().catch(() => ({}));
          ctx.logger.info('Received ping payload', payload);

          return new Response(
            JSON.stringify({
              status: 'ok',
              message: ctx.config.message,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          );
        },
      },
    ],
  });

export const referenceClientPlugin: ClientPlugin<ReferencePluginConfig> =
  createClientPlugin({
    id: 'reference/welcome-banner-client',
    meta: {
      name: 'Reference welcome banner (client)',
      version: '1.0.0',
      description:
        'Przykładowa implementacja klienta która montuje baner powitalny na stronie.',
      author: 'SaaS Clean Team',
      tags: ['reference', 'welcome'],
    },
    defaults,
    async setup(ctx: ClientPluginContext<ReferencePluginConfig>) {
      logInitialisation(ctx.logger, ctx.id);
    },
    async render(ctx, target) {
      if (!ctx.config.enabled) {
        target.innerHTML = '';
        return;
      }

      target.innerHTML = `
        <section data-plugin-id="${ctx.id}" style="padding: 1.5rem; border-radius: 0.75rem; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white;">
          <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${ctx.config.heading}</h2>
          <p style="margin: 0; line-height: 1.5;">${ctx.config.message}</p>
        </section>
      `;
    },
    async destroy(_ctx, target) {
      target.innerHTML = '';
    },
  });

export const referencePlugin = {
  service: referenceServicePlugin,
  client: referenceClientPlugin,
  defaults,
};
