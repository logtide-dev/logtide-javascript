import type { Request, Response, NextFunction } from 'express';
import type { LogTideClient } from '../index.js';

export interface ExpressMiddlewareOptions {
  client: LogTideClient;
  serviceName: string;
  logRequests?: boolean;
  logResponses?: boolean;
  logErrors?: boolean;
  includeHeaders?: boolean;
  includeBody?: boolean;
  skipPaths?: string[];
  skipHealthCheck?: boolean;
}

export function logTideMiddleware(options: ExpressMiddlewareOptions) {
  const {
    client,
    serviceName,
    logRequests = true,
    logResponses = true,
    logErrors = true,
    includeHeaders = false,
    includeBody = false,
    skipPaths = [],
    skipHealthCheck = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip paths
    if (skipHealthCheck && (req.path === '/health' || req.path === '/healthz')) {
      return next();
    }

    if (skipPaths.includes(req.path)) {
      return next();
    }

    const startTime = Date.now();
    const traceId = (req.headers['x-trace-id'] as string) || client.getTraceId();

    // Set trace ID in client context
    if (traceId) {
      client.setTraceId(traceId);
    }

    // Log incoming request
    if (logRequests) {
      const metadata: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
      };

      if (includeHeaders) {
        metadata.headers = req.headers;
      }

      if (includeBody && req.body) {
        metadata.body = req.body;
      }

      client.info(serviceName, `${req.method} ${req.path}`, metadata);
    }

    // Capture original end function
    const originalEnd = res.end;

    // Override res.end to log response
    res.end = function (this: Response, chunk?: any, encoding?: any, callback?: any): Response {
      const duration = Date.now() - startTime;

      if (logResponses) {
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        const metadata: Record<string, unknown> = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration_ms: duration,
        };

        if (includeHeaders) {
          metadata.responseHeaders = res.getHeaders();
        }

        client.log({
          service: serviceName,
          level,
          message: `${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
          metadata,
        });
      }

      // Call original end
      if (typeof encoding === 'function') {
        return originalEnd.call(this, chunk, encoding) as Response;
      }
      return originalEnd.call(this, chunk, encoding, callback) as Response;
    };

    // Error handling
    const errorHandler = (error: Error) => {
      if (logErrors) {
        client.error(serviceName, `Request error: ${error.message}`, error);
      }
    };

    res.on('error', errorHandler);

    next();
  };
}

export default logTideMiddleware;
