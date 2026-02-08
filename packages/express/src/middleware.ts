import type { Request, Response, NextFunction } from 'express';
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

export interface LogtideExpressOptions extends ClientOptions {}

declare global {
  namespace Express {
    interface Request {
      logtideScope?: Scope;
      logtideTraceId?: string;
    }
  }
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
    const method = req.method;
    const pathname = req.path || req.url;

    const span = client.startSpan({
      name: `${method} ${pathname}`,
      traceId,
      parentSpanId,
      attributes: {
        'http.method': method,
        'http.url': req.originalUrl || req.url,
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

    // Make scope available on the request object
    req.logtideScope = scope;
    req.logtideTraceId = traceId;

    // Inject traceparent into response eagerly (headers must be set before response is sent)
    res.setHeader('traceparent', createTraceparent(traceId, span.spanId, true));

    // Finish span when response completes
    res.on('finish', () => {
      const status = res.statusCode;
      client.finishSpan(span.spanId, status >= 500 ? 'error' : 'ok');

      if (status >= 500) {
        client.captureLog('error', `HTTP ${status} ${method} ${pathname}`, {
          'http.method': method,
          'http.url': req.originalUrl || req.url,
          'http.target': pathname,
          'http.status_code': String(status),
        }, scope);
      }
    });

    next();
  };
}
