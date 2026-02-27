import type { Request, Response, NextFunction } from 'express';
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

export interface LogtideExpressOptions extends ClientOptions {
  includeRequestBody?: boolean;
  includeRequestHeaders?: boolean | string[];
}

declare global {
  namespace Express {
    interface Request {
      logtideScope?: Scope;
      logtideTraceId?: string;
    }
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
 * Express middleware for LogTide — auto request tracing, error capture, breadcrumbs.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { logtide } from '@logtide/express';
 *
 * const app = express();
 * app.use(logtide({ dsn: '...', service: 'my-api' }));
 * ```
 */
export function logtide(options: LogtideExpressOptions) {
  hub.init({
    service: 'express',
    ...options,
    integrations: [
      new ConsoleIntegration(),
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const client = hub.getClient();
    if (!client) {
      next();
      return;
    }

    // Extract trace context from incoming request
    const traceparent = req.headers.traceparent as string | undefined;
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
    const method = req.method;
    const pathname = req.path || req.url;

    // Collect optional start-time attributes
    const userAgent = req.headers['user-agent'];
    const clientIp = req.ip;
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

    const startAttributes: Record<string, string | number | boolean | undefined> = {
      'http.method': method,
      'http.url': req.originalUrl || req.url,
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
    const fullUrl = req.originalUrl || req.url;
    scope.addBreadcrumb({
      type: 'http',
      category: 'request',
      message: `${method} ${pathname}`,
      timestamp: Date.now(),
      data: {
        method,
        url: fullUrl,
        ...(userAgent ? { userAgent } : {}),
      },
    });

    // Make scope available on the request object
    req.logtideScope = scope;
    req.logtideTraceId = traceId;

    // Inject traceparent into response eagerly (headers must be set before response is sent)
    res.setHeader('traceparent', createTraceparent(traceId, span.spanId, true));

    // Finish span when response completes
    res.on('finish', () => {
      const status = res.statusCode;
      const durationMs = Date.now() - startTime;

      // Build extra attributes
      const extraAttributes: Record<string, string | number | boolean | undefined> = {
        'http.status_code': status,
        'duration_ms': durationMs,
      };

      // Add route template if available
      const routePath = req.route?.path as string | undefined;
      if (routePath != null) {
        extraAttributes['http.route'] = routePath;
      }

      // Opt-in request body capture
      if (options.includeRequestBody && req.body != null) {
        const bodyStr = JSON.stringify(req.body);
        if (bodyStr && bodyStr !== '{}' && bodyStr !== 'null') {
          extraAttributes['http.request_body'] = bodyStr.slice(0, 4096);
        }
      }

      // Opt-in request headers capture
      if (options.includeRequestHeaders) {
        let headersToCapture: Record<string, string>;

        if (Array.isArray(options.includeRequestHeaders)) {
          // Capture only specified headers — no sanitization needed
          const specifiedHeaders = options.includeRequestHeaders;
          headersToCapture = {};
          for (const headerName of specifiedHeaders) {
            const val = req.headers[headerName.toLowerCase()];
            if (val !== undefined) {
              headersToCapture[headerName.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
            }
          }
        } else {
          // Capture all headers except sensitive ones
          headersToCapture = {};
          for (const [key, val] of Object.entries(req.headers)) {
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
      const events: SpanEvent[] = breadcrumbsToEvents(scope);

      client.finishSpan(span.spanId, status >= 500 ? 'error' : 'ok', {
        extraAttributes,
        events,
      });

      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${method} ${pathname}`, {
          'http.method': method,
          'http.url': req.originalUrl || req.url,
          'http.target': pathname,
          'http.status_code': status,
          duration_ms: durationMs,
        }, scope);
      }
    });

    next();
  };
}

/**
 * Express error-handling middleware for LogTide — captures unhandled errors
 * and associates them with the current request's trace scope.
 *
 * Must be registered AFTER your route handlers with four parameters so
 * Express recognises it as an error handler.
 *
 * @example
 * ```ts
 * app.use(logtideErrorHandler());
 * ```
 */
export function logtideErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    const client = hub.getClient();
    if (client && req.logtideScope) {
      client.captureError(err, {
        'http.method': req.method,
        'http.url': req.originalUrl || req.url,
        'http.target': req.path || req.url,
      }, req.logtideScope);
    }
    next(err);
  };
}
