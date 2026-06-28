export { createBoundaryHandler } from './error-boundary';

import { initLogtide as initBrowserLogtide, type BrowserClientOptions } from '@logtide/browser';

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
  initBrowserLogtide(options, { defaultService: 'sveltekit' });
}
