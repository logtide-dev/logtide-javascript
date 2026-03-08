import type { Integration, Transport } from '@logtide/types';
import { hub, GlobalErrorIntegration, resolveDSN } from '@logtide/core';
import {
  getSessionId,
  WebVitalsIntegration,
  ClickBreadcrumbIntegration,
  NetworkBreadcrumbIntegration,
  OfflineTransport,
  type BrowserClientOptions,
} from '@logtide/browser';

/**
 * Initialize LogTide on the SvelteKit client side.
 *
 * @example
 * ```ts
 * // src/hooks.client.ts
 * import { initLogtide } from '@logtide/sveltekit/client';
 * initLogtide({ dsn: '...', service: 'my-app' });
 * ```
 */
export function initLogtide(options: BrowserClientOptions): void {
  const browserOpts = options.browser ?? {};
  const browserIntegrations: Integration[] = [];
  const apiUrl = resolveDSN(options).apiUrl;

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

  const transportWrapper = browserOpts.offlineResilience !== false
    ? (inner: Transport) => new OfflineTransport({
        inner,
        beaconUrl: `${apiUrl}/api/v1/ingest`,
        apiKey: resolveDSN(options).apiKey,
        debug: options.debug,
      })
    : undefined;

  hub.init({
    ...options,
    transportWrapper: transportWrapper ?? options.transportWrapper,
    integrations: [
      new GlobalErrorIntegration(),
      ...browserIntegrations,
      ...(options.integrations ?? []),
    ],
  });

  hub.getScope().setSessionId(getSessionId());
}
