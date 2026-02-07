import { describe, it, expect } from 'vitest';
import { generateTraceId, generateSpanId } from '../src/utils/trace-id';

describe('generateTraceId', () => {
  it('should return a 32-character hex string', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateSpanId', () => {
  it('should return a 16-character hex string', () => {
    const id = generateSpanId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
    expect(ids.size).toBe(100);
  });
});
