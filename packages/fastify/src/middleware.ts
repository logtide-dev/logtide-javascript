import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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
import fp from 'fastify-plugin';

export interface LogtideFastifyOptions extends ClientOptions {
  includeRequestBody?: boolean;
  includeRequestHeaders?: boolean | string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    logtideScope?: Scope;
    logtideTraceId?: string;
  }
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
]);

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
    const requestSpans = new WeakMap<FastifyRequest, {
      spanId: string;
      traceId: string;
      method: string;
      pathname: string;
      startTime: number;
    }>();

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
      const startTime = Date.now();
      const method = request.method;
      const pathname = request.url.split('?')[0];

      // Collect optional start-time attributes
      const userAgent = request.headers['user-agent'];
      const clientIp = request.ip;
      const queryString = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';

      const startAttributes: Record<string, string | number | boolean | undefined> = {
        'http.method': method,
        'http.url': request.url,
        'http.target': pathname,
      };
      if (userAgent) {
        startAttributes['http.user_agent'] = userAgent;
      }
      if (clientIp) {
        startAttributes['net.peer.ip'] = clientIp;
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

      // Request breadcrumb with data field
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

      // Make scope available on the request
      request.logtideScope = scope;
      request.logtideTraceId = traceId;

      // Inject traceparent into response eagerly (headers must be set before response is sent)
      reply.header('traceparent', createTraceparent(traceId, span.spanId, true));

      // Store span info for onResponse/onError hooks
      requestSpans.set(request, { spanId: span.spanId, traceId, method, pathname, startTime });
    });

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const client = hub.getClient();
      const spanInfo = requestSpans.get(request);
      if (!client || !spanInfo) return;

      const status = reply.statusCode;
      const durationMs = Date.now() - spanInfo.startTime;
      const scope = request.logtideScope;

      // Build extra attributes
      const extraAttributes: Record<string, string | number | boolean | undefined> = {
        'http.status_code': status,
        'duration_ms': durationMs,
      };

      // Add route template if available
      const routePath =
        (request as any).routeOptions?.url ??
        (request as any).routerPath;
      if (routePath != null) {
        extraAttributes['http.route'] = routePath as string;
      }

      // Opt-in request body capture
      if (options.includeRequestBody && (request as unknown as { body?: unknown }).body != null) {
        const bodyStr = JSON.stringify((request as unknown as { body?: unknown }).body);
        if (bodyStr && bodyStr !== '{}' && bodyStr !== 'null') {
          extraAttributes['http.request_body'] = bodyStr.slice(0, 4096);
        }
      }

      // Opt-in request headers capture
      if (options.includeRequestHeaders) {
        let headersToCapture: Record<string, string>;

        if (Array.isArray(options.includeRequestHeaders)) {
          const specifiedHeaders = options.includeRequestHeaders;
          headersToCapture = {};
          for (const headerName of specifiedHeaders) {
            const val = request.headers[headerName.toLowerCase()];
            if (val !== undefined) {
              headersToCapture[headerName.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
            }
          }
        } else {
          headersToCapture = {};
          for (const [key, val] of Object.entries(request.headers)) {
            if (!SENSITIVE_HEADERS.has(key.toLowerCase()) && val !== undefined) {
              headersToCapture[key] = Array.isArray(val) ? val.join(', ') : val;
            }
          }
        }

        const headersStr = JSON.stringify(headersToCapture);
        if (headersStr && headersStr !== '{}') {
          extraAttributes['http.request_headers'] = headersStr.slice(0, 4096);
        }
      }

      // Add response breadcrumb to scope BEFORE calling finishSpan so it's included in events
      if (scope) {
        scope.addBreadcrumb({
          type: 'http',
          category: 'response',
          message: `${status} ${spanInfo.method} ${spanInfo.pathname}`,
          level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          timestamp: Date.now(),
          data: { status, duration_ms: durationMs },
        });
      }

      // Convert breadcrumbs to SpanEvents
      const events: SpanEvent[] = (scope?.getBreadcrumbs() ?? []).map((bc) => ({
        name: bc.message,
        timestamp: bc.timestamp,
        attributes: bc.data
          ? Object.fromEntries(
              Object.entries(bc.data).map(([k, v]) => [
                k,
                typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : String(v),
              ]),
            )
          : undefined,
      }));

      client.finishSpan(spanInfo.spanId, status >= 500 ? 'error' : 'ok', {
        extraAttributes,
        events,
      });

      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${spanInfo.method} ${spanInfo.pathname}`, {
          'http.method': spanInfo.method,
          'http.url': request.url,
          'http.target': spanInfo.pathname,
          'http.status_code': status,
          duration_ms: durationMs,
        }, scope);
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
