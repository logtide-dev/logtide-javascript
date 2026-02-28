import { hub, Scope, parseTraceparent, generateTraceId, createTraceparent } from '@logtide/core';
import type { SpanEvent } from '@logtide/core';

function breadcrumbsToEvents(scope: Scope): SpanEvent[] {
  return scope.getBreadcrumbs().map((b) => ({
    name: b.message,
    timestamp: b.timestamp,
    attributes: {
      'breadcrumb.type': b.type,
      ...(b.category ? { 'breadcrumb.category': b.category } : {}),
      ...(b.level ? { 'breadcrumb.level': b.level } : {}),
      ...Object.fromEntries(
        Object.entries(b.data ?? {}).map(([k, v]) => [`data.${k}`, String(v)])
      ),
    },
  }));
}

/**
 * Wraps a Next.js request to auto-create a span and propagate trace context.
 * Used internally by registerLogtide() to instrument server-side requests.
 */
export function instrumentRequest(
  request: { headers: Headers; method: string; url: string },
): { traceId: string; spanId: string; scope: Scope; startTime: number } | null {
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

  // Capture extra request metadata
  const userAgent = request.headers.get('user-agent');
  const forwardedFor = request.headers.get('x-forwarded-for');

  // Start a server span
  const url = new URL(request.url, 'http://localhost');
  const queryString = url.search;

  const startTime = Date.now();

  const span = client.startSpan({
    name: `${request.method} ${url.pathname}`,
    traceId,
    parentSpanId,
    attributes: {
      'http.method': request.method,
      'http.url': request.url,
      'http.target': url.pathname,
      ...(userAgent ? { 'http.user_agent': userAgent } : {}),
      ...(forwardedFor ? { 'net.peer.ip': forwardedFor } : {}),
      ...(queryString ? { 'http.query_string': queryString } : {}),
    },
  });

  scope.spanId = span.spanId;

  scope.addBreadcrumb({
    type: 'http',
    category: 'request',
    message: `${request.method} ${url.pathname}`,
    timestamp: Date.now(),
    data: { method: request.method, url: request.url, ...(userAgent ? { userAgent } : {}) },
  });

  return { traceId, spanId: span.spanId, scope, startTime };
}

/**
 * Finish the request span and record response metadata.
 */
export function finishRequest(
  spanId: string,
  statusCode: number,
  scope: Scope,
  startTime: number,
  route?: string,
): void {
  const client = hub.getClient();
  if (!client) return;

  const durationMs = Date.now() - startTime;

  scope.addBreadcrumb({
    type: 'http',
    category: 'response',
    message: `${statusCode} request`,
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    timestamp: Date.now(),
    data: { status: statusCode, duration_ms: durationMs },
  });

  const extraAttributes: Record<string, string | number | boolean | undefined> = {
    'http.status_code': statusCode,
    'duration_ms': durationMs,
    ...(route ? { 'http.route': route } : {}),
  };

  const events: SpanEvent[] = breadcrumbsToEvents(scope);

  client.finishSpan(spanId, statusCode >= 500 ? 'error' : 'ok', { extraAttributes, events });
}
