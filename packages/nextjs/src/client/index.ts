import type { ClientOptions } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';

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
export function initLogtide(options: ClientOptions): void {
  hub.init({
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}
