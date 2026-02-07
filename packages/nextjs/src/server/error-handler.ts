import { hub } from '@logtide/core';

/**
 * Next.js `onRequestError` handler.
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional
 */
export function captureRequestError(
  error: unknown,
  request: { method: string; url: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
): void {
  const client = hub.getClient();
  if (!client) return;

  const scope = client.createScope();
  scope.setTag('route.kind', context.routerKind);
  scope.setTag('route.path', context.routePath);
  scope.setTag('route.type', context.routeType);
  if (context.renderSource) {
    scope.setTag('render.source', context.renderSource);
  }

  scope.addBreadcrumb({
    type: 'http',
    category: 'request.error',
    message: `${request.method} ${request.url}`,
    level: 'error',
    timestamp: Date.now(),
    data: {
      method: request.method,
      url: request.url,
      routePath: context.routePath,
    },
  });

  client.captureError(error, {
    'http.method': request.method,
    'http.url': request.url,
    'route.path': context.routePath,
    'route.kind': context.routerKind,
    'route.type': context.routeType,
  }, scope);
}
