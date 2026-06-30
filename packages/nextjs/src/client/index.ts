import { initLogtide as initBrowserLogtide, type BrowserClientOptions } from '@logtide/browser';

export { LogtideErrorBoundary } from '@logtide/browser';
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
  initBrowserLogtide(options, { defaultService: 'nextjs' });
}
