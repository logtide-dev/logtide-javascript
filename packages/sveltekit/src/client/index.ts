import type { Integration } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';
import { getSessionId, WebVitalsIntegration, type BrowserClientOptions } from '@logtide/browser';

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
  const browserIntegrations: Integration[] = [];

  if (options.browser?.webVitals) {
    browserIntegrations.push(
      new WebVitalsIntegration({
        sampleRate: options.browser.webVitalsSampleRate,
      }),
    );
  }

  hub.init({
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...browserIntegrations,
      ...(options.integrations ?? []),
    ],
  });

  hub.getScope().setSessionId(getSessionId());
}
