import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockServer, waitForLogs, waitForSpans, buildMockDSN } from 'logtide-mock-server/test-utils';
import { hub } from '@logtide/core';
import { createApp } from '../src/app.js';

describe('Elysia + @logtide/elysia smoke test', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockUrl: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    mockServer = createMockServer();
    const mock = await mockServer.start();
    mockUrl = mock.url;

    const dsn = buildMockDSN(mockUrl);
    app = createApp(dsn);
  });

  afterAll(async () => {
    await hub.close();
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('should send logs on incoming HTTP requests', async () => {
    const res = await app.handle(new Request('http://localhost/test-log'));
    expect(res.status).toBe(200);

    const logs = await waitForLogs(mockUrl, 1);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const manualLog = logs.find((l) => l.message === 'manual log from elysia');
    expect(manualLog).toBeDefined();
    expect(manualLog!.service).toBe('test-elysia');
    expect(manualLog!.level).toBe('info');
  });

  it('should capture errors', async () => {
    const res = await app.handle(new Request('http://localhost/test-error'));
    expect(res.status).toBe(500);

    const logs = await waitForLogs(mockUrl, 1);
    const errorLog = logs.find((l) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.service).toBe('test-elysia');
  });

  it('should capture error logs with trace_id from middleware', async () => {
    const res = await app.handle(new Request('http://localhost/test-error'));
    expect(res.status).toBe(500);

    const logs = await waitForLogs(mockUrl, 1);
    const errorLog = logs.find((l) => l.level === 'error');
    expect(errorLog).toBeDefined();
    // Error logs from middleware include trace_id via scope
    expect(errorLog!.trace_id).toBeDefined();
    expect(errorLog!.trace_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should include metadata in logs', async () => {
    await app.handle(new Request('http://localhost/test-log'));

    const logs = await waitForLogs(mockUrl, 1);
    const log = logs.find((l) => l.message === 'manual log from elysia');
    expect(log).toBeDefined();
    expect(log!.metadata).toBeDefined();
    expect(log!.metadata!.environment).toBe('test');
    expect(log!.metadata!.route).toBe('/test-log');
  });

  it('should send OTLP spans for requests', async () => {
    await app.handle(new Request('http://localhost/test-log'));

    const spans = await waitForSpans(mockUrl, 1);
    expect(spans.length).toBeGreaterThanOrEqual(1);

    const span = spans.find((s) => s.name?.includes('GET /test-log'));
    expect(span).toBeDefined();
    expect(span!.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span!.spanId).toBeDefined();
    expect(span!.serviceName).toBe('test-elysia');
    expect(span!.status?.code).toBe(1); // OK
  });

  it('should send error spans for failed requests', async () => {
    await app.handle(new Request('http://localhost/test-error'));

    const spans = await waitForSpans(mockUrl, 1);
    const errorSpan = spans.find((s) => s.name?.includes('GET /test-error'));
    expect(errorSpan).toBeDefined();
    expect(errorSpan!.status?.code).toBe(2); // ERROR
  });
});
