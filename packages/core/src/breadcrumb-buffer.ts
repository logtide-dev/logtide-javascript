import type { Breadcrumb } from '@logtide/types';

/** Circular buffer for breadcrumbs. */
export class BreadcrumbBuffer {
  private buffer: Breadcrumb[] = [];
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  add(breadcrumb: Breadcrumb): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(breadcrumb);
  }

  getAll(): Breadcrumb[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}
