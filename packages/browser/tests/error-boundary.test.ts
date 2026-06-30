import { describe, it, expect, vi, afterEach } from 'vitest';
import { hub } from '@logtide/core';
import { LogtideErrorBoundary } from '../src/index';

describe('LogtideErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is exported as a React component class', () => {
    expect(LogtideErrorBoundary).toBeDefined();
    expect(typeof LogtideErrorBoundary).toBe('function');
  });

  it('derives error state from a thrown error', () => {
    const err = new Error('boom');
    const state = (LogtideErrorBoundary as any).getDerivedStateFromError(err);
    expect(state).toEqual({ error: err });
  });

  it('reports caught errors to the LogTide hub', () => {
    const captureError = vi.spyOn(hub, 'captureError').mockImplementation(() => {});
    const err = new Error('kaboom');

    const instance = new (LogtideErrorBoundary as any)({ children: null });
    instance.componentDidCatch(err, { componentStack: '\n at Foo' });

    expect(captureError).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ mechanism: 'react.error-boundary' }),
    );
  });
});
