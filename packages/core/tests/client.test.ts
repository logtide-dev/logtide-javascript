import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogtideClient } from '../src/client';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';

function createMockTransport(): Transport & {
  logs: InternalLogEntry[];
  spans: Span[];
} {
  const transport = {
    logs: [] as InternalLogEntry[],
    spans: [] as Span[],
    async sendLogs(logs: InternalLogEntry[]) {
      transport.logs.push(...logs);
    },
    async sendSpans(spans: Span[]) {
      transport.spans.push(...spans);
    },
    async flush() {},
  };
  return transport;
}

describe('LogtideClient', () => {
  let client: LogtideClient;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
    client = new LogtideClient({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test-service',
      environment: 'test',
      release: '1.0.0',
      transport,
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it('should initialize correctly', () => {
    expect(client.isInitialized).toBe(true);
    expect(client.service).toBe('test-service');
    expect(client.environment).toBe('test');
    expect(client.release).toBe('1.0.0');
  });

  it('should capture a log', () => {
    client.captureLog('info', 'hello world', { key: 'value' });

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].service).toBe('test-service');
    expect(transport.logs[0].level).toBe('info');
    expect(transport.logs[0].message).toBe('hello world');
    expect(transport.logs[0].metadata?.key).toBe('value');
    expect(transport.logs[0].metadata?.environment).toBe('test');
    expect(transport.logs[0].metadata?.release).toBe('1.0.0');
    expect(transport.logs[0].time).toBeDefined();
  });

  it('should capture an error from Error instance', () => {
    const err = new Error('boom');
    client.captureError(err, { extra: 'data' });

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].level).toBe('error');
    expect(transport.logs[0].message).toBe('boom');
    expect(transport.logs[0].metadata?.exception).toBeDefined();
    expect(transport.logs[0].metadata?.extra).toBe('data');
  });

  it('should capture an error from string', () => {
    client.captureError('string error');

    expect(transport.logs).toHaveLength(1);
    expect(transport.logs[0].message).toBe('string error');
  });

  it('should add and retrieve breadcrumbs', () => {
    client.addBreadcrumb({ type: 'http', message: 'request', timestamp: 1 });
    client.addBreadcrumb({ type: 'console', message: 'log', timestamp: 2 });

    const bcs = client.getBreadcrumbs();
    expect(bcs).toHaveLength(2);
  });

  it('should attach breadcrumbs to logs when no scope', () => {
    client.addBreadcrumb({ type: 'http', message: 'GET /api', timestamp: 1 });
    client.captureLog('info', 'test');

    expect(transport.logs[0].breadcrumbs).toHaveLength(1);
    expect(transport.logs[0].breadcrumbs![0].message).toBe('GET /api');
  });

  it('should start and finish spans', () => {
    const span = client.startSpan({ name: 'test-span' });

    expect(span.name).toBe('test-span');
    expect(span.traceId).toBeDefined();
    expect(span.spanId).toBeDefined();

    client.finishSpan(span.spanId, 'ok');

    expect(transport.spans).toHaveLength(1);
    expect(transport.spans[0].status).toBe('ok');
    expect(transport.spans[0].endTime).toBeDefined();
  });

  it('should create a scope with traceId', () => {
    const scope = client.createScope('my-trace');
    expect(scope.traceId).toBe('my-trace');
  });

  it('should create a scope with auto traceId', () => {
    const scope = client.createScope();
    expect(scope.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should use scope traceId in logs', () => {
    const scope = client.createScope('scope-trace-123');
    client.captureLog('info', 'scoped log', {}, scope);

    expect(transport.logs[0].trace_id).toBe('scope-trace-123');
  });

  it('should flush transport', async () => {
    const flushSpy = vi.spyOn(transport, 'flush');
    await client.flush();
    expect(flushSpy).toHaveBeenCalled();
  });

  it('should close and uninitialize', async () => {
    await client.close();
    expect(client.isInitialized).toBe(false);
  });

  it('should handle tracesSampleRate = 0', () => {
    const c = new LogtideClient({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test',
      transport,
      tracesSampleRate: 0,
    });

    const span = c.startSpan({ name: 'sampled-out' });
    // A span with tracesSampleRate=0 creates a no-op span
    expect(span.spanId).toBe('0000000000000000');
  });
});
