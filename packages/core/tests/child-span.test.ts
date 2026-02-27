import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';
import { LogtideClient } from '../src/client';
import { hub } from '../src/hub';
import { Scope } from '../src/scope';
import { startChildSpan, finishChildSpan } from '../src/child-span';

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

describe('child-span', () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    // Ensure hub is clean before each test
    await hub.close();
    transport = createMockTransport();
  });

  afterEach(async () => {
    await hub.close();
  });

  describe('startChildSpan', () => {
    it('creates a span with correct traceId and parentSpanId from scope when client is active', () => {
      hub.init({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'test-service',
        transport,
      });

      const scope = new Scope('abc123traceId00000000000000000000');
      scope.spanId = 'parentSpan000001';

      const span = startChildSpan('child-op', scope, { 'http.method': 'GET' });

      expect(span.traceId).toBe('abc123traceId00000000000000000000');
      expect(span.parentSpanId).toBe('parentSpan000001');
      expect(span.name).toBe('child-op');
      expect(span.attributes['http.method']).toBe('GET');
      // Should be a real span (not no-op)
      expect(span.spanId).not.toBe('0000000000000000');
    });

    it('returns a no-op span (spanId = 0000000000000000) when no client is registered', () => {
      // hub is closed (no client), so getClient() returns null
      const scope = new Scope('traceid-no-client-00000000000000');
      scope.spanId = 'parent-no-client-1';

      const span = startChildSpan('noop-op', scope);

      expect(span.spanId).toBe('0000000000000000');
      expect(span.traceId).toBe('traceid-no-client-00000000000000');
      expect(span.name).toBe('noop-op');
      expect(span.status).toBe('unset');
    });
  });

  describe('finishChildSpan', () => {
    it('finishes a span with ok status when client is active', () => {
      hub.init({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'test-service',
        transport,
      });

      const client = hub.getClient()!;
      const span = client.startSpan({ name: 'finish-test' });

      finishChildSpan(span.spanId, 'ok');

      expect(transport.spans).toHaveLength(1);
      expect(transport.spans[0].status).toBe('ok');
      expect(transport.spans[0].endTime).toBeDefined();
    });

    it('passes extraAttributes and events through to the client finishSpan', () => {
      hub.init({
        dsn: 'https://lp_key@api.logtide.dev/proj',
        service: 'test-service',
        transport,
      });

      const client = hub.getClient()!;
      const span = client.startSpan({ name: 'enriched-child-span', attributes: { 'http.method': 'POST' } });

      finishChildSpan(span.spanId, 'ok', {
        extraAttributes: { 'http.status_code': 201 },
        events: [{ name: 'response', timestamp: 1700000000000, attributes: { type: 'http' } }],
      });

      expect(transport.spans).toHaveLength(1);
      const finished = transport.spans[0];
      expect(finished.status).toBe('ok');
      expect(finished.attributes['http.method']).toBe('POST');
      expect(finished.attributes['http.status_code']).toBe(201);
      expect(finished.events).toHaveLength(1);
      expect(finished.events![0].name).toBe('response');
      expect(finished.events![0].timestamp).toBe(1700000000000);
    });
  });
});
