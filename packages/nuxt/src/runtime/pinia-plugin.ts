import { hub } from '@logtide/core';

/**
 * Pinia plugin that records store action dispatches as breadcrumbs.
 *
 * @example
 * ```ts
 * // plugins/pinia.ts (Nuxt plugin)
 * import { logtidePiniaPlugin } from '@logtide/nuxt/runtime/pinia-plugin';
 *
 * export default defineNuxtPlugin(({ $pinia }) => {
 *   $pinia.use(logtidePiniaPlugin);
 * });
 * ```
 */
export function logtidePiniaPlugin({ store }: { store: any }): void {
  store.$onAction(({ name, store: actionStore, after, onError }: {
    name: string;
    store: { $id: string };
    after: (cb: () => void) => void;
    onError: (cb: (error: unknown) => void) => void;
  }) => {
    const startTime = Date.now();

    hub.addBreadcrumb({
      type: 'custom',
      category: 'pinia.action',
      message: `${actionStore.$id}.${name}()`,
      timestamp: startTime,
      data: { store: actionStore.$id, action: name },
    });

    onError(() => {
      hub.addBreadcrumb({
        type: 'custom',
        category: 'pinia.action.error',
        message: `${actionStore.$id}.${name}() failed`,
        level: 'error',
        timestamp: Date.now(),
        data: {
          store: actionStore.$id,
          action: name,
          duration_ms: Date.now() - startTime,
        },
      });
    });
  });
}
