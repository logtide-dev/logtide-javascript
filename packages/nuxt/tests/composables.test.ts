import { describe, it, expect, vi, afterEach } from 'vitest';
import { hub } from '@logtide/core';
import { useLogtide } from '../src/runtime/composables';

describe('useLogtide', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes addBreadcrumb / captureLog / captureError', () => {
    const api = useLogtide();
    expect(typeof api.addBreadcrumb).toBe('function');
    expect(typeof api.captureLog).toBe('function');
    expect(typeof api.captureError).toBe('function');
  });

  it('forwards captureLog to the hub', () => {
    const spy = vi.spyOn(hub, 'captureLog').mockImplementation(() => {});
    useLogtide().captureLog('info', 'hello', { a: 1 });
    expect(spy).toHaveBeenCalledWith('info', 'hello', { a: 1 });
  });

  it('forwards captureError to the hub', () => {
    const spy = vi.spyOn(hub, 'captureError').mockImplementation(() => {});
    const err = new Error('x');
    useLogtide().captureError(err, { mechanism: 'manual' });
    expect(spy).toHaveBeenCalledWith(err, { mechanism: 'manual' });
  });

  it('forwards addBreadcrumb to the hub', () => {
    const spy = vi.spyOn(hub, 'addBreadcrumb').mockImplementation(() => {});
    const bc = { type: 'custom' as const, message: 'bc', timestamp: 1 };
    useLogtide().addBreadcrumb(bc);
    expect(spy).toHaveBeenCalledWith(bc);
  });
});
