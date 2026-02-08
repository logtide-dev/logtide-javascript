import type { ClientOptions } from '@logtide/types';
import type { Scope } from '@logtide/core';
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

    const span = client.startSpan({
      name: `${method} ${url.pathname}`,
      traceId,
      parentSpanId,
      attributes: {
        'http.method': method,
        'http.url': c.req.url,
        'http.target': url.pathname,
      },
    });

    scope.spanId = span.spanId;

    scope.addBreadcrumb({
      type: 'http',
      category: 'request',
      message: `${method} ${url.pathname}`,
      timestamp: Date.now(),
    });

    // Make scope available via c.set()
    c.set('logtideScope', scope);
    c.set('logtideTraceId', traceId);

    try {
      await next();

      const status = c.res.status;
      client.finishSpan(span.spanId, status >= 500 ? 'error' : 'ok');

      // Hono catches handler errors internally and converts them to 500 responses,
      // so we also capture an error log when we detect a 5xx status.
      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${method} ${url.pathname}`, {
          'http.method': method,
          'http.url': c.req.url,
          'http.target': url.pathname,
          'http.status_code': String(status),
        }, scope);
      }

      // Inject traceparent into response
      c.res.headers.set('traceparent', createTraceparent(traceId, span.spanId, true));
    } catch (error) {
      client.finishSpan(span.spanId, 'error');
      client.captureError(error, {
        'http.method': method,
        'http.url': c.req.url,
        'http.target': url.pathname,
      }, scope);
      throw error;
    }
  });
}
