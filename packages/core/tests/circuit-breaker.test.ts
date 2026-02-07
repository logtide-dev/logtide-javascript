import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from '../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker(3, 1000);
  });

  it('should start in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);
  });

  it('should stay CLOSED when failures are below threshold', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);
  });

  it('should transition to OPEN when threshold reached', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');
    expect(cb.canAttempt()).toBe(false);
  });

  it('should transition to HALF_OPEN after resetMs', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canAttempt()).toBe(false);

    // Advance time
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);

    expect(cb.canAttempt()).toBe(true);
    expect(cb.getState()).toBe('HALF_OPEN');

    vi.useRealTimers();
  });

  it('should go back to CLOSED on success', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);
    cb.canAttempt(); // triggers HALF_OPEN
    cb.recordSuccess();

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt()).toBe(true);

    vi.useRealTimers();
  });

  it('should reset failure count on success', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    // Now 2 more failures should NOT open the circuit (counter was reset)
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('CLOSED');
  });
});
