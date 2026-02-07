import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpanManager } from '../src/span-manager';

describe('SpanManager', () => {
  let sm: SpanManager;

  beforeEach(() => {
    sm = new SpanManager();
  });

  it('should start a span with generated IDs', () => {
    const span = sm.startSpan({ name: 'test-span' });

    expect(span.name).toBe('test-span');
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.status).toBe('unset');
    expect(span.startTime).toBeGreaterThan(0);
    expect(span.endTime).toBeUndefined();
  });

  it('should use provided traceId and parentSpanId', () => {
    const span = sm.startSpan({
      name: 'child',
      traceId: 'aaaa',
      parentSpanId: 'bbbb',
    });

    expect(span.traceId).toBe('aaaa');
    expect(span.parentSpanId).toBe('bbbb');
  });

  it('should accept attributes', () => {
    const span = sm.startSpan({
      name: 'with-attrs',
      attributes: { 'http.method': 'GET', 'http.status': 200 },
    });

    expect(span.attributes['http.method']).toBe('GET');
    expect(span.attributes['http.status']).toBe(200);
  });

  it('should track active spans', () => {
    const s1 = sm.startSpan({ name: 'a' });
    const s2 = sm.startSpan({ name: 'b' });

    expect(sm.getActiveSpans()).toHaveLength(2);
    expect(sm.getSpan(s1.spanId)).toBe(s1);
    expect(sm.getSpan(s2.spanId)).toBe(s2);
  });

  it('should finish a span', () => {
    const span = sm.startSpan({ name: 'to-finish' });
    const finished = sm.finishSpan(span.spanId, 'ok');

    expect(finished).toBeDefined();
    expect(finished!.status).toBe('ok');
    expect(finished!.endTime).toBeGreaterThan(0);
    expect(sm.getActiveSpans()).toHaveLength(0);
    expect(sm.getSpan(span.spanId)).toBeUndefined();
  });

  it('should finish a span with error status', () => {
    const span = sm.startSpan({ name: 'error-span' });
    const finished = sm.finishSpan(span.spanId, 'error');

    expect(finished!.status).toBe('error');
  });

  it('should return undefined when finishing non-existent span', () => {
    expect(sm.finishSpan('nonexistent')).toBeUndefined();
  });

  it('should default finish status to ok', () => {
    const span = sm.startSpan({ name: 'default-ok' });
    const finished = sm.finishSpan(span.spanId);

    expect(finished!.status).toBe('ok');
  });
});
