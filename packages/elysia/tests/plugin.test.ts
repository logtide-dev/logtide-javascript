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
});
