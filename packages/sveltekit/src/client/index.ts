import type { ClientOptions } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';

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
export function initLogtide(options: ClientOptions): void {
  hub.init({
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}
