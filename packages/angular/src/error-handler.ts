import { ErrorHandler, Injectable } from '@angular/core';
import { hub } from '@logtide/core';

/**
 * Angular ErrorHandler that reports uncaught errors to LogTide.
 *
 * Used automatically when you call `provideLogtide()` or import `LogtideModule`.
 */
@Injectable()
export class LogtideErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    hub.captureError(error, {
      mechanism: 'angular.errorHandler',
    });

    // Also log to console so errors remain visible in dev
    console.error(error);
  }
}
