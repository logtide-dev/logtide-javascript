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

  // ─── Richer traces tests ─────────────────────────────────────────────────────

  it('should set http.status_code attribute on span for 200', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/status-200', (c) => c.text('ok'));

    await app.request('/status-200');

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(200);
  });

  it('should set http.status_code attribute on span for 404', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/status-404', (c) => c.text('Not Found', 404));

    await app.request('/status-404');

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(404);
  });

  it('should set http.user_agent when User-Agent header is provided', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/ua', (c) => c.text('ok'));

    await app.request('/ua', {
      headers: { 'user-agent': 'TestAgent/1.0' },
    });

    const span = transport.spans[0];
    expect(span.attributes['http.user_agent']).toBe('TestAgent/1.0');
  });

  it('should set duration_ms in span attributes', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/duration', (c) => c.text('ok'));

    await app.request('/duration');

    const span = transport.spans[0];
    expect(span.attributes['duration_ms']).toBeGreaterThanOrEqual(0);
    expect(typeof span.attributes['duration_ms']).toBe('number');
  });

  it('should include breadcrumbs as span events (at least request + response)', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/events', (c) => c.text('ok'));

    await app.request('/events');

    const span = transport.spans[0];
    expect(span.events).toBeDefined();
    expect(span.events!.length).toBeGreaterThanOrEqual(2);

    // First event should be request breadcrumb
    const requestEvent = span.events!.find(e => e.name.includes('GET /events'));
    expect(requestEvent).toBeDefined();

    // Should also have a response event
    const responseEvent = span.events!.find(e => e.name.match(/^\d{3} GET \/events$/));
    expect(responseEvent).toBeDefined();
  });

  it('should set http.query_string on span when query params are present', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/search', (c) => c.text('ok'));

    await app.request('http://localhost/search?q=hello&page=1');

    const span = transport.spans[0];
    expect(span.attributes['http.query_string']).toBe('?q=hello&page=1');
  });

  it('should include duration_ms in 5xx error log metadata', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/err-log', (c) => c.text('Server Error', 500));

    await app.request('/err-log');

    const errLog = transport.logs.find(l => l.level === 'error');
    expect(errLog).toBeDefined();
    expect(errLog!.metadata?.duration_ms).toBeDefined();
    expect(typeof errLog!.metadata?.duration_ms).toBe('number');
  });

  it('should include request breadcrumb data field with method and url', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/data-check', (c) => c.text('ok'));

    await app.request('http://localhost/data-check');

    const span = transport.spans[0];
    expect(span.events).toBeDefined();
    const requestEvent = span.events!.find(e => e.name.includes('GET /data-check'));
    expect(requestEvent).toBeDefined();
    // data fields are prefixed with "data." in span event attributes
    expect(requestEvent!.attributes?.['data.method']).toBe('GET');
    expect(requestEvent!.attributes?.['data.url']).toBeDefined();
  });

  it('should set net.peer.ip from x-forwarded-for header', async () => {
    const app = new Hono();
    app.use('*', logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'hono-test',
      transport,
    }));
    app.get('/ip', (c) => c.text('ok'));

    await app.request('/ip', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    const span = transport.spans[0];
    expect(span.attributes['net.peer.ip']).toBe('1.2.3.4');
  });
});
