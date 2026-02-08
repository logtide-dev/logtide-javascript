import type { ClientOptions } from '@logtide/types';
import {
  hub,
  ConsoleIntegration,
  GlobalErrorIntegration,
  generateTraceId,
  parseTraceparent,
  createTraceparent,
} from '@logtide/core';

interface HandleInput {
  event: {
    request: Request;
    url: URL;
    locals: Record<string, unknown>;
  };
  resolve: (event: unknown) => Promise<Response>;
}

interface HandleErrorInput {
  error: unknown;
  event?: {
    request: Request;
    url: URL;
  };
  status?: number;
  message?: string;
}

interface HandleFetchInput {
  event: {
    request: Request;
  };
  request: Request;
  fetch: typeof globalThis.fetch;
}

/**
 * SvelteKit `handle` hook — creates a request span and propagates trace context.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * import { logtideHandle, logtideHandleError } from '@logtide/sveltekit/server';
 * export const handle = logtideHandle({ dsn: '...', service: 'my-app' });
 * export const handleError = logtideHandleError();
 * ```
 */
export function logtideHandle(options: ClientOptions) {
  hub.init({
    service: 'sveltekit',
    ...options,
    integrations: [
      new ConsoleIntegration(),
      new GlobalErrorIntegration(),
      ...(options.integrations ?? []),
    ],
  });

  return async ({ event, resolve }: HandleInput): Promise<Response> => {
    const client = hub.getClient();
    if (!client) return resolve(event);

    // Extract trace context
    const traceparent = event.request.headers.get('traceparent');
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
    const method = event.request.method;
    const pathname = event.url.pathname;

    const span = client.startSpan({
      name: `${method} ${pathname}`,
      traceId,
      parentSpanId,
      attributes: {
        'http.method': method,
        'http.url': event.url.href,
        'http.target': pathname,
      },
    });

    scope.spanId = span.spanId;

    // Make scope available in locals
    event.locals.__logtideScope = scope;
    event.locals.__logtideSpanId = span.spanId;

    scope.addBreadcrumb({
      type: 'http',
      category: 'request',
      message: `${method} ${pathname}`,
      timestamp: Date.now(),
    });

    try {
      const response = await resolve(event);

      client.finishSpan(span.spanId, response.status >= 500 ? 'error' : 'ok');

      // Inject traceparent into response
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('traceparent', createTraceparent(traceId, span.spanId, true));
      return newResponse;
    } catch (error) {
      client.finishSpan(span.spanId, 'error');
      client.captureError(error, {}, scope);
      throw error;
    }
  };
}

/**
 * SvelteKit `handleError` hook — captures unexpected errors.
 */
export function logtideHandleError() {
  return ({ error, event, status, message }: HandleErrorInput) => {
    const client = hub.getClient();
    if (!client) return;

    const scope = event
      ? (((event as Record<string, unknown>).locals as Record<string, unknown>)?.__logtideScope as ReturnType<typeof client.createScope> | undefined)
      : undefined;

    client.captureError(error, {
      'http.status': status,
      'error.message': message,
      'http.url': event?.url?.href,
    }, scope);
  };
}

/**
 * SvelteKit `handleFetch` hook — propagates trace context to server-side fetches.
 */
export function logtideHandleFetch() {
  return async ({ event, request, fetch }: HandleFetchInput): Promise<Response> => {
    const locals = (event as Record<string, unknown>).locals as Record<string, unknown> | undefined;
    const scope = locals?.__logtideScope as { traceId: string; spanId?: string } | undefined;

    if (scope) {
      const headers = new Headers(request.headers);
      headers.set('traceparent', createTraceparent(scope.traceId, scope.spanId ?? '0000000000000000', true));
      request = new Request(request, { headers });
    }

    const client = hub.getClient();
    if (client && scope) {
      client.addBreadcrumb({
        type: 'http',
        category: 'fetch',
        message: `${request.method} ${request.url}`,
        timestamp: Date.now(),
        data: { method: request.method, url: request.url },
      });
    }

    return fetch(request);
  };
}
