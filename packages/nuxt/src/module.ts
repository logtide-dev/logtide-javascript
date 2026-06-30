import { defineNuxtModule, addServerPlugin, addPlugin, addImports, createResolver } from '@nuxt/kit';
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
    if (!options.dsn && !options.apiUrl) {
      console.warn('[LogTide] No DSN (or apiUrl) provided — skipping initialization');
      return;
    }

    const { resolve } = createResolver(import.meta.url);

    const shared = {
      dsn: options.dsn,
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
      service: options.service,
      environment: options.environment,
      release: options.release,
      debug: options.debug,
      tracesSampleRate: options.tracesSampleRate,
    };

    // Inject runtime config so plugins can read it
    nuxt.options.runtimeConfig.logtide = { ...shared };
    nuxt.options.runtimeConfig.public.logtide = { ...shared };

    // Register server plugin (Nitro hooks)
    addServerPlugin(resolve('./runtime/server-plugin'));

    // Register client plugin (Vue error handler)
    addPlugin(resolve('./runtime/client-plugin'));

    // Auto-import the useLogtide() composable for manual capture
    addImports({ name: 'useLogtide', from: resolve('./runtime/composables') });
  },
});
