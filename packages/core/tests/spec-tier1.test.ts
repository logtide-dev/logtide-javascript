import { describe, it, expect, vi, afterEach } from 'vitest';
import { LogtideClient } from '../src/client';
import { parseDSN } from '../src/dsn';
import { LogtideHttpTransport } from '../src/transport/logtide-http';
import { BatchTransport } from '../src/transport/batch';
import { SDK_NAME, SDK_VERSION } from '../src/version';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';

function createMockTransport(): Transport & { logs: InternalLogEntry[] } {
  const transport = {
    logs: [] as InternalLogEntry[],
    async sendLogs(logs: InternalLogEntry[]) {
      transport.logs.push(...logs);
    },
    async sendSpans(_spans: Span[]) {},
    async flush() {},
  };
  return transport;
}

// ───────────────────────────────────────────── metadata.sdk (spec 003 §3)

describe('sdk metadata stamp', () => {
  it('stamps metadata.sdk on every entry', async () => {
    const transport = createMockTransport();
    const client = new LogtideClient({
      dsn: 'https://lp_key@api.logtide.dev',
      service: 'svc',
      transport,
    });
    client.captureLog('info', 'hello');
    await client.close();

    expect(transport.logs).toHaveLength(1);
    const sdk = transport.logs[0].metadata?.sdk as { name: string; version: string };
    expect(sdk.name).toBe(SDK_NAME);
    expect(sdk.version).toBe(SDK_VERSION);
    expect(SDK_NAME).toBe('logtide-javascript');
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('caller-provided sdk metadata wins', async () => {
    const transport = createMockTransport();
    const client = new LogtideClient({
      dsn: 'https://lp_key@api.logtide.dev',
      service: 'svc',
      transport,
    });
    client.captureLog('info', 'hello', { sdk: 'custom' });
    await client.close();

    expect(transport.logs[0].metadata?.sdk).toBe('custom');
  });
});

// ──────────────────────────────────────────── DSN base path (spec 002 §3)

describe('DSN base path', () => {
  it('preserves the path as a base-path prefix', () => {
    const dsn = parseDSN('https://lp_key@logs.example.com/logtide');
    expect(dsn.apiUrl).toBe('https://logs.example.com/logtide');
    expect(dsn.apiKey).toBe('lp_key');
  });

  it('strips a trailing slash from the path', () => {
    const dsn = parseDSN('https://lp_key@logs.example.com/logtide/');
    expect(dsn.apiUrl).toBe('https://logs.example.com/logtide');
  });

  it('still parses a path-less DSN', () => {
    const dsn = parseDSN('https://lp_key@logs.example.com');
    expect(dsn.apiUrl).toBe('https://logs.example.com');
  });
});

// ─────────────────────────────── retry classification + Retry-After (002 §6)

describe('retry behaviour', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function fetchResponding(...statuses: number[]) {
    let call = 0;
    const mock = vi.fn(async () => {
      const status = statuses[Math.min(call, statuses.length - 1)];
      call += 1;
      return new Response('err', { status, headers: status === 429 ? { 'Retry-After': '0' } : {} });
    });
    vi.stubGlobal('fetch', mock);
    return mock;
  }

  function makeBatch(inner: Transport): BatchTransport {
    return new BatchTransport({
      inner,
      batchSize: 100,
      flushInterval: 60000,
      maxRetries: 3,
      retryDelayMs: 1,
    });
  }

  it('does not retry permanent 4xx failures', async () => {
    const mock = fetchResponding(400);
    const inner = new LogtideHttpTransport({ apiUrl: 'http://x', apiKey: 'k' });
    const batch = makeBatch(inner);
    await batch.sendLogs([{ service: 's', level: 'info', message: 'm', time: '', metadata: {} }]);
    await batch.flush();
    batch.destroy();

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('retries 429 and 5xx', async () => {
    const mock = fetchResponding(429, 500, 200);
    const inner = new LogtideHttpTransport({ apiUrl: 'http://x', apiKey: 'k' });
    const batch = makeBatch(inner);
    await batch.sendLogs([{ service: 's', level: 'info', message: 'm', time: '', metadata: {} }]);
    await batch.flush();
    batch.destroy();

    expect(mock).toHaveBeenCalledTimes(3);
  });

  it('honours Retry-After on 429', async () => {
    let call = 0;
    const mock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return new Response('slow down', { status: 429, headers: { 'Retry-After': '2' } });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', mock);

    const inner = new LogtideHttpTransport({ apiUrl: 'http://x', apiKey: 'k' });
    const batch = makeBatch(inner);
    await batch.sendLogs([{ service: 's', level: 'info', message: 'm', time: '', metadata: {} }]);

    const start = Date.now();
    await batch.flush();
    batch.destroy();
    const elapsed = Date.now() - start;

    expect(mock).toHaveBeenCalledTimes(2);
    // Retry-After: 2 seconds must override the 1ms backoff
    expect(elapsed).toBeGreaterThanOrEqual(1900);
  }, 10000);
});
