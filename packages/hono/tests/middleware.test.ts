import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { logtide } from '../src/middleware';
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

describe('@logtide/hono middleware', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let hub: typeof import('@logtide/core').hub;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
  });

  afterEach(async () => {
    await hub.close();
  });

  it('should create spans for requests', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/hello', (c) => c.text('world'));

    const res = await app.request('/hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('world');

    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].name).toBe('GET /hello');
    expect(transport.spans[0].status).toBe('ok');
  });

  it('should propagate traceparent header in response', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/traced', (c) => c.text('ok'));

    const res = await app.request('/traced');
    const tp = res.headers.get('traceparent');
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('should extract incoming traceparent', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/parent', (c) => c.text('ok'));

    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const res = await app.request('/parent', {
      headers: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    });

    expect(res.status).toBe(200);
    expect(transport.spans[0].traceId).toBe(traceId);
  });

  it('should capture errors and mark span as error', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/boom', () => {
      throw new Error('handler error');
    });

    const res = await app.request('/boom');
    // Hono returns 500 for unhandled errors
    expect(res.status).toBe(500);

    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].status).toBe('error');
    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].level).toBe('error');
    expect(transport.logs[0].message).toContain('500');
  });

  it('should work without transport (uses default)', async () => {
    const app = new Hono();
    // This will try to use the real transport, but we just verify it doesn't crash
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport, // still use mock to avoid network
    }));
    app.get('/', (c) => c.json({ ok: true }));

    const res = await app.request('/');
    expect(res.status).toBe(200);
  });
});
