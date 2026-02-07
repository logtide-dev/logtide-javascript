/**
 * W3C Trace Context (traceparent) parsing and injection.
 * Format: {version}-{traceId}-{parentSpanId}-{traceFlags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */

export interface TraceContext {
  version: string;
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
}

const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function parseTraceparent(header: string): TraceContext | null {
  const match = header.trim().match(TRACEPARENT_REGEX);
  if (!match) return null;

  return {
    version: match[1],
    traceId: match[2],
    parentSpanId: match[3],
    sampled: (parseInt(match[4], 16) & 0x01) === 1,
  };
}

export function createTraceparent(traceId: string, spanId: string, sampled: boolean): string {
  const flags = sampled ? '01' : '00';
  return `00-${traceId}-${spanId}-${flags}`;
}
