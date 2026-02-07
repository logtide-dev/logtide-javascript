import { hub, GlobalErrorIntegration } from '@logtide/core';
import { defineNuxtPlugin, useRuntimeConfig } from '#app';

/**
 * Nuxt client plugin — captures Vue errors and navigation breadcrumbs.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public.logtide as {
    dsn: string;
    service: string;
    environment?: string;
    release?: string;
    debug?: boolean;
  };

  if (!config?.dsn) return;

  hub.init({
    dsn: config.dsn,
    service: config.service,
    environment: config.environment,
    release: config.release,
    debug: config.debug,
    integrations: [new GlobalErrorIntegration()],
  });

  // Capture Vue errors
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    hub.captureError(error, {
      mechanism: 'vue.errorHandler',
      componentInfo: info,
    });
  };

  // Track client-side navigation as breadcrumbs
  nuxtApp.hook('page:start', () => {
    hub.addBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: 'Page navigation started',
      timestamp: Date.now(),
    });
  });

  nuxtApp.hook('page:finish', () => {
    hub.addBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: `Navigated to ${window.location.pathname}`,
      timestamp: Date.now(),
      data: { url: window.location.href },
    });
  });
});
