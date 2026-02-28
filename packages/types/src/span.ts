export type SpanStatus = 'ok' | 'error' | 'unset';

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  status: SpanStatus;
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  events?: SpanEvent[];
}
