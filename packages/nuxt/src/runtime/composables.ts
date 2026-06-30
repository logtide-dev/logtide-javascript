import { hub } from '@logtide/core';
import type { Breadcrumb } from '@logtide/types';

/**
 * Composable for manual LogTide capture from anywhere in a Nuxt app.
 *
 * Auto-imported by `@logtide/nuxt`, so it is available without an explicit
 * import:
 *
 * @example
 * ```ts
 * const { captureLog, captureError, addBreadcrumb } = useLogtide();
 * captureLog('info', 'Checkout started', { cartId });
 * ```
 */
export function useLogtide() {
  return {
    addBreadcrumb: (breadcrumb: Breadcrumb): void => hub.addBreadcrumb(breadcrumb),
    captureLog: (level: string, message: string, metadata?: Record<string, unknown>): void =>
      hub.captureLog(level, message, metadata),
    captureError: (error: unknown, metadata?: Record<string, unknown>): void =>
      hub.captureError(error, metadata),
  };
}
