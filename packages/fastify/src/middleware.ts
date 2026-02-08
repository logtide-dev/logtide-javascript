import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
import fp from 'fastify-plugin';

export interface LogtideFastifyOptions extends ClientOptions {}

declare module 'fastify' {
  interface FastifyRequest {
    logtideScope?: Scope;
    logtideTraceId?: string;
  }
}

/**
 * Fastify plugin for LogTide — auto request tracing, error capture, breadcrumbs.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { logtide } from '@logtide/fastify';
 *
 * const app = Fastify();
 * await app.register(logtide, { dsn: '...', service: 'my-api' });
 * ```
 */
export const logtide = fp(
  (fastify: FastifyInstance, options: LogtideFastifyOptions, done: (err?: Error) => void) => {
    hub.init({
      service: 'fastify',
      ...options,
      integrations: [
        new ConsoleIntegration(),
        new GlobalErrorIntegration(),
        ...(options.integrations ?? []),
      ],
    });

    // Store span IDs per request for cross-hook access
    const requestSpans = new WeakMap<FastifyRequest, { spanId: string; traceId: string; method: string; pathname: string }>();

    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const client = hub.getClient();
      if (!client) return;

      // Extract trace context from incoming request
      const traceparent = request.headers.traceparent as string | undefined;
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
      const method = request.method;
      const pathname = request.url.split('?')[0];

      const span = client.startSpan({
        name: `${method} ${pathname}`,
        traceId,
        parentSpanId,
        attributes: {
          'http.method': method,
          'http.url': request.url,
          'http.target': pathname,
        },
      });

      scope.spanId = span.spanId;

      scope.addBreadcrumb({
        type: 'http',
        category: 'request',
        message: `${method} ${pathname}`,
        timestamp: Date.now(),
      });

      // Make scope available on the request
      request.logtideScope = scope;
      request.logtideTraceId = traceId;

      // Inject traceparent into response eagerly (headers must be set before response is sent)
      reply.header('traceparent', createTraceparent(traceId, span.spanId, true));

      // Store span info for onResponse/onError hooks
      requestSpans.set(request, { spanId: span.spanId, traceId, method, pathname });
    });

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const client = hub.getClient();
      const spanInfo = requestSpans.get(request);
      if (!client || !spanInfo) return;

      const status = reply.statusCode;
      client.finishSpan(spanInfo.spanId, status >= 500 ? 'error' : 'ok');

      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${spanInfo.method} ${spanInfo.pathname}`, {
          'http.method': spanInfo.method,
          'http.url': request.url,
          'http.target': spanInfo.pathname,
          'http.status_code': String(status),
        }, request.logtideScope);
      }
    });

    // onError runs before onResponse in Fastify's lifecycle, so only capture
    // the error here — span finishing is handled by onResponse to avoid double-finish.
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const client = hub.getClient();
      const spanInfo = requestSpans.get(request);
      if (!client || !spanInfo) return;

      client.captureError(error, {
        'http.method': spanInfo.method,
        'http.url': request.url,
        'http.target': spanInfo.pathname,
      }, request.logtideScope);
    });

    done();
  },
  {
    fastify: '>=4.0.0',
    name: '@logtide/fastify',
  },
);
