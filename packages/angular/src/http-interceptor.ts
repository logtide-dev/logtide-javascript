import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { hub, createTraceparent, generateSpanId } from '@logtide/core';

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

    if (client) {
      const span = client.startSpan({
        name: `HTTP ${req.method} ${req.urlWithParams}`,
        traceId: scope.traceId,
        parentSpanId: scope.spanId,
        attributes: {
          'http.method': req.method,
          'http.url': req.urlWithParams,
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
        timestamp: Date.now(),
        data: { method: req.method, url: req.urlWithParams },
      });
    }

    return next.handle(clonedReq).pipe(
      tap({
        next: () => {
          // On success, finish span
          if (client && spanId) {
            client.finishSpan(spanId, 'ok');
          }
        },
        error: (error: HttpErrorResponse) => {
          if (client && spanId) {
            client.finishSpan(spanId, 'error');
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
            },
          });

          hub.captureError(error, {
            'http.method': req.method,
            'http.url': req.urlWithParams,
            'http.status': error.status,
          });
        },
      }),
    );
  }
}
