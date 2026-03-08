import {
  ErrorHandler,
  type EnvironmentProviders,
  type Provider,
  makeEnvironmentProviders,
  APP_INITIALIZER,
} from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import type { Integration } from '@logtide/types';
import { hub, GlobalErrorIntegration, resolveDSN } from '@logtide/core';
import {
  getSessionId,
  WebVitalsIntegration,
  ClickBreadcrumbIntegration,
  NetworkBreadcrumbIntegration,
  type BrowserClientOptions,
} from '@logtide/browser';
import { LogtideErrorHandler } from './error-handler';
import { LogtideHttpInterceptor } from './http-interceptor';

function buildBrowserIntegrations(options: BrowserClientOptions): Integration[] {
  const browserOpts = options.browser ?? {};
  const integrations: Integration[] = [];
  const apiUrl = resolveDSN(options).apiUrl;

  if (browserOpts.webVitals) {
    integrations.push(
      new WebVitalsIntegration({
        sampleRate: browserOpts.webVitalsSampleRate,
      }),
    );
  }

  if (browserOpts.clickBreadcrumbs !== false) {
    const clickOpts = typeof browserOpts.clickBreadcrumbs === 'object'
      ? browserOpts.clickBreadcrumbs
      : undefined;
    integrations.push(new ClickBreadcrumbIntegration(clickOpts));
  }

  if (browserOpts.networkBreadcrumbs !== false) {
    const netOpts = typeof browserOpts.networkBreadcrumbs === 'object'
      ? browserOpts.networkBreadcrumbs
      : {};
    integrations.push(
      new NetworkBreadcrumbIntegration({ ...netOpts, apiUrl }),
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
