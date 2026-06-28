import {
  ErrorHandler,
  type EnvironmentProviders,
  type Provider,
  makeEnvironmentProviders,
  APP_INITIALIZER,
} from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { initLogtide, type BrowserClientOptions } from '@logtide/browser';
import { LogtideErrorHandler } from './error-handler';
import { LogtideHttpInterceptor } from './http-interceptor';

/**
 * Provide LogTide in a standalone Angular app (Angular 17+).
 *
 * @example
 * ```ts
 * // app.config.ts
 * import { provideLogtide } from '@logtide/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideLogtide({ dsn: '...', service: 'my-angular-app' }),
 *   ],
 * };
 * ```
 */
export function provideLogtide(options: BrowserClientOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        return () => {
          initLogtide(options, { defaultService: 'angular' });
        };
      },
      multi: true,
    },
    { provide: ErrorHandler, useClass: LogtideErrorHandler },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LogtideHttpInterceptor,
      multi: true,
    },
  ]);
}

/**
 * Get the providers array for use in NgModule-based apps.
 *
 * @example
 * ```ts
 * @NgModule({
 *   providers: [
 *     ...getLogtideProviders({ dsn: '...', service: 'my-app' }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export function getLogtideProviders(options: BrowserClientOptions): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        return () => {
          initLogtide(options, { defaultService: 'angular' });
        };
      },
      multi: true,
    },
    { provide: ErrorHandler, useClass: LogtideErrorHandler },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LogtideHttpInterceptor,
      multi: true,
    },
  ];
}
