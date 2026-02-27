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
import Elysia from 'elysia';

export interface LogtideElysiaOptions extends ClientOptions {}

/**
 * Elysia plugin for LogTide — request tracing, error capture, breadcrumbs.
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia';
 * import { logtide } from '@logtide/elysia';
 *
 * const app = new Elysia()
 *   .use(logtide({ dsn: '...', service: 'my-api' }))
 *   .get('/', () => 'Hello');
 * ```
 */
export function logtide(options: LogtideElysiaOptions) {
  hub.init({
    service: 'elysia',
    ...options,
    integrations: [
      new ConsoleIntegration(),
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });

  const spanMap = new WeakMap<Request, { spanId: string; scope: Scope; traceId: string; startTime: number }>();

  return new Elysia({ name: '@logtide/elysia' })
    .onRequest(({ request }) => {
      const client = hub.getClient();
      if (!client) return;

      // Extract trace context
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

      const scope = client.createScope(traceId);
      const url = new URL(request.url);
      const method = request.method;
      const pathname = url.pathname;

      // Collect start-time attributes
      const userAgent = request.headers.get('user-agent');
      const forwardedFor = request.headers.get('x-forwarded-for');
      const queryString = url.search;

      const startAttributes: Record<string, string | number | boolean | undefined> = {
        'http.method': method,
        'http.url': request.url,
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
          url: request.url,
          ...(userAgent ? { userAgent } : {}),
        },
      });

      spanMap.set(request, { spanId: span.spanId, scope, traceId, startTime });
    })
    .onAfterHandle(({ request, set }) => {
      const client = hub.getClient();
      const ctx = spanMap.get(request);
      if (!client || !ctx) return;

      const status = typeof set.status === 'number' ? set.status : 200;
      const { scope, spanId, traceId, startTime } = ctx;
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;
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

      const extraAttributes: Record<string, string | number | boolean | undefined> = {
        'http.status_code': status,
        'duration_ms': durationMs,
      };

      client.finishSpan(spanId, status >= 500 ? 'error' : 'ok', {
        extraAttributes,
        events,
      });

      // Inject traceparent
      if (typeof set.headers === 'object' && set.headers !== null) {
        (set.headers as Record<string, string>)['traceparent'] =
          createTraceparent(traceId, spanId, true);
      }
    })
    .onError(({ request, error, set }) => {
      const client = hub.getClient();
      const ctx = spanMap.get(request);
      if (!client) return;

      if (ctx) {
        const { scope, spanId, startTime } = ctx;
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;
        const durationMs = Date.now() - startTime;
        const status = typeof set?.status === 'number' ? set.status : 500;

        // Add response breadcrumb
        scope.addBreadcrumb({
          type: 'http',
          category: 'response',
          message: `${status} ${method} ${pathname}`,
          level: 'error',
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

        client.finishSpan(spanId, 'error', {
          extraAttributes: {
            'http.status_code': status,
            'duration_ms': durationMs,
          },
          events,
        });

        client.captureError(error, {
          'http.url': request.url,
          'http.method': request.method,
        }, scope);
      } else {
        client.captureError(error, {
          'http.url': request.url,
          'http.method': request.method,
        });
      }
    })
    .as('global');
}
