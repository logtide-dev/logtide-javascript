import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalLogEntry, Span } from '@logtide/types';

function createMockTransport() {
  return {
    logs: [] as InternalLogEntry[],
    spans: [] as Span[],
    async sendLogs(logs: InternalLogEntry[]) { this.logs.push(...logs); },
    async sendSpans(spans: Span[]) { this.spans.push(...spans); },
    async flush() {},
  };
}

describe('logtidePiniaPlugin', () => {
  let hub: typeof import('@logtide/core').hub;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'nuxt-test',
      transport,
    });
  });

  afterEach(async () => {
    await hub.close();
  });

  it('should record action breadcrumb on action call', async () => {
    const { logtidePiniaPlugin } = await import('../src/runtime/pinia-plugin');

    const callbacks: {
      after: Array<() => void>;
      onError: Array<(err: unknown) => void>;
    } = { after: [], onError: [] };

    const mockStore = {
      $id: 'cart',
      $onAction: (cb: (ctx: any) => void) => {
        // Simulate an action dispatch
        cb({
          name: 'addItem',
          store: { $id: 'cart' },
          after: (fn: () => void) => callbacks.after.push(fn),
          onError: (fn: (err: unknown) => void) => callbacks.onError.push(fn),
        });
      },
    };

    logtidePiniaPlugin({ store: mockStore });

    // Check that the action breadcrumb was recorded
    const breadcrumbs = hub.getScope().getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0].category).toBe('pinia.action');
    expect(breadcrumbs[0].message).toBe('cart.addItem()');
    expect(breadcrumbs[0].data?.store).toBe('cart');
    expect(breadcrumbs[0].data?.action).toBe('addItem');
  });

  it('should record error breadcrumb on action failure', async () => {
    const { logtidePiniaPlugin } = await import('../src/runtime/pinia-plugin');

    let onErrorCb: ((err: unknown) => void) | undefined;

    const mockStore = {
      $id: 'auth',
      $onAction: (cb: (ctx: any) => void) => {
        cb({
          name: 'login',
          store: { $id: 'auth' },
          after: () => {},
          onError: (fn: (err: unknown) => void) => { onErrorCb = fn; },
        });
      },
    };

    logtidePiniaPlugin({ store: mockStore });

    // Trigger the error callback
    onErrorCb!(new Error('login failed'));

    const breadcrumbs = hub.getScope().getBreadcrumbs();
    const errorBreadcrumb = breadcrumbs.find((b) => b.category === 'pinia.action.error');
    expect(errorBreadcrumb).toBeDefined();
    expect(errorBreadcrumb!.message).toBe('auth.login() failed');
    expect(errorBreadcrumb!.level).toBe('error');
  });

  it('should export the plugin function', async () => {
    const mod = await import('../src/runtime/pinia-plugin');
    expect(mod.logtidePiniaPlugin).toBeDefined();
    expect(typeof mod.logtidePiniaPlugin).toBe('function');
  });
});
