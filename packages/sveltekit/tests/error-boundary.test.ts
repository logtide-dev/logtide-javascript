import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('createBoundaryHandler', () => {
  let hub: typeof import('@logtide/core').hub;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'sveltekit-test',
      transport,
    });
  });

  afterEach(async () => {
    await hub.close();
  });

  it('should capture error with svelte.boundary mechanism', async () => {
    const { createBoundaryHandler } = await import('../src/client/error-boundary');

    const handler = createBoundaryHandler();
    handler(new Error('component crash'), () => {});

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].level).toBe('error');
    expect(transport.logs[0].metadata?.mechanism).toBe('svelte.boundary');
  });

  it('should include component name when provided', async () => {
    const { createBoundaryHandler } = await import('../src/client/error-boundary');

    const handler = createBoundaryHandler('CheckoutForm');
    handler(new Error('render error'), () => {});

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].metadata?.['component.name']).toBe('CheckoutForm');
  });

  it('should not include component name when not provided', async () => {
    const { createBoundaryHandler } = await import('../src/client/error-boundary');

    const handler = createBoundaryHandler();
    handler(new Error('error'), () => {});

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].metadata?.['component.name']).toBeUndefined();
  });

  it('should return a function', async () => {
    const { createBoundaryHandler } = await import('../src/client/error-boundary');
    const handler = createBoundaryHandler('Test');
    expect(typeof handler).toBe('function');
  });
});
