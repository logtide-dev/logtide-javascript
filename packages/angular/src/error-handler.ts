import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { hub } from '@logtide/core';

/**
 * Angular ErrorHandler that reports uncaught errors to LogTide.
 *
 * Detects whether the error occurred inside or outside NgZone and tags
 * the error accordingly. Errors outside NgZone often indicate issues with
 * third-party libraries or manual DOM manipulation.
 *
 * Used automatically when you call `provideLogtide()` or import `LogtideModule`.
 */
@Injectable()
export class LogtideErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const zoneContext = NgZone.isInAngularZone() ? 'inside' : 'outside';

    hub.captureError(error, {
      mechanism: 'angular.errorHandler',
      'angular.zone': zoneContext,
    });

    // Also log to console so errors remain visible in dev
    console.error(error);
  }
}
