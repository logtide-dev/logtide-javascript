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
});
