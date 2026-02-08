import { defineNuxtModule, addServerPlugin, addPlugin, createResolver } from '@nuxt/kit';
import type { ClientOptions } from '@logtide/types';

export interface ModuleOptions extends Omit<ClientOptions, 'integrations' | 'transport'> {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@logtide/nuxt',
    configKey: 'logtide',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    dsn: '',
    service: 'nuxt',
  },
  setup(options, nuxt) {
    if (!options.dsn) {
      console.warn('[LogTide] No DSN provided — skipping initialization');
      return;
    }

    const { resolve } = createResolver(import.meta.url);

    // Inject runtime config so plugins can read it
    nuxt.options.runtimeConfig.logtide = {
      dsn: options.dsn,
      service: options.service,
      environment: options.environment,
      release: options.release,
      debug: options.debug,
    };

    nuxt.options.runtimeConfig.public.logtide = {
      dsn: options.dsn,
      service: options.service,
      environment: options.environment,
      release: options.release,
      debug: options.debug,
    };

    // Register server plugin (Nitro hooks)
    addServerPlugin(resolve('./runtime/server-plugin'));

    // Register client plugin (Vue error handler)
    addPlugin(resolve('./runtime/client-plugin'));
  },
});
