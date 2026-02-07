import { describe, it, expect } from 'vitest';
import { Scope } from '../src/scope';

describe('Scope', () => {
  it('should store traceId', () => {
    const scope = new Scope('abc123');
    expect(scope.traceId).toBe('abc123');
  });

  it('should set and get tags', () => {
    const scope = new Scope('t1');
    scope.setTag('env', 'production');
    scope.setTag('version', '1.0.0');
    expect(scope.tags).toEqual({ env: 'production', version: '1.0.0' });
  });

  it('should chain setTag calls', () => {
    const scope = new Scope('t2');
    const result = scope.setTag('a', '1').setTag('b', '2');
    expect(result).toBe(scope);
    expect(scope.tags).toEqual({ a: '1', b: '2' });
  });

  it('should set and get extras', () => {
    const scope = new Scope('t3');
    scope.setExtra('user', { id: 1 });
    expect(scope.extras.user).toEqual({ id: 1 });
  });

  it('should manage breadcrumbs', () => {
    const scope = new Scope('t4', 5);
    scope.addBreadcrumb({ type: 'http', message: 'GET /api', timestamp: 1 });
    scope.addBreadcrumb({ type: 'console', message: 'log msg', timestamp: 2 });

    const bcs = scope.getBreadcrumbs();
    expect(bcs).toHaveLength(2);
    expect(bcs[0].message).toBe('GET /api');
  });

  it('should manage spans', () => {
    const scope = new Scope('t5');
    const span = {
      traceId: 't5',
      spanId: 's1',
      name: 'GET /',
      status: 'ok' as const,
      startTime: Date.now(),
      attributes: {},
    };
    scope.addSpan(span);
    expect(scope.getSpans()).toHaveLength(1);
    expect(scope.getSpans()[0].spanId).toBe('s1');
  });

  it('should clear all data', () => {
    const scope = new Scope('t6');
    scope.setTag('k', 'v');
    scope.setExtra('e', 1);
    scope.addBreadcrumb({ type: 'custom', message: 'bc', timestamp: 1 });
    scope.clear();

    expect(scope.tags).toEqual({});
    expect(scope.extras).toEqual({});
    expect(scope.getBreadcrumbs()).toHaveLength(0);
    expect(scope.getSpans()).toHaveLength(0);
  });

  it('should clone correctly', () => {
    const scope = new Scope('t7');
    scope.spanId = 'span1';
    scope.setTag('env', 'dev');
    scope.setExtra('count', 42);
    scope.addBreadcrumb({ type: 'custom', message: 'crumb', timestamp: 1 });

    const cloned = scope.clone();
    expect(cloned.traceId).toBe('t7');
    expect(cloned.spanId).toBe('span1');
    expect(cloned.tags).toEqual({ env: 'dev' });
    expect(cloned.extras).toEqual({ count: 42 });
    expect(cloned.getBreadcrumbs()).toHaveLength(1);

    // Mutations on clone should not affect original
    cloned.setTag('env', 'prod');
    expect(scope.tags.env).toBe('dev');
  });
});
