# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-03-09

### Added

#### Browser SDK (`@logtide/browser`)
- New `@logtide/browser` package with session context, anonymous session ID, and page URL tracking
- `WebVitalsIntegration` — captures Core Web Vitals (LCP, FID, CLS, INP, TTFB), wired into all framework packages
- Click breadcrumb integration — automatic tracking of user clicks with element selector
- Network breadcrumb integration — tracks fetch/XHR requests with method, URL, status, and duration
- `OfflineTransport` with `navigator.sendBeacon` support for reliable delivery on page unload

#### CLI (`@logtide/cli`)
- New `@logtide/cli` package — `logtide` command-line tool
- `logtide sourcemaps upload` command for uploading source maps to LogTide server
- Built with `commander` for CLI argument parsing

#### Framework Improvements
- Framework-specific improvements across all packages (phase 6)

### Fixed
- Fixed CLI typecheck: typed `response.json()` as `Record`

## [0.6.1] - 2026-02-28

### Fixed
- **Security Updates**: Addressed multiple security vulnerabilities across the workspace:
  - Updated `minimatch` to `>=10.2.3` (fixes several ReDoS vulnerabilities).
  - Updated `rollup` to `>=4.59.0` (fixes Arbitrary File Write via Path Traversal).
  - Updated `tar` to `>=7.5.8` (fixes Hardlink Target Escape).
  - Updated `nanotar` to `^0.2.1` (fixes Path Traversal).
  - Updated `@angular/core` to `^19.2.19` (fixes XSS in i18n).
  - Updated `@sveltejs/kit` to `^2.52.2` and `svelte` to `^5.53.5` (fixes XSS and Resource Exhaustion).
  - Updated `ajv` to `>=8.18.0` (fixes ReDoS).
  - Updated `qs` to `>=6.14.2` (fixes DoS).
  - Updated `hono` to `^4.11.10` (Timing attack hardening).
  - Updated `devalue` to `>=5.6.3` (fixes Prototype Pollution and Resource Exhaustion).

## [0.6.0] - 2026-02-28

### Added
- **OTLP Span Events**: Breadcrumbs are now automatically converted to OTLP Span Events, providing a detailed timeline of events within the trace viewer.
- **Child Spans API**: New `startChildSpan()` and `finishChildSpan()` APIs in `@logtide/core` to create hierarchical spans for operations like DB queries or external API calls.
- **Rich Span Attributes**: Added standardized attributes to request spans across all frameworks:
  - `http.user_agent`, `net.peer.ip`, `http.query_string` (at start)
  - `http.status_code`, `duration_ms`, `http.route` (at finish)
- **Express Error Handler**: Exported `logtideErrorHandler` to capture unhandled errors and associate them with the current request scope.

### Changed
- **Enriched Breadcrumbs**: Request/Response breadcrumbs now include more metadata (`method`, `url`, `status`, `duration_ms`) by default.
- **Improved Nuxt Tracing**: Nitro plugin now accurately captures response status codes and durations.
- **Improved Angular Tracing**: `LogtideHttpInterceptor` now captures status codes for both successful and failed outgoing requests.

### Fixed
- Fixed a bug in Nuxt Nitro plugin where spans were always marked as 'ok' regardless of the actual response status.

## [0.5.6] - 2026-02-08

### Changed

#### DSN Simplified
- Removed redundant `projectId` from DSN format — the API key already embeds the project ID
- New DSN format: `https://lp_APIKEY@host` (legacy format with path still accepted for backward compatibility)
- Added `apiUrl` + `apiKey` as alternative to DSN string (backward compatible with `@logtide/sdk-node` config format)
- Added `resolveDSN()` helper that accepts either `dsn` or `apiUrl` + `apiKey`
- Removed `projectId` field from `DSN` interface (`@logtide/types`)
- Removed `X-Project-Id` header from `LogtideHttpTransport` and `OtlpHttpTransport` (`@logtide/core`)

#### Dynamic Service Name
- `service` in `ClientOptions` is now **optional** — each framework package defaults to its own name (`'express'`, `'fastify'`, `'hono'`, `'elysia'`, `'nextjs'`, `'sveltekit'`, `'nuxt'`, `'angular'`)
- Added `service?: string` field and `setService()` method to `Scope` — allows overriding service name per-request or per-module
- Service resolution chain: `scope.service` → `options.service` → framework default → `'unknown'`

#### Mock Server
- Removed `X-Project-Id` from CORS headers and request tracking

#### Documentation
- Updated DSN format examples across all package READMEs

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

[0.7.0]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.7.0
[0.6.1]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.6.1
[0.6.0]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.6.0
[0.5.6]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.5.6
[0.5.5]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.5.5
