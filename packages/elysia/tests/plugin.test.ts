import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Elysia from 'elysia';
import { logtide } from '../src/plugin';
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

describe('@logtide/elysia plugin', () => {
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
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/hello', () => 'world');

    const res = await app.handle(new Request('http://localhost/hello'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('world');

    // Elysia should have recorded a span
    expect(transport.spans.length).toBeGreaterThanOrEqual(1);
    const span = transport.spans.find(s => s.name.includes('/hello'));
    expect(span).toBeDefined();
    expect(span!.status).toBe('ok');
  });

  it('should extract incoming traceparent', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/traced', () => 'ok');

    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const res = await app.handle(new Request('http://localhost/traced', {
      headers: {
        traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
      },
    }));

    expect(res.status).toBe(200);
    const span = transport.spans.find(s => s.name.includes('/traced'));
    expect(span?.traceId).toBe(traceId);
  });

  it('should capture errors from handlers', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/error', () => {
        throw new Error('elysia boom');
      });

    const res = await app.handle(new Request('http://localhost/error'));
    // Elysia returns 500 for errors
    expect(res.status).toBe(500);

    // Should have captured the error
    expect(transport.logs.length).toBeGreaterThanOrEqual(1);
    const errLog = transport.logs.find(l => l.level === 'error');
    expect(errLog).toBeDefined();
  });

  // ─── Richer traces tests ─────────────────────────────────────────────────────

  it('should set http.status_code attribute on span for 200', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/status-200', () => 'ok');

    await app.handle(new Request('http://localhost/status-200'));

    const span = transport.spans.find(s => s.name.includes('/status-200'));
    expect(span).toBeDefined();
    expect(span!.attributes['http.status_code']).toBe(200);
  });

  it('should set http.user_agent when User-Agent header is provided', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/ua', () => 'ok');

    await app.handle(new Request('http://localhost/ua', {
      headers: { 'user-agent': 'TestAgent/1.0' },
    }));

    const span = transport.spans.find(s => s.name.includes('/ua'));
    expect(span).toBeDefined();
    expect(span!.attributes['http.user_agent']).toBe('TestAgent/1.0');
  });

  it('should set duration_ms in span attributes', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/duration', () => 'ok');

    await app.handle(new Request('http://localhost/duration'));

    const span = transport.spans.find(s => s.name.includes('/duration'));
    expect(span).toBeDefined();
    expect(span!.attributes['duration_ms']).toBeGreaterThanOrEqual(0);
    expect(typeof span!.attributes['duration_ms']).toBe('number');
  });

  it('should include breadcrumbs as span events (at least request + response)', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/events', () => 'ok');

    await app.handle(new Request('http://localhost/events'));

    const span = transport.spans.find(s => s.name.includes('/events'));
    expect(span).toBeDefined();
    expect(span!.events).toBeDefined();
    expect(span!.events!.length).toBeGreaterThanOrEqual(2);

    // Should have a request event
    const requestEvent = span!.events!.find(e => e.name.includes('GET /events'));
    expect(requestEvent).toBeDefined();

    // Should also have a response event
    const responseEvent = span!.events!.find(e => e.name.match(/^\d{3} GET \/events$/));
    expect(responseEvent).toBeDefined();
  });

  it('should set http.query_string on span when query params are present', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/search', () => 'ok');

    await app.handle(new Request('http://localhost/search?q=hello&page=1'));

    const span = transport.spans.find(s => s.name.includes('/search'));
    expect(span).toBeDefined();
    expect(span!.attributes['http.query_string']).toBe('?q=hello&page=1');
  });

  it('should set net.peer.ip from x-forwarded-for header', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/ip', () => 'ok');

    await app.handle(new Request('http://localhost/ip', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    }));

    const span = transport.spans.find(s => s.name.includes('/ip'));
    expect(span).toBeDefined();
    expect(span!.attributes['net.peer.ip']).toBe('1.2.3.4');
  });

  it('should include request breadcrumb data field with method and url', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/data-check', () => 'ok');

    await app.handle(new Request('http://localhost/data-check'));

    const span = transport.spans.find(s => s.name.includes('/data-check'));
    expect(span).toBeDefined();
    expect(span!.events).toBeDefined();
    const requestEvent = span!.events!.find(e => e.name.includes('GET /data-check'));
    expect(requestEvent).toBeDefined();
    expect(requestEvent!.attributes?.['data.method']).toBe('GET');
    expect(requestEvent!.attributes?.['data.url']).toBeDefined();
  });

  it('should mark span as error on unhandled exceptions', async () => {
    const app = new Elysia()
      .use(logtide({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'elysia-test',
        transport,
      }))
      .get('/boom', () => {
        throw new Error('unexpected');
      });

    const res = await app.handle(new Request('http://localhost/boom'));
    expect(res.status).toBe(500);

    const span = transport.spans.find(s => s.name.includes('/boom'));
    expect(span).toBeDefined();
    expect(span!.status).toBe('error');
  });
});
