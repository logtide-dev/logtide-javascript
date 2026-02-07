import type { ClientOptions } from '@logtide/types';
import { hub, ConsoleIntegration, GlobalErrorIntegration } from '@logtide/core';

export { captureRequestError } from './error-handler';
export { instrumentRequest, finishRequest } from './request-handler';

/**
 * Initialize LogTide in a Next.js instrumentation.ts `register()` function.
 *
 * @example
 * ```ts
 * // instrumentation.ts
 * import { registerLogtide, captureRequestError } from '@logtide/nextjs/server';
 *
 * export async function register() {
 *   await registerLogtide({ dsn: '...', service: 'my-app' });
 * }
 *
 * export const onRequestError = captureRequestError;
 * ```
 */
export async function registerLogtide(options: ClientOptions): Promise<void> {
  hub.init({
    ...options,
    integrations: [
      new ConsoleIntegration(),
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });
}
