import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineTransport } from '../src/transport/offline-transport';
import type { InternalLogEntry, Span, Transport } from '@logtide/types';

function createMockTransport(): Transport & {
  logs: InternalLogEntry[];
  spans: Span[];
  failNext: boolean;
} {
  const mock = {
    logs: [] as InternalLogEntry[],
    spans: [] as Span[],
    failNext: false,
    async sendLogs(logs: InternalLogEntry[]) {
      if (mock.failNext) {
        mock.failNext = false;
        throw new Error('Network error');
      }
      mock.logs.push(...logs);
    },
    async sendSpans(spans: Span[]) {
      if (mock.failNext) {
        mock.failNext = false;
        throw new Error('Network error');
      }
      mock.spans.push(...spans);
    },
    async flush() {},
  };
  return mock;
}

function makeLog(msg: string): InternalLogEntry {
  return {
    service: 'test',
    level: 'info',
    message: msg,
    time: new Date().toISOString(),
  };
}

function makeSpan(name: string): Span {
  return {
    traceId: 'trace-1',
    spanId: 'span-1',
    name,
    status: 'ok',
    startTime: Date.now(),
    attributes: {},
  };
}

describe('OfflineTransport', () => {
  let inner: ReturnType<typeof createMockTransport>;
  let transport: OfflineTransport;

  beforeEach(() => {
    inner = createMockTransport();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    transport?.destroy();
  });

  it('forwards logs to inner transport when online', async () => {
    transport = new OfflineTransport({ inner });

    await transport.sendLogs([makeLog('hello')]);
    expect(inner.logs).toHaveLength(1);
    expect(inner.logs[0].message).toBe('hello');
  });

  it('forwards spans to inner transport when online', async () => {
    transport = new OfflineTransport({ inner });

    await transport.sendSpans([makeSpan('test-span')]);
    expect(inner.spans).toHaveLength(1);
  });

  it('buffers logs when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({ inner });

    await transport.sendLogs([makeLog('offline-log')]);
    // Should not reach inner
    expect(inner.logs).toHaveLength(0);
  });

  it('buffers spans when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({ inner });

    await transport.sendSpans([makeSpan('offline-span')]);
    expect(inner.spans).toHaveLength(0);
  });

  it('flushes buffers when coming back online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({ inner });

    await transport.sendLogs([makeLog('buffered')]);
    expect(inner.logs).toHaveLength(0);

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    globalThis.dispatchEvent(new Event('online'));

    // Allow async flush
    await new Promise((r) => setTimeout(r, 10));

    expect(inner.logs).toHaveLength(1);
    expect(inner.logs[0].message).toBe('buffered');
  });

  it('buffers when send fails despite navigator.onLine', async () => {
    transport = new OfflineTransport({ inner });
    inner.failNext = true;

    await transport.sendLogs([makeLog('failing')]);
    // Should be buffered, not in inner
    expect(inner.logs).toHaveLength(0);
  });

  it('respects maxBufferSize', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({ inner, maxBufferSize: 2 });

    await transport.sendLogs([makeLog('one'), makeLog('two'), makeLog('three')]);

    // Flush to see how many were buffered
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await transport.flush();

    expect(inner.logs).toHaveLength(2);
    expect(inner.logs[0].message).toBe('one');
    expect(inner.logs[1].message).toBe('two');
  });

  it('flush() flushes offline buffer and inner', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({ inner });

    await transport.sendLogs([makeLog('pending')]);

    const innerFlushSpy = vi.spyOn(inner, 'flush');
    await transport.flush();

    // Logs should have been flushed from buffer to inner
    expect(inner.logs).toHaveLength(1);
    expect(innerFlushSpy).toHaveBeenCalled();
  });

  it('destroy removes event listeners and calls inner destroy', () => {
    const destroyFn = vi.fn();
    const innerWithDestroy = { ...inner, destroy: destroyFn };
    transport = new OfflineTransport({ inner: innerWithDestroy });

    transport.destroy();
    expect(destroyFn).toHaveBeenCalled();
  });

  it('uses sendBeacon on pagehide when beaconUrl is set', async () => {
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeaconSpy, configurable: true });

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    transport = new OfflineTransport({
      inner,
      beaconUrl: 'https://api.logtide.dev/api/v1/ingest',
      apiKey: 'lp_test',
    });

    await transport.sendLogs([makeLog('beacon-log')]);

    // Simulate pagehide
    globalThis.dispatchEvent(new Event('pagehide'));

    expect(sendBeaconSpy).toHaveBeenCalled();
    const [url, blob] = sendBeaconSpy.mock.calls[0];
    expect(url).toBe('https://api.logtide.dev/api/v1/ingest');
    expect(blob).toBeInstanceOf(Blob);
  });
});
