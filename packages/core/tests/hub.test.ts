import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the hub, but it's a singleton. We'll re-import to get fresh state.
// Since hub is a module-level singleton, we need to be careful.

describe('hub', () => {
  let hub: typeof import('../src/hub').hub;

  beforeEach(async () => {
    // Dynamic import to get the singleton
    const mod = await import('../src/hub');
    hub = mod.hub;
    // Close any previous client
    await hub.close();
  });

  afterEach(async () => {
    await hub.close();
  });

  it('should start with no client', () => {
    expect(hub.getClient()).toBeNull();
  });

  it('should init a client', () => {
    const client = hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hub-test',
    });

    expect(client).toBeDefined();
    expect(hub.getClient()).toBe(client);
  });

  it('should return same client on double init', () => {
    const c1 = hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test',
    });
    const c2 = hub.init({
      dsn: 'https://lp_other@api.logtide.dev/proj2',
      service: 'test2',
    });
    expect(c1).toBe(c2);
  });

  it('should provide a global scope', () => {
    const scope = hub.getScope();
    expect(scope).toBeDefined();
    expect(scope.traceId).toBeDefined();
  });

  it('should add breadcrumbs to scope', () => {
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test',
    });

    hub.addBreadcrumb({ type: 'custom', message: 'hub-bc', timestamp: 1 });
    const bcs = hub.getScope().getBreadcrumbs();
    expect(bcs).toHaveLength(1);
    expect(bcs[0].message).toBe('hub-bc');
  });

  it('should handle captureError with no client', () => {
    // Should not throw
    hub.captureError(new Error('no client'));
  });

  it('should handle captureLog with no client', () => {
    hub.captureLog('info', 'no client');
  });

  it('should close client', async () => {
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test',
    });

    await hub.close();
    expect(hub.getClient()).toBeNull();
  });
});
