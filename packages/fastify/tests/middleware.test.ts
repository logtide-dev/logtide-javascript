import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
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

describe('@logtide/fastify plugin', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let hub: typeof import('@logtide/core').hub;
  let app: FastifyInstance;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
  });

  afterEach(async () => {
    await hub.close();
    if (app) {
      await app.close();
    }
  });

  async function buildApp() {
    app = Fastify();
    await app.register(logtide, {
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'fastify-test',
      transport,
    });
    return app;
  }

  it('should create spans for requests', async () => {
    const app = await buildApp();
    app.get('/hello', async () => 'world');

    const res = await app.inject({ method: 'GET', url: '/hello' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('world');

    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].name).toBe('GET /hello');
    expect(transport.spans[0].status).toBe('ok');
  });

  it('should propagate traceparent header in response', async () => {
    const app = await buildApp();
    app.get('/traced', async () => 'ok');

    const res = await app.inject({ method: 'GET', url: '/traced' });
    const tp = res.headers['traceparent'] as string;

    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('should extract incoming traceparent', async () => {
    const app = await buildApp();
    app.get('/parent', async () => 'ok');

    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const res = await app.inject({
      method: 'GET',
      url: '/parent',
      headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` },
    });

    expect(res.statusCode).toBe(200);
    expect(transport.spans[0].traceId).toBe(traceId);
  });

  it('should link parent span from traceparent', async () => {
    const app = await buildApp();
    app.get('/linked', async () => 'ok');

    const parentSpanId = '00f067aa0ba902b7';
    await app.inject({
      method: 'GET',
      url: '/linked',
      headers: { traceparent: `00-4bf92f3577b34da6a3ce929d0e0e4736-${parentSpanId}-01` },
    });

    expect(transport.spans[0].parentSpanId).toBe(parentSpanId);
  });

  it('should generate new traceId for invalid traceparent', async () => {
    const app = await buildApp();
    app.get('/invalid', async () => 'ok');

    await app.inject({
      method: 'GET',
      url: '/invalid',
      headers: { traceparent: 'not-a-valid-traceparent' },
    });

    expect(transport.spans[0].traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should capture errors and mark span as error', async () => {
    const app = await buildApp();
    app.get('/boom', async () => {
      throw new Error('handler error');
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].status).toBe('error');
  });

  it('should capture thrown error via onError hook', async () => {
    const app = await buildApp();
    app.get('/captured', async () => {
      throw new Error('captured error');
    });

    await app.inject({ method: 'GET', url: '/captured' });

    // onError should have captured the error via captureError
    expect(transport.logs.length).toBeGreaterThanOrEqual(1);
    const errLog = transport.logs.find(l => l.level === 'error');
    expect(errLog).toBeDefined();
  });

  it('should capture 5xx status and log error', async () => {
    const app = await buildApp();
    app.get('/fail', async (_request, reply) => {
      reply.status(500).send('Internal Server Error');
    });

    const res = await app.inject({ method: 'GET', url: '/fail' });

    expect(res.statusCode).toBe(500);
    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].status).toBe('error');
    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].level).toBe('error');
    expect(transport.logs[0].message).toContain('500');
  });

  it('should mark 4xx as ok status (not error)', async () => {
    const app = await buildApp();
    app.get('/not-found', async (_request, reply) => {
      reply.status(404).send('Not Found');
    });

    await app.inject({ method: 'GET', url: '/not-found' });

    expect(transport.spans[0].status).toBe('ok');
  });

  it('should mark 2xx as ok status', async () => {
    const app = await buildApp();
    app.post('/created', async (_request, reply) => {
      reply.status(201).send('created');
    });

    const res = await app.inject({ method: 'POST', url: '/created' });
    expect(res.statusCode).toBe(201);
    expect(transport.spans[0].status).toBe('ok');
  });

  it('should set HTTP attributes on span', async () => {
    const app = await buildApp();
    app.get('/attrs', async () => 'ok');

    await app.inject({ method: 'GET', url: '/attrs' });

    const span = transport.spans[0];
    expect(span.attributes['http.method']).toBe('GET');
    expect(span.attributes['http.target']).toBe('/attrs');
    expect(span.attributes['http.url']).toBeDefined();
  });

  it('should store scope and traceId on request', async () => {
    const app = await buildApp();
    let scopeDefined = false;
    let traceIdDefined = false;

    app.get('/scope', async (request) => {
      scopeDefined = request.logtideScope !== undefined;
      traceIdDefined = request.logtideTraceId !== undefined;
      return 'ok';
    });

    const res = await app.inject({ method: 'GET', url: '/scope' });
    expect(res.statusCode).toBe(200);
    expect(scopeDefined).toBe(true);
    expect(traceIdDefined).toBe(true);
  });

  it('should add HTTP breadcrumb to scope', async () => {
    const app = await buildApp();
    let breadcrumbCount = 0;
    let breadcrumbType = '';
    let breadcrumbMessage = '';

    app.get('/breadcrumbs', async (request) => {
      const bcs = request.logtideScope?.getBreadcrumbs() ?? [];
      breadcrumbCount = bcs.length;
      breadcrumbType = bcs[0]?.type ?? '';
      breadcrumbMessage = bcs[0]?.message ?? '';
      return 'ok';
    });

    await app.inject({ method: 'GET', url: '/breadcrumbs' });

    expect(breadcrumbCount).toBe(1);
    expect(breadcrumbType).toBe('http');
    expect(breadcrumbMessage).toContain('GET /breadcrumbs');
  });

  it('should strip query string from span name', async () => {
    const app = await buildApp();
    app.get('/search', async () => 'ok');

    await app.inject({ method: 'GET', url: '/search?q=hello&page=1' });

    expect(transport.spans[0].name).toBe('GET /search');
    expect(transport.spans[0].attributes['http.target']).toBe('/search');
  });

  it('should generate separate traces for multiple requests', async () => {
    const app = await buildApp();
    app.get('/multi', async () => 'ok');

    await app.inject({ method: 'GET', url: '/multi' });
    await app.inject({ method: 'GET', url: '/multi' });

    expect(transport.spans).toHaveLength(2);
    expect(transport.spans[0].traceId).not.toBe(transport.spans[1].traceId);
  });

  it('should set span timing (startTime and endTime)', async () => {
    const app = await buildApp();
    app.get('/timing', async () => 'ok');

    await app.inject({ method: 'GET', url: '/timing' });

    const span = transport.spans[0];
    expect(span.startTime).toBeGreaterThan(0);
    expect(span.endTime).toBeGreaterThan(0);
    expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
  });

  it('should work without transport (uses default)', async () => {
    const app = await buildApp();
    app.get('/', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
  });

  // ─── New richer traces tests ────────────────────────────────────────────────

  it('should set http.status_code attribute on span for 200', async () => {
    const app = await buildApp();
    app.get('/status-200', async () => 'ok');

    await app.inject({ method: 'GET', url: '/status-200' });

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(200);
  });

  it('should set http.status_code attribute on span for 404', async () => {
    const app = await buildApp();
    app.get('/status-404', async (_request, reply) => {
      reply.status(404).send('Not Found');
    });

    await app.inject({ method: 'GET', url: '/status-404' });

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(404);
  });

  it('should set http.status_code attribute on span for 500', async () => {
    const app = await buildApp();
    app.get('/status-500', async (_request, reply) => {
      reply.status(500).send('Server Error');
    });

    await app.inject({ method: 'GET', url: '/status-500' });

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(500);
  });

  it('should set http.user_agent when User-Agent header is provided', async () => {
    const app = await buildApp();
    app.get('/ua', async () => 'ok');

    await app.inject({
      method: 'GET',
      url: '/ua',
      headers: { 'user-agent': 'TestAgent/1.0' },
    });

    const span = transport.spans[0];
    expect(span.attributes['http.user_agent']).toBe('TestAgent/1.0');
  });

  it('should set duration_ms in span extraAttributes', async () => {
    const app = await buildApp();
    app.get('/duration', async () => 'ok');

    await app.inject({ method: 'GET', url: '/duration' });

    const span = transport.spans[0];
    expect(span.attributes['duration_ms']).toBeGreaterThanOrEqual(0);
    expect(typeof span.attributes['duration_ms']).toBe('number');
  });

  it('should include breadcrumbs as span events (at least request + response)', async () => {
    const app = await buildApp();
    app.get('/events', async () => 'ok');

    await app.inject({ method: 'GET', url: '/events' });

    const span = transport.spans[0];
    expect(span.events).toBeDefined();
    expect(span.events!.length).toBeGreaterThanOrEqual(2);

    // First event should be the request breadcrumb
    const requestEvent = span.events!.find(e => e.name.includes('GET /events'));
    expect(requestEvent).toBeDefined();

    // Should also have a response event
    const responseEvent = span.events!.find(e => e.name.match(/^\d{3} GET \/events$/));
    expect(responseEvent).toBeDefined();
  });

  it('should set http.query_string on span when query params are present', async () => {
    const app = await buildApp();
    app.get('/search', async () => 'ok');

    await app.inject({ method: 'GET', url: '/search?q=hello&page=1' });

    const span = transport.spans[0];
    expect(span.attributes['http.query_string']).toBe('?q=hello&page=1');
  });

  it('should set http.route when route matches', async () => {
    const app = await buildApp();
    app.get('/users/:id', async () => 'ok');

    await app.inject({ method: 'GET', url: '/users/42' });

    const span = transport.spans[0];
    // http.route should be the route template
    expect(span.attributes['http.route']).toBe('/users/:id');
  });

  it('should include duration_ms in 5xx error log metadata', async () => {
    const app = await buildApp();
    app.get('/err-log', async (_request, reply) => {
      reply.status(500).send('Server Error');
    });

    await app.inject({ method: 'GET', url: '/err-log' });

    const errLog = transport.logs.find(l => l.level === 'error');
    expect(errLog).toBeDefined();
    expect(errLog!.metadata?.duration_ms).toBeDefined();
    expect(typeof errLog!.metadata?.duration_ms).toBe('number');
  });

  it('should capture request headers when includeRequestHeaders is true', async () => {
    const customApp = Fastify();
    await customApp.register(logtide, {
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'fastify-test',
      transport,
      includeRequestHeaders: true,
    });
    customApp.get('/headers', async () => 'ok');
    app = customApp;

    await customApp.inject({
      method: 'GET',
      url: '/headers',
      headers: { 'x-request-id': 'abc123' },
    });

    const span = transport.spans[0];
    expect(span.attributes['http.request_headers']).toBeDefined();
    const headers = JSON.parse(span.attributes['http.request_headers'] as string);
    expect(headers['authorization']).toBeUndefined();
    expect(headers['cookie']).toBeUndefined();
    expect(headers['x-request-id']).toBe('abc123');
  });

  it('should capture only specified headers when includeRequestHeaders is a string array', async () => {
    const customApp = Fastify();
    await customApp.register(logtide, {
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'fastify-test',
      transport,
      includeRequestHeaders: ['x-request-id'],
    });
    customApp.get('/headers-select', async () => 'ok');
    app = customApp;

    await customApp.inject({
      method: 'GET',
      url: '/headers-select',
      headers: { 'x-request-id': 'req-42', 'x-other': 'ignored' },
    });

    const span = transport.spans[0];
    expect(span.attributes['http.request_headers']).toBeDefined();
    const headers = JSON.parse(span.attributes['http.request_headers'] as string);
    expect(headers['x-request-id']).toBe('req-42');
    expect(headers['x-other']).toBeUndefined();
  });
});
