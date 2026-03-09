import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logtideHandle, logtideHandleError, logtideHandleFetch } from '../src/server/index';
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

describe('@logtide/sveltekit', () => {
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

  describe('logtideHandle', () => {
    it('should create a handle hook and process requests', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const mockResponse = new Response('ok', { status: 200 });
      const event = {
        request: new Request('http://localhost/dashboard'),
        url: new URL('http://localhost/dashboard'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(mockResponse);
      const response = await handle({ event, resolve });

      expect(resolve).toHaveBeenCalledWith(event);
      expect(response.status).toBe(200);

      // Should have recorded a span
      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].name).toBe('GET /dashboard');
      expect(transport.spans[0].status).toBe('ok');
    });

    it('should inject traceparent into response', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/page'),
        url: new URL('http://localhost/page'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      const response = await handle({ event, resolve });

      expect(response.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    });

    it('should extract incoming traceparent', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const event = {
        request: new Request('http://localhost/data', {
          headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` },
        }),
        url: new URL('http://localhost/data'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      await handle({ event, resolve });

      expect(transport.spans[0].traceId).toBe(traceId);
    });

    it('should mark span as error on 5xx response', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/broken'),
        url: new URL('http://localhost/broken'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));
      await handle({ event, resolve });

      expect(transport.spans[0].status).toBe('error');
    });

    it('should capture errors thrown by resolve', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/throw'),
        url: new URL('http://localhost/throw'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockRejectedValue(new Error('resolve boom'));

      await expect(handle({ event, resolve })).rejects.toThrow('resolve boom');

      expect(transport.spans[0].status).toBe('error');
      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].level).toBe('error');
    });

    it('should store scope in locals', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const locals = {} as Record<string, unknown>;
      const event = {
        request: new Request('http://localhost/locals-check'),
        url: new URL('http://localhost/locals-check'),
        locals,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      await handle({ event, resolve });

      expect(locals.__logtideScope).toBeDefined();
      expect(locals.__logtideSpanId).toBeDefined();
    });

    it('should record http.status_code and duration_ms in span attributes', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/api/data'),
        url: new URL('http://localhost/api/data'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      await handle({ event, resolve });

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].attributes?.['http.status_code']).toBe(200);
      expect(typeof transport.spans[0].attributes?.['duration_ms']).toBe('number');
    });

    it('should capture user-agent in span attributes when provided', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/api/ua', {
          headers: { 'user-agent': 'SvelteAgent/2.0' },
        }),
        url: new URL('http://localhost/api/ua'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      await handle({ event, resolve });

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].attributes?.['http.user_agent']).toBe('SvelteAgent/2.0');
    });

    it('should attach breadcrumb events to span', async () => {
      const handle = logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const event = {
        request: new Request('http://localhost/api/events'),
        url: new URL('http://localhost/api/events'),
        locals: {} as Record<string, unknown>,
      };

      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      await handle({ event, resolve });

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].events).toBeDefined();
      expect(transport.spans[0].events!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('logtideHandleError', () => {
    it('should capture errors', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('unhandled error'),
        status: 500,
        message: 'Internal Error',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].level).toBe('error');
    });

    it('should use http.status_code (not http.status) in error metadata', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('not found'),
        status: 404,
        message: 'Not Found',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].metadata?.['http.status_code']).toBe(404);
      expect(transport.logs[0].metadata?.['http.status']).toBeUndefined();
    });

    it('should include route id when event has route', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('route error'),
        event: {
          request: new Request('http://localhost/blog/123'),
          url: new URL('http://localhost/blog/123'),
          route: { id: '/blog/[slug]' },
          locals: {},
        },
        status: 500,
        message: 'Internal Error',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].metadata?.['sveltekit.route']).toBe('/blog/[slug]');
    });

    it('should tag as server context when scope exists in locals', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('server load error'),
        event: {
          request: new Request('http://localhost/page'),
          url: new URL('http://localhost/page'),
          route: { id: '/page' },
          locals: { __logtideScope: {} },
        },
        status: 500,
        message: 'Internal Error',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].metadata?.['sveltekit.context']).toBe('server');
    });

    it('should tag as client context when no scope in locals', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('client error'),
        event: {
          request: new Request('http://localhost/page'),
          url: new URL('http://localhost/page'),
          route: { id: '/page' },
          locals: {},
        },
        status: 500,
        message: 'Internal Error',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].metadata?.['sveltekit.context']).toBe('client');
    });

    it('should include mechanism tag', () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleError = logtideHandleError();

      handleError({
        error: new Error('error'),
        status: 500,
        message: 'error',
      });

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].metadata?.mechanism).toBe('sveltekit.handleError');
    });
  });

  describe('logtideHandleFetch', () => {
    it('should propagate traceparent header', async () => {
      logtideHandle({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'sveltekit-test',
        transport,
      });

      const handleFetch = logtideHandleFetch();

      const scope = { traceId: 'aabbccdd', spanId: '11223344' };
      const event = { locals: { __logtideScope: scope } } as unknown;
      const request = new Request('http://api.example.com/data');
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));

      await handleFetch({ event, request, fetch: mockFetch } as unknown as Parameters<typeof handleFetch>[0]);

      const calledReq = mockFetch.mock.calls[0][0] as Request;
      expect(calledReq.headers.get('traceparent')).toContain('aabbccdd');
    });
  });
});
