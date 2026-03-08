import type { ClientOptions } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';
import { getSessionId } from '@logtide/browser';

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
    service: 'nextjs',
    ...options,
    integrations: [
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });

  hub.getScope().setSessionId(getSessionId());
}
