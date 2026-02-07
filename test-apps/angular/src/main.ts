import { bootstrapApplication } from '@angular/platform-browser';
import { hub, GlobalErrorIntegration } from '@logtide/core';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

hub.init({
  dsn: 'http://lp_testkey@127.0.0.1:9103/test-project',
  service: 'test-angular',
  environment: 'test',
  batchSize: 1,
  flushInterval: 500,
  integrations: [new GlobalErrorIntegration()],
});

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
