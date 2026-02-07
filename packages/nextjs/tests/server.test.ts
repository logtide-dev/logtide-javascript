import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';

function createMockTransport() {
  return {
    logs: [] as InternalLogEntry[],
    spans: [] as Span[],
    async sendLogs(logs: InternalLogEntry[]) { this.logs.push(...logs); },
    async sendSpans(spans: Span[]) { this.spans.push(...spans); },
    async flush() {},
  };
}

describe('@logtide/nextjs server', () => {
  let hub: typeof import('@logtide/core').hub;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();

    transport = createMockTransport();
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'nextjs-test',
      transport,
    });
  });

  afterEach(async () => {
    await hub.close();
  });

  describe('instrumentRequest', () => {
    it('should create a span from a request', async () => {
      const { instrumentRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost:3000/api/hello',
      };

      const result = instrumentRequest(request);

      expect(result).not.toBeNull();
      expect(result!.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(result!.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(result!.scope).toBeDefined();
      expect(result!.scope.traceId).toBe(result!.traceId);
    });

    it('should extract trace context from traceparent header', async () => {
      const { instrumentRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers({
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        }),
        method: 'POST',
        url: 'http://localhost:3000/api/submit',
      };

      const result = instrumentRequest(request);
      expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });

    it('should add an HTTP breadcrumb to the scope', async () => {
      const { instrumentRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost:3000/dashboard',
      };

      const result = instrumentRequest(request);
      const bcs = result!.scope.getBreadcrumbs();
      expect(bcs).toHaveLength(1);
      expect(bcs[0].type).toBe('http');
      expect(bcs[0].message).toContain('GET /dashboard');
    });

    it('should return null when no client is initialized', async () => {
      await hub.close();
      const { instrumentRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost:3000/',
      };

      expect(instrumentRequest(request)).toBeNull();
    });
  });

  describe('finishRequest', () => {
    it('should finish a span with ok status for 2xx', async () => {
      const { instrumentRequest, finishRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost:3000/api/data',
      };

      const result = instrumentRequest(request);
      finishRequest(result!.spanId, 200);

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].status).toBe('ok');
    });

    it('should finish a span with error status for 5xx', async () => {
      const { instrumentRequest, finishRequest } = await import('../src/server/request-handler');

      const request = {
        headers: new Headers(),
        method: 'GET',
        url: 'http://localhost:3000/api/broken',
      };

      const result = instrumentRequest(request);
      finishRequest(result!.spanId, 500);

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].status).toBe('error');
    });
  });

  describe('captureRequestError', () => {
    it('should capture an error with request context', async () => {
      const { captureRequestError } = await import('../src/server/error-handler');

      captureRequestError(
        new Error('render failed'),
        { method: 'GET', url: '/page', headers: {} },
        { routerKind: 'App Router', routePath: '/page', routeType: 'page' },
      );

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].level).toBe('error');
      expect(transport.logs[0].message).toBe('render failed');
      expect(transport.logs[0].metadata?.['route.path']).toBe('/page');
    });
  });
});
