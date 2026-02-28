import {
  hub,
  ConsoleIntegration,
  GlobalErrorIntegration,
  generateTraceId,
  parseTraceparent,
} from '@logtide/core';
import type { Scope, SpanEvent } from '@logtide/core';
import { defineNitroPlugin, getRequestURL, getRequestHeaders, getRequestIP } from 'h3';

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
 * Nitro server plugin — hooks into request, afterResponse, and error lifecycle.
 */
export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig().logtide as {
    dsn: string;
    service?: string;
    environment?: string;
    release?: string;
    debug?: boolean;
  };

  if (!config?.dsn) return;

  hub.init({
    dsn: config.dsn,
    service: config.service ?? 'nuxt',
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
    const userAgent = headers['user-agent'];
    const ip = getRequestIP(event);
    const startTime = Date.now();

    const scope = client.createScope(traceId);
    const span = client.startSpan({
      name: `${method} ${url.pathname}`,
      traceId,
      parentSpanId,
      attributes: {
        'http.method': method,
        'http.url': url.href,
        'http.target': url.pathname,
        ...(userAgent ? { 'http.user_agent': userAgent } : {}),
        ...(ip ? { 'net.peer.ip': ip } : {}),
        ...(url.search ? { 'http.query_string': url.search } : {}),
      },
    });

    scope.spanId = span.spanId;

    scope.addBreadcrumb({
      type: 'http',
      category: 'request',
      message: `${method} ${url.pathname}`,
      timestamp: Date.now(),
      data: { method, url: url.href, ...(userAgent ? { userAgent } : {}) },
    });

    // Store on event context for afterResponse / error hooks
    (event.context as Record<string, unknown>).__logtide = { scope, spanId: span.spanId, startTime };
  });

  nitroApp.hooks.hook('afterResponse', (event) => {
    const ctx = (event.context as Record<string, unknown>).__logtide as
      | { scope: Scope; spanId: string; startTime: number }
      | undefined;
    if (ctx) {
      const status = event.node.res.statusCode;
      const durationMs = Date.now() - ctx.startTime;
      const method = event.method ?? 'GET';
      const url = getRequestURL(event);

      ctx.scope.addBreadcrumb({
        type: 'http',
        category: 'response',
        message: `${status} ${method} ${url.pathname}`,
        level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        timestamp: Date.now(),
        data: { status, duration_ms: durationMs },
      });

      client.finishSpan(ctx.spanId, status >= 500 ? 'error' : 'ok', {
        extraAttributes: {
          'http.status_code': status,
          'duration_ms': durationMs,
        },
        events: breadcrumbsToEvents(ctx.scope),
      });
    }
  });

  nitroApp.hooks.hook('error', (error, { event }) => {
    const ctx = event
      ? ((event.context as Record<string, unknown>).__logtide as
          | { scope: Scope; spanId: string; startTime: number }
          | undefined)
      : undefined;

    if (ctx) {
      const status = event?.node?.res?.statusCode || 500;
      const durationMs = Date.now() - ctx.startTime;

      ctx.scope.addBreadcrumb({
        type: 'http',
        category: 'response',
        message: `${status} error`,
        level: 'error',
        timestamp: Date.now(),
        data: { status, duration_ms: durationMs },
      });

      client.finishSpan(ctx.spanId, 'error', {
        extraAttributes: {
          'http.status_code': status,
          'duration_ms': durationMs,
        },
        events: breadcrumbsToEvents(ctx.scope),
      });
      client.captureError(error, {}, ctx.scope);
    } else {
      client.captureError(error);
    }
  });
});

// Stub for runtimeConfig — Nuxt provides this globally
declare function useRuntimeConfig(): Record<string, unknown>;
