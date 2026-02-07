<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/angular</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/angular"><img src="https://img.shields.io/npm/v/@logtide/angular?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://angular.dev/"><img src="https://img.shields.io/badge/Angular-17+-DD0031.svg" alt="Angular"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> integration for Angular — ErrorHandler, HTTP Interceptor, and distributed trace propagation.
</p>

---

## Features

- **ErrorHandler** — captures all uncaught Angular errors
- **HTTP Interceptor** — traces outgoing HTTP requests, injects `traceparent`, captures HTTP errors
- **`provideLogtide()`** — one-line setup for standalone Angular apps (17+)
- **`getLogtideProviders()`** — provider array for NgModule-based apps
- **Breadcrumbs** for HTTP requests and errors
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/angular
# or
pnpm add @logtide/angular
# or
yarn add @logtide/angular
```

---

## Quick Start

### Standalone Apps (Angular 17+)

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideLogtide } from '@logtide/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideLogtide({
      dsn: 'https://lp_your_key@your-instance.com/project-id',
      service: 'my-angular-app',
      environment: 'production',
    }),
  ],
};
```

### NgModule-based Apps

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { getLogtideProviders } from '@logtide/angular';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    ...getLogtideProviders({
      dsn: 'https://lp_your_key@your-instance.com/project-id',
      service: 'my-angular-app',
    }),
  ],
})
export class AppModule {}
```

---

## What Gets Captured

### Uncaught Errors (ErrorHandler)

All uncaught errors in Angular components, services, and template expressions are automatically captured with:
- Error message and stack trace
- `mechanism: 'angular.errorHandler'` metadata

Errors are also logged to `console.error` so they remain visible in DevTools.

### HTTP Requests (Interceptor)

Every `HttpClient` request is automatically:

1. **Traced** — a span is created for each request (e.g. `HTTP GET /api/users`)
2. **Propagated** — `traceparent` header is injected into outgoing requests
3. **Breadcrumbed** — HTTP requests and errors are recorded as breadcrumbs
4. **Error-captured** — HTTP errors (4xx, 5xx) are sent to LogTide with:
   - HTTP method, URL, status code
   - Request span marked as `error`

---

## API

### `provideLogtide(options)`

Returns `EnvironmentProviders` for standalone Angular apps. Registers:
- `APP_INITIALIZER` — initializes the LogTide hub
- `ErrorHandler` — replaces Angular's default with `LogtideErrorHandler`
- `HTTP_INTERCEPTORS` — adds `LogtideHttpInterceptor`

```typescript
import { provideLogtide } from '@logtide/angular';

provideLogtide({
  dsn: '...',
  service: 'my-app',
  environment: 'production',
  release: '1.0.0',
});
```

### `getLogtideProviders(options)`

Returns a `Provider[]` for NgModule-based apps. Same registrations as `provideLogtide`.

```typescript
import { getLogtideProviders } from '@logtide/angular';

@NgModule({
  providers: [...getLogtideProviders({ dsn: '...', service: 'my-app' })],
})
export class AppModule {}
```

### `LogtideErrorHandler`

Angular `ErrorHandler` implementation. Use directly if you need custom error handling logic:

```typescript
import { ErrorHandler } from '@angular/core';
import { LogtideErrorHandler } from '@logtide/angular';

@NgModule({
  providers: [
    { provide: ErrorHandler, useClass: LogtideErrorHandler },
  ],
})
```

### `LogtideHttpInterceptor`

Angular `HttpInterceptor` implementation. Use directly for manual registration:

```typescript
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { LogtideHttpInterceptor } from '@logtide/angular';

@NgModule({
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: LogtideHttpInterceptor, multi: true },
  ],
})
```

---

## Exports

```typescript
import {
  provideLogtide,
  getLogtideProviders,
  LogtideErrorHandler,
  LogtideHttpInterceptor,
} from '@logtide/angular';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/angular/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
