import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { createMockServer, waitForLogs, waitForSpans, buildMockDSN } from 'logtide-mock-server/test-utils';
import { hub } from '@logtide/core';
import { createApp } from '../src/app.js';

describe('Hono + @logtide/hono smoke test', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockUrl: string;
  let appServer: ReturnType<typeof serve>;
  let appPort: number;

  beforeAll(async () => {
    mockServer = createMockServer();
    const mock = await mockServer.start();
    mockUrl = mock.url;

    const dsn = buildMockDSN(mockUrl);
    const app = createApp(dsn);

    appServer = serve({ fetch: app.fetch, port: 0 });
    await new Promise<void>((resolve) => {
      appServer.once('listening', () => {
        const addr = appServer.address();
        appPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await hub.close();
    await new Promise<void>((resolve, reject) => {
      appServer.close((err) => (err ? reject(err) : resolve()));
    });
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('should send request logs on incoming HTTP requests', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-log`);
    expect(res.status).toBe(200);

    const logs = await waitForLogs(mockUrl, 1);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const manualLog = logs.find((l) => l.message === 'manual log from hono');
    expect(manualLog).toBeDefined();
    expect(manualLog!.service).toBe('test-hono');
    expect(manualLog!.level).toBe('info');
  });

  it('should capture errors as error logs', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-error`);
    expect(res.status).toBe(500);

    const logs = await waitForLogs(mockUrl, 1);
    const errorLog = logs.find((l) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.service).toBe('test-hono');
  });

  it('should include trace_id in logs', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 1);
    const log = logs.find((l) => l.message === 'manual log from hono');
    expect(log).toBeDefined();
    expect(log!.trace_id).toBeDefined();
    expect(log!.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should include metadata in logs', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 1);
    const log = logs.find((l) => l.message === 'manual log from hono');
    expect(log).toBeDefined();
    expect(log!.metadata).toBeDefined();
    expect(log!.metadata!.environment).toBe('test');
    expect(log!.metadata!.route).toBe('/test-log');
  });

  it('should send OTLP spans for requests', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const spans = await waitForSpans(mockUrl, 1);
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const span = spans.find((s) => s.name?.includes('GET /test-log'));
    expect(span).toBeDefined();
    expect(span!.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span!.spanId).toBeDefined();
    expect(span!.serviceName).toBe('test-hono');
    expect(span!.status?.code).toBe(1); // OK
  });

  it('should send error spans for failed requests', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-error`);

    const spans = await waitForSpans(mockUrl, 1);
    const errorSpan = spans.find((s) => s.name?.includes('GET /test-error'));
    expect(errorSpan).toBeDefined();
    expect(errorSpan!.status?.code).toBe(2); // ERROR
  });

  it('should return traceparent header in response', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-log`);
    const traceparent = res.headers.get('traceparent');
    expect(traceparent).toBeDefined();
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});
