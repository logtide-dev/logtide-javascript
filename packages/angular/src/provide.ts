import {
  ErrorHandler,
  type EnvironmentProviders,
  type Provider,
  makeEnvironmentProviders,
  APP_INITIALIZER,
} from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import type { Integration } from '@logtide/types';
import { hub, GlobalErrorIntegration } from '@logtide/core';
import { getSessionId, WebVitalsIntegration, type BrowserClientOptions } from '@logtide/browser';
import { LogtideErrorHandler } from './error-handler';
import { LogtideHttpInterceptor } from './http-interceptor';

function buildBrowserIntegrations(options: BrowserClientOptions): Integration[] {
  const integrations: Integration[] = [];
  if (options.browser?.webVitals) {
    integrations.push(
      new WebVitalsIntegration({
        sampleRate: options.browser.webVitalsSampleRate,
      }),
    );
  }
  return integrations;
}

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
          hub.init({
            service: 'angular',
            ...options,
            integrations: [
              new GlobalErrorIntegration(),
              ...buildBrowserIntegrations(options),
              ...(options.integrations ?? []),
            ],
          });
          hub.getScope().setSessionId(getSessionId());
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
          hub.init({
            service: 'angular',
            ...options,
            integrations: [
              new GlobalErrorIntegration(),
              ...buildBrowserIntegrations(options),
              ...(options.integrations ?? []),
            ],
          });
          hub.getScope().setSessionId(getSessionId());
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
