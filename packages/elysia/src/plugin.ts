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

  const spanMap = new WeakMap<Request, { spanId: string; scope: Scope; traceId: string }>();

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

      const span = client.startSpan({
        name: `${method} ${url.pathname}`,
        traceId,
        parentSpanId,
        attributes: {
          'http.method': method,
          'http.url': request.url,
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

      spanMap.set(request, { spanId: span.spanId, scope, traceId });
    })
    .onAfterHandle(({ request, set }) => {
      const client = hub.getClient();
      const ctx = spanMap.get(request);
      if (!client || !ctx) return;

      const status = typeof set.status === 'number' ? set.status : 200;
      client.finishSpan(ctx.spanId, status >= 500 ? 'error' : 'ok');

      // Inject traceparent
      if (typeof set.headers === 'object' && set.headers !== null) {
        (set.headers as Record<string, string>)['traceparent'] =
          createTraceparent(ctx.traceId, ctx.spanId, true);
      }
    })
    .onError(({ request, error }) => {
      const client = hub.getClient();
      const ctx = spanMap.get(request);
      if (!client) return;

      if (ctx) {
        client.finishSpan(ctx.spanId, 'error');
        client.captureError(error, {
          'http.url': request.url,
          'http.method': request.method,
        }, ctx.scope);
      } else {
        client.captureError(error, {
          'http.url': request.url,
          'http.method': request.method,
        });
      }
    })
    .as('global');
}
