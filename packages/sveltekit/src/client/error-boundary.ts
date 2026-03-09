import { hub } from '@logtide/core';

/**
 * Creates an `onerror` handler for Svelte 5's `<svelte:boundary>`.
 *
 * Reports errors to LogTide with component context metadata.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createBoundaryHandler } from '@logtide/sveltekit/client';
 *   const onerror = createBoundaryHandler('CheckoutForm');
 * </script>
 *
 * <svelte:boundary {onerror}>
 *   <MyComponent />
 *   {#snippet failed(error, reset)}
 *     <p>Something went wrong.</p>
 *     <button onclick={reset}>Try again</button>
 *   {/snippet}
 * </svelte:boundary>
 * ```
 */
export function createBoundaryHandler(
  componentName?: string,
): (error: unknown, reset: () => void) => void {
  return (error: unknown) => {
    hub.captureError(error, {
      mechanism: 'svelte.boundary',
      ...(componentName ? { 'component.name': componentName } : {}),
    });
  };
}
