# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.5] - 2026-02-07

### Added

#### Monorepo Structure
- Restructured as pnpm monorepo with 9 packages under `packages/*`
- Unified versioning across all packages (0.5.5)
- Version bump script (`pnpm version:set <version>`)

#### Core (`@logtide/core`)
- `LogtideClient` — capture logs, errors, breadcrumbs, and spans
- `Hub` — global singleton for convenient access
- `Scope` — per-request context isolation with tags, extras, and breadcrumbs
- `SpanManager` — distributed tracing with W3C Trace Context (`traceparent`)
- `BatchTransport` — automatic batching with retry logic and circuit breaker
- `LogtideHttpTransport` and `OtlpHttpTransport` for log and span delivery
- `ConsoleIntegration` — intercepts console methods, records breadcrumbs
- `GlobalErrorIntegration` — captures unhandled rejections and uncaught exceptions
- DSN parsing, error serialization, trace ID generation

#### Types (`@logtide/types`)
- Shared TypeScript interfaces: `LogEntry`, `Span`, `Breadcrumb`, `Transport`, `Integration`, `ClientOptions`

#### Node.js SDK (`@logtide/sdk-node`)
- Standalone Node.js client with batching, retry, circuit breaker, query API, live streaming
- Express middleware and Fastify plugin for auto-logging HTTP requests

#### Next.js (`@logtide/nextjs`)
- Server-side: `registerLogtide()` for `instrumentation.ts`, `captureRequestError` for `onRequestError`
- Client-side: `initLogtide()`, `trackNavigation()` for SPA breadcrumbs
- `instrumentRequest()` / `finishRequest()` for manual request tracing
- App Router and Pages Router support

#### Nuxt (`@logtide/nuxt`)
- Nuxt 3 module with zero-config setup via `nuxt.config.ts`
- Nitro server plugin: request tracing, error capture via lifecycle hooks
- Vue client plugin: `errorHandler`, navigation breadcrumbs
- Runtime config injection (server + public)

#### SvelteKit (`@logtide/sveltekit`)
- `logtideHandle()` — request spans, trace context propagation, scope in `event.locals`
- `logtideHandleError()` — unexpected error capture
- `logtideHandleFetch()` — `traceparent` propagation on server-side fetches
- `initLogtide()` for client-side error handling

#### Hono (`@logtide/hono`)
- Middleware for automatic request tracing, error capture, breadcrumbs
- Scope accessible via `c.get('logtideScope')`
- Works on Node.js, Bun, Deno, Cloudflare Workers

#### Angular (`@logtide/angular`)
- `LogtideErrorHandler` — captures all uncaught Angular errors
- `LogtideHttpInterceptor` — traces outgoing HTTP, injects `traceparent`, captures HTTP errors
- `provideLogtide()` for standalone apps (Angular 17+)
- `getLogtideProviders()` for NgModule-based apps

#### Elysia (`@logtide/elysia`)
- Plugin with `onRequest`, `onAfterHandle`, `onError` lifecycle hooks
- Automatic request spans, error capture, `traceparent` propagation
- Registered as global plugin (`.as('global')`)

#### CI/CD
- GitHub Actions CI: build, typecheck, test on push/PR to `main`/`develop`
- GitHub Actions publish: npm publish on tag `v*.*.*`, GitHub Release, or manual dispatch
- Publish order: types → core → all framework packages
- Branch model: `develop` → `main`, hotfix directly to `main`

#### Documentation
- README for every package with badges, quick start, API reference
- Root README with package table, architecture diagram, development guide
- Branch protection documentation (`.github/BRANCH_PROTECTION.md`)

[0.5.5]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.5.5
