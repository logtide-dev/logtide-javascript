import type { ClientOptions } from '@logtide/types';
import type { Scope, SpanEvent } from '@logtide/core';
import {
  hub,
  ConsoleIntegration,
  GlobalErrorIntegration,
  generateTraceId,
  parseTraceparent,
  createTraceparent,
} from '@logtide/core';
import { createMiddleware } from 'hono/factory';

export interface LogtideHonoOptions extends ClientOptions {}

/**
 * Hono middleware for LogTide — auto request tracing, error capture, breadcrumbs.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { logtide } from '@logtide/hono';
 *
 * const app = new Hono();
 * app.use('*', logtide({ dsn: '...', service: 'my-api' }));
 * ```
 */
export function logtide(options: LogtideHonoOptions) {
  hub.init({
    service: 'hono',
    ...options,
    integrations: [
      new ConsoleIntegration(),
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });

  return createMiddleware(async (c, next) => {
    const client = hub.getClient();
    if (!client) {
      await next();
      return;
    }

    // Extract trace context from incoming request
    const traceparent = c.req.header('traceparent');
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

    const scope = client.createScope(traceId);
    const url = new URL(c.req.url);
    const method = c.req.method;
    const pathname = url.pathname;

    // Collect start-time attributes
    const userAgent = c.req.header('user-agent');
    const forwardedFor = c.req.header('x-forwarded-for');
    const queryString = url.search;

    const startAttributes: Record<string, string | number | boolean | undefined> = {
      'http.method': method,
      'http.url': c.req.url,
      'http.target': pathname,
    };
    if (userAgent) {
      startAttributes['http.user_agent'] = userAgent;
    }
    if (forwardedFor) {
      startAttributes['net.peer.ip'] = forwardedFor;
    }
    if (queryString) {
      startAttributes['http.query_string'] = queryString;
    }

    const span = client.startSpan({
      name: `${method} ${pathname}`,
      traceId,
      parentSpanId,
      attributes: startAttributes,
    });

    scope.spanId = span.spanId;

    // Capture startTime BEFORE adding the breadcrumb
    const startTime = Date.now();

    scope.addBreadcrumb({
      type: 'http',
      category: 'request',
      message: `${method} ${pathname}`,
      timestamp: Date.now(),
      data: {
        method,
        url: c.req.url,
        ...(userAgent ? { userAgent } : {}),
      },
    });

    // Make scope available via c.set()
    c.set('logtideScope', scope);
    c.set('logtideTraceId', traceId);

    try {
      await next();

      const status = c.res.status;
      const durationMs = Date.now() - startTime;

      // Add response breadcrumb BEFORE calling finishSpan so it's included in events
      scope.addBreadcrumb({
        type: 'http',
        category: 'response',
        message: `${status} ${method} ${pathname}`,
        level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        timestamp: Date.now(),
        data: { status, duration_ms: durationMs },
      });

      // Convert breadcrumbs to SpanEvents
      const events: SpanEvent[] = scope.getBreadcrumbs().map((b) => ({
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

      // Build extra attributes
      const route = typeof (c.req as any).routePath === 'string' && (c.req as any).routePath !== ''
        ? (c.req as any).routePath as string
        : undefined;

      const extraAttributes: Record<string, string | number | boolean | undefined> = {
        'http.status_code': status,
        'duration_ms': durationMs,
        ...(route ? { 'http.route': route } : {}),
      };

      client.finishSpan(span.spanId, status >= 500 ? 'error' : 'ok', {
        extraAttributes,
        events,
      });

      // Hono catches handler errors internally and converts them to 500 responses,
      // so we also capture an error log when we detect a 5xx status.
      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${method} ${pathname}`, {
          'http.method': method,
          'http.url': c.req.url,
          'http.target': pathname,
          'http.status_code': String(status),
          duration_ms: durationMs,
        }, scope);
      }

      // Inject traceparent into response
      c.res.headers.set('traceparent', createTraceparent(traceId, span.spanId, true));
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Add response breadcrumb for error case
      scope.addBreadcrumb({
        type: 'http',
        category: 'response',
        message: `500 ${method} ${pathname}`,
        level: 'error',
        timestamp: Date.now(),
        data: { status: 500, duration_ms: durationMs },
      });

      // Convert breadcrumbs to SpanEvents
      const events: SpanEvent[] = scope.getBreadcrumbs().map((b) => ({
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

      client.finishSpan(span.spanId, 'error', {
        extraAttributes: {
          'http.status_code': 500,
          'duration_ms': durationMs,
        },
        events,
      });

      client.captureError(error, {
        'http.method': method,
        'http.url': c.req.url,
        'http.target': pathname,
      }, scope);
      throw error;
    }
  });
}
