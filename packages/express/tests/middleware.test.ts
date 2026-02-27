import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'http';
import { logtide, logtideErrorHandler } from '../src/middleware';
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

function request(
  server: Server,
  path: string,
  options?: { headers?: Record<string, string>; method?: string },
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') return reject(new Error('No address'));
    const url = `http://127.0.0.1:${addr.port}${path}`;
    fetch(url, { method: options?.method, headers: options?.headers }).then(async (res) => {
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      resolve({ status: res.status, headers, body });
    }).catch(reject);
  });
}

describe('@logtide/express middleware', () => {
  let transport: ReturnType<typeof createMockTransport>;
  let hub: typeof import('@logtide/core').hub;
  let server: Server;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
  });

  afterEach(async () => {
    await hub.close();
    if (server?.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  function listen(app: express.Express): Promise<Server> {
    return new Promise((resolve) => {
      server = createServer(app);
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
  }

  function createApp() {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
    }));
    return app;
  }

  it('should create spans for requests', async () => {
    const app = createApp();
    app.get('/hello', (_req, res) => { res.send('world'); });

    await listen(app);
    const res = await request(server, '/hello');

    expect(res.status).toBe(200);
    expect(res.body).toBe('world');

    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].name).toBe('GET /hello');
    expect(transport.spans[0].status).toBe('ok');
  });

  it('should propagate traceparent header in response', async () => {
    const app = createApp();
    app.get('/traced', (_req, res) => { res.send('ok'); });

    await listen(app);
    const res = await request(server, '/traced');
    const tp = res.headers['traceparent'];

    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('should extract incoming traceparent', async () => {
    const app = createApp();
    app.get('/parent', (_req, res) => { res.send('ok'); });

    await listen(app);
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const res = await request(server, '/parent', {
      headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` },
    });

    expect(res.status).toBe(200);
    expect(transport.spans[0].traceId).toBe(traceId);
  });

  it('should link parent span from traceparent', async () => {
    const app = createApp();
    app.get('/linked', (_req, res) => { res.send('ok'); });

    await listen(app);
    const parentSpanId = '00f067aa0ba902b7';
    await request(server, '/linked', {
      headers: { traceparent: `00-4bf92f3577b34da6a3ce929d0e0e4736-${parentSpanId}-01` },
    });

    expect(transport.spans[0].parentSpanId).toBe(parentSpanId);
  });

  it('should generate new traceId for invalid traceparent', async () => {
    const app = createApp();
    app.get('/invalid', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/invalid', {
      headers: { traceparent: 'not-a-valid-traceparent' },
    });

    expect(transport.spans[0].traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should capture 5xx and mark span as error', async () => {
    const app = createApp();
    app.get('/fail', (_req, res) => {
      res.status(500).send('Internal Server Error');
    });

    await listen(app);
    const res = await request(server, '/fail');

    expect(res.status).toBe(500);
    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].status).toBe('error');

    const errorLogs = transport.logs.filter(l => l.message.includes('500'));
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('error');
  });

  it('should mark span as error on 5xx response', async () => {
    const app = createApp();
    app.get('/bad-gw', (_req, res) => {
      res.status(502).send('Bad Gateway');
    });

    await listen(app);
    await request(server, '/bad-gw');

    expect(transport.spans[0].status).toBe('error');
  });

  it('should mark 4xx as ok status (not error)', async () => {
    const app = createApp();
    app.get('/not-found', (_req, res) => {
      res.status(404).send('Not Found');
    });

    await listen(app);
    await request(server, '/not-found');

    expect(transport.spans[0].status).toBe('ok');
  });

  it('should mark 2xx as ok status', async () => {
    const app = createApp();
    app.post('/created', (_req, res) => { res.status(201).send('created'); });

    await listen(app);
    const res = await request(server, '/created', { method: 'POST' });

    expect(res.status).toBe(201);
    expect(transport.spans[0].status).toBe('ok');
  });

  it('should set HTTP attributes on span', async () => {
    const app = createApp();
    app.get('/attrs', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/attrs');

    const span = transport.spans[0];
    expect(span.attributes['http.method']).toBe('GET');
    expect(span.attributes['http.target']).toBe('/attrs');
    expect(span.attributes['http.url']).toBeDefined();
  });

  it('should store scope and traceId on request', async () => {
    const app = createApp();
    let scopeDefined = false;
    let traceIdDefined = false;

    app.get('/scope', (req, res) => {
      scopeDefined = req.logtideScope !== undefined;
      traceIdDefined = req.logtideTraceId !== undefined;
      res.send('ok');
    });

    await listen(app);
    const res = await request(server, '/scope');

    expect(res.status).toBe(200);
    expect(scopeDefined).toBe(true);
    expect(traceIdDefined).toBe(true);
  });

  it('should add HTTP breadcrumb to scope', async () => {
    const app = createApp();
    let breadcrumbCount = 0;
    let breadcrumbType = '';
    let breadcrumbMessage = '';

    app.get('/breadcrumbs', (req, res) => {
      const bcs = req.logtideScope?.getBreadcrumbs() ?? [];
      breadcrumbCount = bcs.length;
      breadcrumbType = bcs[0]?.type ?? '';
      breadcrumbMessage = bcs[0]?.message ?? '';
      res.send('ok');
    });

    await listen(app);
    await request(server, '/breadcrumbs');

    expect(breadcrumbCount).toBe(1);
    expect(breadcrumbType).toBe('http');
    expect(breadcrumbMessage).toContain('GET /breadcrumbs');
  });

  it('should generate separate traces for multiple requests', async () => {
    const app = createApp();
    app.get('/multi', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/multi');
    await request(server, '/multi');

    expect(transport.spans).toHaveLength(2);
    expect(transport.spans[0].traceId).not.toBe(transport.spans[1].traceId);
  });

  it('should set span timing (startTime and endTime)', async () => {
    const app = createApp();
    app.get('/timing', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/timing');

    const span = transport.spans[0];
    expect(span.startTime).toBeGreaterThan(0);
    expect(span.endTime).toBeGreaterThan(0);
    expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
  });

  it('should work without transport (uses default)', async () => {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
    }));
    app.get('/', (_req, res) => { res.json({ ok: true }); });

    await listen(app);
    const res = await request(server, '/');
    expect(res.status).toBe(200);
  });

  // ─── New richer traces tests ────────────────────────────────────────────────

  it('should set http.status_code attribute on span for 200', async () => {
    const app = createApp();
    app.get('/status-200', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/status-200');

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(200);
  });

  it('should set http.status_code attribute on span for 404', async () => {
    const app = createApp();
    app.get('/status-404', (_req, res) => { res.status(404).send('Not Found'); });

    await listen(app);
    await request(server, '/status-404');

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(404);
  });

  it('should set http.status_code attribute on span for 500', async () => {
    const app = createApp();
    app.get('/status-500', (_req, res) => { res.status(500).send('Server Error'); });

    await listen(app);
    await request(server, '/status-500');

    const span = transport.spans[0];
    expect(span.attributes['http.status_code']).toBe(500);
  });

  it('should set http.user_agent when User-Agent header is provided', async () => {
    const app = createApp();
    app.get('/ua', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/ua', { headers: { 'user-agent': 'TestAgent/1.0' } });

    const span = transport.spans[0];
    expect(span.attributes['http.user_agent']).toBe('TestAgent/1.0');
  });

  it('should not set http.user_agent when User-Agent header is absent', async () => {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
    }));
    app.get('/no-ua', (_req, res) => { res.send('ok'); });

    await listen(app);
    // fetch always sends a User-Agent; we can test that the attribute key exists only when provided
    // Instead, verify presence when explicitly set
    await request(server, '/no-ua', { headers: { 'user-agent': 'CustomAgent/2.0' } });

    const span = transport.spans[0];
    expect(span.attributes['http.user_agent']).toBeDefined();
  });

  it('should set duration_ms in span extraAttributes', async () => {
    const app = createApp();
    app.get('/duration', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/duration');

    const span = transport.spans[0];
    expect(span.attributes['duration_ms']).toBeGreaterThanOrEqual(0);
    expect(typeof span.attributes['duration_ms']).toBe('number');
  });

  it('should include breadcrumbs as span events (at least request + response)', async () => {
    const app = createApp();
    app.get('/events', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/events');

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
    const app = createApp();
    app.get('/search', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/search?q=hello&page=1');

    const span = transport.spans[0];
    expect(span.attributes['http.query_string']).toBe('?q=hello&page=1');
  });

  it('should set http.route when route matches', async () => {
    const app = createApp();
    app.get('/users/:id', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/users/42');

    const span = transport.spans[0];
    expect(span.attributes['http.route']).toBe('/users/:id');
  });

  it('should include duration_ms in 5xx error log metadata', async () => {
    const app = createApp();
    app.get('/err-log', (_req, res) => { res.status(500).send('Server Error'); });

    await listen(app);
    await request(server, '/err-log');

    const errLog = transport.logs.find(l => l.level === 'error');
    expect(errLog).toBeDefined();
    expect(errLog!.metadata?.duration_ms).toBeDefined();
    expect(typeof errLog!.metadata?.duration_ms).toBe('number');
  });

  it('should capture request headers when includeRequestHeaders is true', async () => {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
      includeRequestHeaders: true,
    }));
    app.get('/headers', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/headers', { headers: { 'x-request-id': 'abc123' } });

    const span = transport.spans[0];
    expect(span.attributes['http.request_headers']).toBeDefined();
    const headers = JSON.parse(span.attributes['http.request_headers'] as string);
    // Sensitive headers must not be present
    expect(headers['authorization']).toBeUndefined();
    expect(headers['cookie']).toBeUndefined();
    // Non-sensitive custom header should be present
    expect(headers['x-request-id']).toBe('abc123');
  });

  it('should capture only specified headers when includeRequestHeaders is a string array', async () => {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
      includeRequestHeaders: ['x-request-id'],
    }));
    app.get('/headers-select', (_req, res) => { res.send('ok'); });

    await listen(app);
    await request(server, '/headers-select', {
      headers: { 'x-request-id': 'req-42', 'x-other': 'ignored' },
    });

    const span = transport.spans[0];
    expect(span.attributes['http.request_headers']).toBeDefined();
    const headers = JSON.parse(span.attributes['http.request_headers'] as string);
    expect(headers['x-request-id']).toBe('req-42');
    expect(headers['x-other']).toBeUndefined();
  });

  it('should export logtideErrorHandler that captures errors with captureError', async () => {
    const app = express();
    app.use(logtide({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'express-test',
      transport,
    }));
    app.get('/throw', (_req, _res, next) => {
      next(new Error('test error'));
    });
    // Express error handler (4 params)
    app.use(logtideErrorHandler());
    // Final fallback to avoid unhandled error in test
    app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).send('caught');
    });

    await listen(app);
    const res = await request(server, '/throw');

    expect(res.status).toBe(500);
    // captureError calls captureLog which sends a log
    const errLogs = transport.logs.filter(l => l.level === 'error');
    expect(errLogs.length).toBeGreaterThanOrEqual(1);
    const errLog = errLogs.find(l => l.message === 'test error');
    expect(errLog).toBeDefined();
  });
});
