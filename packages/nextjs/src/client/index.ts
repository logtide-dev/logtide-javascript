import type { Integration } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';
import { getSessionId, WebVitalsIntegration, type BrowserClientOptions } from '@logtide/browser';

export { LogtideErrorBoundary } from './error-boundary';
export { trackNavigation } from './navigation';

/**
 * Initialize LogTide on the client (browser) side.
 *
 * @example
 * ```ts
 * // app/layout.tsx
 * 'use client';
 * import { initLogtide } from '@logtide/nextjs/client';
 * initLogtide({ dsn: '...', service: 'my-app' });
 * ```
 */
export function initLogtide(options: BrowserClientOptions): void {
  const browserIntegrations: Integration[] = [];

  if (options.browser?.webVitals) {
    browserIntegrations.push(
      new WebVitalsIntegration({
        sampleRate: options.browser.webVitalsSampleRate,
      }),
    );
  }

  hub.init({
    service: 'nextjs',
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...browserIntegrations,
      ...(options.integrations ?? []),
    ],
  });

  hub.getScope().setSessionId(getSessionId());
}
