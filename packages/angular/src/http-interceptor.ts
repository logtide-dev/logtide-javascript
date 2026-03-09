import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { hub, createTraceparent } from '@logtide/core';

/**
 * Angular HTTP Interceptor that:
 * 1. Injects `traceparent` header into outgoing requests
 * 2. Records HTTP breadcrumbs
 * 3. Creates spans for each HTTP request
 * 4. Captures HTTP errors
 */
@Injectable()
export class LogtideHttpInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const client = hub.getClient();
    const scope = hub.getScope();

    let clonedReq = req;

    // Start a span for this outgoing request
    let spanId: string | undefined;
    const startTime = Date.now();

    if (client) {
      const span = client.startSpan({
        name: `HTTP ${req.method} ${req.urlWithParams}`,
        traceId: scope.traceId,
        parentSpanId: scope.spanId,
        attributes: {
          'http.method': req.method,
          'http.url': req.urlWithParams,
          'http.target': req.url,
        },
      });

      spanId = span.spanId;

      // Inject traceparent header
      clonedReq = req.clone({
        setHeaders: {
          traceparent: createTraceparent(scope.traceId, span.spanId, true),
        },
      });

      // Add breadcrumb for the outgoing request
      hub.addBreadcrumb({
        type: 'http',
        category: 'http.request',
        message: `${req.method} ${req.urlWithParams}`,
        timestamp: startTime,
        data: { method: req.method, url: req.urlWithParams },
      });
    }

    return next.handle(clonedReq).pipe(
      tap({
        next: (event: HttpEvent<unknown>) => {
          if (event instanceof HttpResponse) {
            // On success, finish span with status code
            if (client && spanId) {
              const durationMs = Date.now() - startTime;
              client.finishSpan(spanId, event.status >= 500 ? 'error' : 'ok', {
                extraAttributes: {
                  'http.status_code': event.status,
                  'duration_ms': durationMs,
                },
              });

              hub.addBreadcrumb({
                type: 'http',
                category: 'http.response',
                message: `${req.method} ${req.urlWithParams} → ${event.status}`,
                level: event.status >= 400 ? 'warn' : 'info',
                timestamp: Date.now(),
                data: {
                  method: req.method,
                  url: req.urlWithParams,
                  status: event.status,
                  duration_ms: durationMs,
                },
              });
            }
          }
        },
        error: (error: HttpErrorResponse) => {
          const durationMs = Date.now() - startTime;
          if (client && spanId) {
            client.finishSpan(spanId, 'error', {
              extraAttributes: {
                'http.status_code': error.status,
                'duration_ms': durationMs,
              },
            });
          }

          hub.addBreadcrumb({
            type: 'http',
            category: 'http.error',
            message: `${req.method} ${req.urlWithParams} → ${error.status}`,
            level: 'error',
            timestamp: Date.now(),
            data: {
              method: req.method,
              url: req.urlWithParams,
              status: error.status,
              statusText: error.statusText,
              duration_ms: durationMs,
            },
          });

          hub.captureError(error, {
            'http.method': req.method,
            'http.url': req.urlWithParams,
            'http.status_code': error.status,
            'duration_ms': durationMs,
          });
        },
      }),
    );
  }
}
