import type { FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import type { LogTideClient } from '../index.js';
import fp from 'fastify-plugin';

export interface FastifyMiddlewareOptions {
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

const logTidePlugin: FastifyPluginCallback<FastifyMiddlewareOptions> = (
  fastify,
  options,
  done,
) => {
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

  // Request hook - log incoming requests
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Skip paths
    if (skipHealthCheck && (request.url === '/health' || request.url === '/healthz')) {
      return;
    }

    if (skipPaths.includes(request.url)) {
      return;
    }

    // Extract trace ID from headers or use current context
    const traceId = (request.headers['x-trace-id'] as string) || client.getTraceId();

    if (traceId) {
      client.setTraceId(traceId);
    }

    // Store start time for duration calculation
    (request as any).startTime = Date.now();

    if (logRequests) {
      const metadata: Record<string, unknown> = {
        method: request.method,
        path: request.url,
        query: request.query,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

      if (includeHeaders) {
        metadata.headers = request.headers;
      }

      if (includeBody && request.body) {
        metadata.body = request.body;
      }

      client.info(serviceName, `${request.method} ${request.url}`, metadata);
    }
  });

  // Response hook - log responses
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (skipHealthCheck && (request.url === '/health' || request.url === '/healthz')) {
      return;
    }

    if (skipPaths.includes(request.url)) {
      return;
    }

    if (logResponses) {
      const startTime = (request as any).startTime || Date.now();
      const duration = Date.now() - startTime;

      const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';

      const metadata: Record<string, unknown> = {
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        duration_ms: duration,
      };

      if (includeHeaders) {
        metadata.responseHeaders = reply.getHeaders();
      }

      client.log({
        service: serviceName,
        level,
        message: `${request.method} ${request.url} ${reply.statusCode} (${duration}ms)`,
        metadata,
      });
    }
  });

  // Error hook - log errors
  fastify.addHook('onError', async (_request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    if (logErrors) {
      client.error(serviceName, `Request error: ${error.message}`, error);
    }
  });

  done();
};

export const logTideFastifyPlugin = fp(logTidePlugin, {
  fastify: '>=4.0.0',
  name: '@logtide/fastify-plugin',
});

export default logTideFastifyPlugin;
