import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSessionId, resetSessionId } from '../src/session';

describe('session', () => {
  beforeEach(() => {
    resetSessionId();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a valid UUID', () => {
    const id = getSessionId();
    // UUID v4 format
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('returns the same ID on subsequent calls', () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it('returns a new ID after reset', () => {
    const id1 = getSessionId();
    resetSessionId();
    const id2 = getSessionId();
    expect(id1).not.toBe(id2);
  });
});
