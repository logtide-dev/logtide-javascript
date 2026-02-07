import { describe, it, expect } from 'vitest';
import { parseTraceparent, createTraceparent } from '../src/utils/w3c-trace-context';

describe('parseTraceparent', () => {
  it('should parse a valid traceparent header', () => {
    const result = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');

    expect(result).toEqual({
      version: '00',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      parentSpanId: '00f067aa0ba902b7',
      sampled: true,
    });
  });

  it('should detect non-sampled traces', () => {
    const result = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
    expect(result!.sampled).toBe(false);
  });

  it('should return null for invalid header', () => {
    expect(parseTraceparent('invalid')).toBeNull();
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('00-short-00f067aa0ba902b7-01')).toBeNull();
  });

  it('should handle whitespace', () => {
    const result = parseTraceparent('  00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01  ');
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });
});

describe('createTraceparent', () => {
  it('should create a valid traceparent string (sampled)', () => {
    const result = createTraceparent('4bf92f3577b34da6a3ce929d0e0e4736', '00f067aa0ba902b7', true);
    expect(result).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });

  it('should create a valid traceparent string (not sampled)', () => {
    const result = createTraceparent('4bf92f3577b34da6a3ce929d0e0e4736', '00f067aa0ba902b7', false);
    expect(result).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
  });

  it('should round-trip with parseTraceparent', () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const header = createTraceparent(traceId, spanId, true);
    const parsed = parseTraceparent(header);

    expect(parsed!.traceId).toBe(traceId);
    expect(parsed!.parentSpanId).toBe(spanId);
    expect(parsed!.sampled).toBe(true);
  });
});
