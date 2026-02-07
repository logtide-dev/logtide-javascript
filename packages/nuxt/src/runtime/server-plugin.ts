import {
  hub,
  ConsoleIntegration,
  GlobalErrorIntegration,
  generateTraceId,
  parseTraceparent,
} from '@logtide/core';
import { defineNitroPlugin, getRequestURL, getRequestHeaders } from 'h3';

/**
 * Nitro server plugin — hooks into request, afterResponse, and error lifecycle.
 */
export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig().logtide as {
    dsn: string;
    service: string;
    environment?: string;
    release?: string;
    debug?: boolean;
  };

  if (!config?.dsn) return;

  hub.init({
    dsn: config.dsn,
    service: config.service,
    environment: config.environment,
    release: config.release,
    debug: config.debug,
    integrations: [new ConsoleIntegration(), new GlobalErrorIntegration()],
  });

  const client = hub.getClient();
  if (!client) return;

  // Track request spans
  nitroApp.hooks.hook('request', (event) => {
    const headers = getRequestHeaders(event);
    const traceparent = headers['traceparent'];
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

    const url = getRequestURL(event);
    const method = event.method ?? 'GET';

    const scope = client.createScope(traceId);
    const span = client.startSpan({
      name: `${method} ${url.pathname}`,
      traceId,
      parentSpanId,
      attributes: {
        'http.method': method,
        'http.url': url.href,
        'http.target': url.pathname,
      },
    });

    scope.spanId = span.spanId;

    // Store on event context for afterResponse / error hooks
    (event.context as Record<string, unknown>).__logtide = { scope, spanId: span.spanId };
  });

  nitroApp.hooks.hook('afterResponse', (event) => {
    const ctx = (event.context as Record<string, unknown>).__logtide as
      | { spanId: string }
      | undefined;
    if (ctx) {
      client.finishSpan(ctx.spanId, 'ok');
    }
  });

  nitroApp.hooks.hook('error', (error, { event }) => {
    const ctx = event
      ? ((event.context as Record<string, unknown>).__logtide as
          | { scope: ReturnType<typeof client.createScope>; spanId: string }
          | undefined)
      : undefined;

    if (ctx) {
      client.finishSpan(ctx.spanId, 'error');
      client.captureError(error, {}, ctx.scope);
    } else {
      client.captureError(error);
    }
  });
});

// Stub for runtimeConfig — Nuxt provides this globally
declare function useRuntimeConfig(): Record<string, unknown>;
