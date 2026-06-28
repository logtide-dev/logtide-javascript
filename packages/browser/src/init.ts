import type { Integration, Transport } from '@logtide/types';
import { hub, GlobalErrorIntegration, resolveDSN } from '@logtide/core';
import { getSessionId } from './session';
import { WebVitalsIntegration } from './integrations/web-vitals';
import { ClickBreadcrumbIntegration } from './integrations/click-breadcrumbs';
import { NetworkBreadcrumbIntegration } from './integrations/network-breadcrumbs';
import { OfflineTransport } from './transport/offline-transport';
import type { BrowserClientOptions } from './types';

/**
 * Build the default browser integrations from the given options.
 *
 * Web Vitals are opt-in; click and network breadcrumbs are on by default and
 * can be disabled (or configured) via `options.browser`.
 */
export function buildBrowserIntegrations(options: BrowserClientOptions): Integration[] {
  const browserOpts = options.browser ?? {};
  const integrations: Integration[] = [];
  const apiUrl = resolveDSN(options).apiUrl;

  if (browserOpts.webVitals) {
    integrations.push(
      new WebVitalsIntegration({
        sampleRate: browserOpts.webVitalsSampleRate,
      }),
    );
  }

  if (browserOpts.clickBreadcrumbs !== false) {
    const clickOpts = typeof browserOpts.clickBreadcrumbs === 'object'
      ? browserOpts.clickBreadcrumbs
      : undefined;
    integrations.push(new ClickBreadcrumbIntegration(clickOpts));
  }

  if (browserOpts.networkBreadcrumbs !== false) {
    const netOpts = typeof browserOpts.networkBreadcrumbs === 'object'
      ? browserOpts.networkBreadcrumbs
      : {};
    integrations.push(
      new NetworkBreadcrumbIntegration({ ...netOpts, apiUrl }),
    );
  }

  return integrations;
}

/**
 * Build the offline-resilience transport wrapper from the given options.
 *
 * Returns `undefined` when offline resilience is disabled via
 * `options.browser.offlineResilience === false`.
 */
export function buildBrowserTransportWrapper(
  options: BrowserClientOptions,
): ((inner: Transport) => Transport) | undefined {
  const browserOpts = options.browser ?? {};
  if (browserOpts.offlineResilience === false) return undefined;

  const dsn = resolveDSN(options);
  return (inner: Transport) => new OfflineTransport({
    inner,
    beaconUrl: `${dsn.apiUrl}/api/v1/ingest`,
    apiKey: dsn.apiKey,
    debug: options.debug,
  });
}

export interface InitLogtideExtraOptions {
  /**
   * Service name to use when `options.service` is not set. Framework wrappers
   * pass their own name (e.g. 'nextjs'); an explicit `options.service` always
   * wins.
   */
  defaultService?: string;
}

/**
 * Initialize LogTide in the browser.
 *
 * Wires up the global error handler, the default browser integrations
 * (click/network breadcrumbs, optional Web Vitals) and offline resilience,
 * then binds the session id to the global scope.
 *
 * @example
 * ```ts
 * // main.tsx / index.tsx
 * import { initLogtide } from '@logtide/browser';
 *
 * initLogtide({
 *   dsn: 'https://lp_key@api.logtide.dev/proj',
 *   service: 'react-frontend',
 *   environment: 'production',
 *   release: '1.0.0',
 * });
 * ```
 */
export function initLogtide(
  options: BrowserClientOptions,
  extra: InitLogtideExtraOptions = {},
): void {
  hub.init({
    ...(extra.defaultService ? { service: extra.defaultService } : {}),
    ...options,
    transportWrapper: buildBrowserTransportWrapper(options) ?? options.transportWrapper,
    integrations: [
      new GlobalErrorIntegration(),
      ...buildBrowserIntegrations(options),
      ...(options.integrations ?? []),
    ],
  });

  hub.getScope().setSessionId(getSessionId());
}
