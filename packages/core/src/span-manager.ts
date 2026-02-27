import type { Span, SpanAttributes, SpanEvent, SpanStatus } from '@logtide/types';
import { generateSpanId, generateTraceId } from './utils/trace-id';

export interface StartSpanOptions {
  name: string;
  traceId?: string;
  parentSpanId?: string;
  attributes?: SpanAttributes;
}

export class SpanManager {
  private activeSpans = new Map<string, Span>();

  startSpan(options: StartSpanOptions): Span {
    const span: Span = {
      traceId: options.traceId ?? generateTraceId(),
      spanId: generateSpanId(),
      parentSpanId: options.parentSpanId,
      name: options.name,
      status: 'unset',
      startTime: Date.now(),
      attributes: options.attributes ?? {},
    };

    this.activeSpans.set(span.spanId, span);
    return span;
  }

  finishSpan(
    spanId: string,
    status: SpanStatus = 'ok',
    options?: { extraAttributes?: SpanAttributes; events?: SpanEvent[] },
  ): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) return undefined;

    span.endTime = Date.now();
    span.status = status;

    if (options) {
      if (options.extraAttributes) {
        Object.assign(span.attributes, options.extraAttributes);
      }
      if (options.events && options.events.length > 0) {
        span.events = options.events;
      }
    }

    this.activeSpans.delete(spanId);
    return span;
  }

  getSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }
}
