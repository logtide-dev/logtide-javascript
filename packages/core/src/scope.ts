import type { Breadcrumb, Span } from '@logtide/types';
import { BreadcrumbBuffer } from './breadcrumb-buffer';

/** Request-scoped context carrying trace_id, breadcrumbs, tags, and spans. */
export class Scope {
  traceId: string;
  spanId?: string;
  tags: Record<string, string> = {};
  extras: Record<string, unknown> = {};
  private breadcrumbs: BreadcrumbBuffer;
  private spans: Span[] = [];

  constructor(traceId: string, maxBreadcrumbs = 100) {
    this.traceId = traceId;
    this.breadcrumbs = new BreadcrumbBuffer(maxBreadcrumbs);
  }

  setTag(key: string, value: string): this {
    this.tags[key] = value;
    return this;
  }

  setExtra(key: string, value: unknown): this {
    this.extras[key] = value;
    return this;
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.add(breadcrumb);
  }

  getBreadcrumbs(): Breadcrumb[] {
    return this.breadcrumbs.getAll();
  }

  addSpan(span: Span): void {
    this.spans.push(span);
  }

  getSpans(): Span[] {
    return [...this.spans];
  }

  clear(): void {
    this.breadcrumbs.clear();
    this.spans = [];
    this.tags = {};
    this.extras = {};
  }

  clone(): Scope {
    const scope = new Scope(this.traceId);
    scope.spanId = this.spanId;
    scope.tags = { ...this.tags };
    scope.extras = { ...this.extras };
    for (const bc of this.breadcrumbs.getAll()) {
      scope.addBreadcrumb(bc);
    }
    return scope;
  }
}
