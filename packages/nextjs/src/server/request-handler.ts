import { hub, Scope, parseTraceparent, generateTraceId, createTraceparent } from '@logtide/core';

/**
 * Wraps a Next.js request to auto-create a span and propagate trace context.
 * Used internally by registerLogtide() to instrument server-side requests.
 */
export function instrumentRequest(
  request: { headers: Headers; method: string; url: string },
): { traceId: string; spanId: string; scope: Scope } | null {
  const client = hub.getClient();
  if (!client) return null;

  // Extract incoming trace context
  const traceparent = request.headers.get('traceparent');
  let traceId: string;
  let parentSpanId: string | undefined;

  if (traceparent) {
    const ctx = parseTraceparent(traceparent);
    if (ctx) {
      traceId = ctx.traceId;
      parentSpanId = ctx.parentSpanId;
    } else {
      traceId = generateTraceId();
    }
  } else {
    traceId = generateTraceId();
  }

  // Create a scope for this request
  const scope = client.createScope(traceId);

  // Start a server span
  const url = new URL(request.url, 'http://localhost');
  const span = client.startSpan({
    name: `${request.method} ${url.pathname}`,
    traceId,
    parentSpanId,
    attributes: {
      'http.method': request.method,
      'http.url': request.url,
      'http.target': url.pathname,
    },
  });

  scope.spanId = span.spanId;

  scope.addBreadcrumb({
    type: 'http',
    category: 'request',
    message: `${request.method} ${url.pathname}`,
    timestamp: Date.now(),
    data: { method: request.method, url: request.url },
  });

  return { traceId, spanId: span.spanId, scope };
}

/**
 * Finish the request span and record response metadata.
 */
export function finishRequest(
  spanId: string,
  statusCode: number,
): void {
  const client = hub.getClient();
  if (!client) return;

  client.finishSpan(spanId, statusCode >= 500 ? 'error' : 'ok');
}
