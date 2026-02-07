import { type ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideLogtide } from '@logtide/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideLogtide({
      dsn: 'http://lp_testkey@127.0.0.1:9103/test-project',
      service: 'test-angular',
      environment: 'test',
      batchSize: 1,
      flushInterval: 500,
    }),
  ],
};
