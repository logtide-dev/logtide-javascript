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
  });

  describe('logtideHandleError', () => {
    it('should capture errors', () => {
      // First init the hub so handleError can use it
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
