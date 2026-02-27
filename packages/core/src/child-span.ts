import type { Span, SpanAttributes, SpanEvent } from '@logtide/types';
import { hub } from './hub';
import type { Scope } from './scope';

/**
 * Start a child span under the given scope.
 * If no client is registered, returns a no-op span.
 */
export function startChildSpan(name: string, scope: Scope, attributes?: SpanAttributes): Span {
  const client = hub.getClient();
  if (!client) {
    return {
      traceId: scope.traceId,
      spanId: '0000000000000000',
      name,
      status: 'unset',
      startTime: Date.now(),
      attributes: attributes ?? {},
    };
  }
  return client.startSpan({ name, traceId: scope.traceId, parentSpanId: scope.spanId, attributes });
}

/**
 * Finish a child span by ID via the hub client.
 */
export function finishChildSpan(
  spanId: string,
  status: 'ok' | 'error' = 'ok',
  options?: { extraAttributes?: SpanAttributes; events?: SpanEvent[] },
): void {
  hub.getClient()?.finishSpan(spanId, status, options);
}
