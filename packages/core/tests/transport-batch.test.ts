import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchTransport } from '../src/transport/batch';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';

function makeMockInner(): Transport & {
  sentLogs: InternalLogEntry[][];
  sentSpans: Span[][];
  shouldFail: boolean;
  callCount: number;
} {
  const mock = {
    sentLogs: [] as InternalLogEntry[][],
    sentSpans: [] as Span[][],
    shouldFail: false,
    callCount: 0,
    async sendLogs(logs: InternalLogEntry[]) {
      mock.callCount++;
      if (mock.shouldFail) throw new Error('send failed');
      mock.sentLogs.push([...logs]);
    },
    async sendSpans(spans: Span[]) {
      mock.callCount++;
      if (mock.shouldFail) throw new Error('send failed');
      mock.sentSpans.push([...spans]);
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
    traceId: 'aaaa',
    spanId: 'bbbb',
    name,
    status: 'ok',
    startTime: Date.now(),
    endTime: Date.now() + 100,
    attributes: {},
  };
}

describe('BatchTransport', () => {
  it('should batch logs and flush when batch size reached', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 3,
      flushInterval: 999999, // high to prevent auto-flush
      maxRetries: 0,
    });

    await batch.sendLogs([makeLog('a')]);
    await batch.sendLogs([makeLog('b')]);
    expect(inner.sentLogs).toHaveLength(0);

    await batch.sendLogs([makeLog('c')]);
    expect(inner.sentLogs).toHaveLength(1);
    expect(inner.sentLogs[0]).toHaveLength(3);

    batch.destroy();
  });

  it('should batch spans and flush when batch size reached', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 3,
      flushInterval: 999999,
      maxRetries: 0,
    });

    await batch.sendSpans([makeSpan('s1'), makeSpan('s2'), makeSpan('s3')]);
    expect(inner.sentSpans).toHaveLength(1);
    expect(inner.sentSpans[0]).toHaveLength(3);

    batch.destroy();
  });

  it('should flush both logs and spans on explicit flush', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 1000,
      flushInterval: 999999,
      maxRetries: 0,
    });

    await batch.sendLogs([makeLog('l1')]);
    await batch.sendSpans([makeSpan('s1')]);
    await batch.flush();

    expect(inner.sentLogs).toHaveLength(1);
    expect(inner.sentSpans).toHaveLength(1);

    batch.destroy();
  });

  it('should retry on failure then give up', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 2,
      flushInterval: 999999,
      maxRetries: 1,
      retryDelayMs: 1, // 1ms to make test fast
    });

    inner.shouldFail = true;
    await batch.sendLogs([makeLog('a'), makeLog('b')]);

    // Should have attempted 2 times (1 initial + 1 retry)
    expect(inner.callCount).toBe(2);
    // Both failed, so sentLogs should be empty
    expect(inner.sentLogs).toHaveLength(0);

    batch.destroy();
  });

  it('should drop logs when buffer is full', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 1000,
      flushInterval: 999999,
      maxBufferSize: 2,
      maxRetries: 0,
    });

    await batch.sendLogs([makeLog('a'), makeLog('b'), makeLog('c')]);
    await batch.flush();

    // Only first 2 should be sent (maxBufferSize = 2)
    expect(inner.sentLogs[0]).toHaveLength(2);

    batch.destroy();
  });

  it('should flush on interval timer', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 1000,
      flushInterval: 50, // 50ms interval
      maxRetries: 0,
    });

    await batch.sendLogs([makeLog('interval-test')]);
    expect(inner.sentLogs).toHaveLength(0);

    // Wait for the interval to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(inner.sentLogs).toHaveLength(1);
    expect(inner.sentLogs[0][0].message).toBe('interval-test');

    batch.destroy();
  });

  it('should not flush when empty', async () => {
    const inner = makeMockInner();
    const batch = new BatchTransport({
      inner,
      batchSize: 1000,
      flushInterval: 999999,
      maxRetries: 0,
    });

    await batch.flush();
    expect(inner.callCount).toBe(0);

    batch.destroy();
  });
});
