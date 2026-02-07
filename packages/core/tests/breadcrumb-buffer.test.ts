import { describe, it, expect } from 'vitest';
import { BreadcrumbBuffer } from '../src/breadcrumb-buffer';
import type { Breadcrumb } from '@logtide/types';

function makeBreadcrumb(msg: string): Breadcrumb {
  return { type: 'custom', message: msg, timestamp: Date.now() };
}

describe('BreadcrumbBuffer', () => {
  it('should add and retrieve breadcrumbs', () => {
    const buf = new BreadcrumbBuffer();
    buf.add(makeBreadcrumb('one'));
    buf.add(makeBreadcrumb('two'));

    const all = buf.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].message).toBe('one');
    expect(all[1].message).toBe('two');
  });

  it('should respect max size and evict oldest', () => {
    const buf = new BreadcrumbBuffer(3);
    buf.add(makeBreadcrumb('a'));
    buf.add(makeBreadcrumb('b'));
    buf.add(makeBreadcrumb('c'));
    buf.add(makeBreadcrumb('d'));

    const all = buf.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].message).toBe('b');
    expect(all[1].message).toBe('c');
    expect(all[2].message).toBe('d');
  });

  it('should clear all breadcrumbs', () => {
    const buf = new BreadcrumbBuffer();
    buf.add(makeBreadcrumb('x'));
    buf.add(makeBreadcrumb('y'));
    buf.clear();
    expect(buf.getAll()).toHaveLength(0);
    expect(buf.length).toBe(0);
  });

  it('should return a copy from getAll', () => {
    const buf = new BreadcrumbBuffer();
    buf.add(makeBreadcrumb('orig'));
    const arr = buf.getAll();
    arr.push(makeBreadcrumb('extra'));
    expect(buf.getAll()).toHaveLength(1);
  });

  it('should report correct length', () => {
    const buf = new BreadcrumbBuffer(5);
    expect(buf.length).toBe(0);
    buf.add(makeBreadcrumb('a'));
    expect(buf.length).toBe(1);
    buf.add(makeBreadcrumb('b'));
    buf.add(makeBreadcrumb('c'));
    expect(buf.length).toBe(3);
  });

  it('should default to maxSize 100', () => {
    const buf = new BreadcrumbBuffer();
    for (let i = 0; i < 110; i++) {
      buf.add(makeBreadcrumb(`item-${i}`));
    }
    expect(buf.getAll()).toHaveLength(100);
    expect(buf.getAll()[0].message).toBe('item-10');
  });
});
