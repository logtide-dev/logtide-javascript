import type { Integration, Transport } from '@logtide/types';
import { hub, GlobalErrorIntegration, resolveDSN } from '@logtide/core';
import {
  getSessionId,
  WebVitalsIntegration,
  ClickBreadcrumbIntegration,
  NetworkBreadcrumbIntegration,
  OfflineTransport,
} from '@logtide/browser';
import type { ClickBreadcrumbOptions, NetworkBreadcrumbOptions } from '@logtide/browser';
import { defineNuxtPlugin, useRuntimeConfig } from '#app';

/**
 * Nuxt client plugin — captures Vue errors and navigation breadcrumbs.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public.logtide as {
    dsn: string;
    service?: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    browser?: {
      webVitals?: boolean;
      webVitalsSampleRate?: number;
      clickBreadcrumbs?: boolean | ClickBreadcrumbOptions;
      networkBreadcrumbs?: boolean | NetworkBreadcrumbOptions;
    };
  };

  if (!config?.dsn) return;

  const browserOpts = config.browser ?? {};
  const browserIntegrations: Integration[] = [];
  const apiUrl = resolveDSN({ dsn: config.dsn }).apiUrl;

  if (browserOpts.webVitals) {
    browserIntegrations.push(
      new WebVitalsIntegration({
        sampleRate: browserOpts.webVitalsSampleRate,
      }),
    );
  }

  if (browserOpts.clickBreadcrumbs !== false) {
    const clickOpts = typeof browserOpts.clickBreadcrumbs === 'object'
      ? browserOpts.clickBreadcrumbs
      : undefined;
    browserIntegrations.push(new ClickBreadcrumbIntegration(clickOpts));
  }

  if (browserOpts.networkBreadcrumbs !== false) {
    const netOpts = typeof browserOpts.networkBreadcrumbs === 'object'
      ? browserOpts.networkBreadcrumbs
      : {};
    browserIntegrations.push(
      new NetworkBreadcrumbIntegration({ ...netOpts, apiUrl }),
    );
  }

  const offlineResilience = (browserOpts as any).offlineResilience !== false;
  const transportWrapper = offlineResilience
    ? (inner: Transport) => new OfflineTransport({
        inner,
        beaconUrl: `${apiUrl}/api/v1/ingest`,
        apiKey: resolveDSN({ dsn: config.dsn }).apiKey,
        debug: config.debug,
      })
    : undefined;

  hub.init({
    dsn: config.dsn,
    service: config.service ?? 'nuxt',
    environment: config.environment,
    release: config.release,
    debug: config.debug,
    transportWrapper,
    integrations: [
      new GlobalErrorIntegration(),
      ...browserIntegrations,
    ],
  });

  hub.getScope().setSessionId(getSessionId());

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
