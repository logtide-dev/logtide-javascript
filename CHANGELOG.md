# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.0] - 2026-06-30

Audit of every package's public exports against the documentation, fixing all
import/usage mismatches found (the same class of bug as the missing
`initLogtide` export in 0.10.0).

### Added

- **`@logtide/browser`: `LogtideErrorBoundary` export** — the React error boundary documented at logtide.dev/integrations/react (`import { LogtideErrorBoundary } from '@logtide/browser'`) is now actually exported. `react` is declared as an **optional** peer dependency. `@logtide/nextjs/client` now re-exports this single shared implementation instead of its own copy.
- **`@logtide/nuxt`: `useLogtide()` composable** — auto-imported composable (`const { captureLog, captureError, addBreadcrumb } = useLogtide()`) for manual capture, as shown in the docs. Previously documented but not implemented.
- **`@logtide/cli`: `--path` option and `--apiKey` / `--apiUrl` aliases** for `sourcemaps upload` — the documented invocation `logtide sourcemaps upload --path ./dist --release 1.0.0 --apiKey KEY` now works. The directory may be passed either positionally or via `--path`; the canonical `--api-key` / `--api-url` forms continue to work.

### Fixed

- **`@logtide/nuxt`: `tracesSampleRate`, `apiUrl` and `apiKey` options are now honored.** The module previously dropped `tracesSampleRate` and ignored `apiUrl`/`apiKey` (it bailed out unless a `dsn` was set), contradicting the README. Configuration via `apiUrl` + `apiKey` (instead of `dsn`) now works on both client and server.
- **`@logtide/sdk-node` README**: the Express/Fastify middleware examples now import from `@logtide/sdk-node/middleware` (where `logTideMiddleware` / `logTideFastifyPlugin` actually live) instead of the package root.
- **`@logtide/nuxt` README**: corrected the documented default `service` value to `'nuxt'`.

## [0.10.0] - 2026-06-28

### Added

- **`@logtide/browser`: `initLogtide` export** — the browser SDK now exposes `initLogtide(options)` directly, matching the React integration docs (`import { initLogtide } from '@logtide/browser'`). It wires up the global error handler, the default browser integrations (click/network breadcrumbs, optional Web Vitals) and offline resilience, then binds the session id to the global scope. Resolves [#9](https://github.com/logtide-dev/logtide-javascript/issues/9).
- **`@logtide/browser`: `buildBrowserIntegrations` / `buildBrowserTransportWrapper` helpers** — exported building blocks used by `initLogtide` and the framework wrappers.

### Changed

- **Framework client init now delegates to `@logtide/browser`** (`@logtide/nextjs`, `@logtide/sveltekit`, `@logtide/angular`): the previously duplicated browser-init logic in each package is gone — all three call the shared `initLogtide`, passing their own `defaultService`. Behaviour is unchanged except for the SvelteKit default below.
- **`@logtide/sveltekit`: default service is now `'sveltekit'`** when `service` is not provided in the options. Previously the SvelteKit client init set no default, so logs fell back to `'unknown'`; it now matches the Next.js (`'nextjs'`) and Angular (`'angular'`) behaviour. An explicit `service` still wins.

## [0.9.0] - 2026-06-22

### Added

- **`@logtide/fastify`: `includeResponseBody` option** — captures the serialized response payload (truncated to 4096 chars) into the span attribute `http.response_body`. Opt-in; no redaction is applied, so gate it to non-sensitive routes if needed.

### Fixed

- **Duplicate integrations are now ignored** (`@logtide/core`): `Client.addIntegration` skips an integration whose `name` is already installed. Previously a caller that re-passed the framework defaults (e.g. registering `@logtide/fastify` with `integrations: [new ConsoleIntegration(), new GlobalErrorIntegration()]`) double-wrapped `console.*` — every log produced two identical breadcrumbs — and double-bound the global error handler.
- **Per-request breadcrumbs in logs** (`@logtide/core`): `captureLog`/`captureError` now attach the breadcrumbs of the provided `Scope` instead of the app-wide global buffer. This stops the global, accumulated console history from leaking into a single request's log metadata. Logs emitted without a scope still use the global buffer as before.

## [0.8.0] - 2026-06-11

### Added

- Every entry now carries `metadata.sdk = {"name": "logtide-javascript", "version": ...}` (caller-provided `sdk` key wins)
- `Retry-After` header on `429` responses now overrides the computed backoff delay
- `HttpError` (exported from `@logtide/core` utils) carrying the response status and parsed `Retry-After`

### Changed

- **Client errors (4xx except 408/429) are no longer retried**: the batch is dropped after the first attempt instead of burning the full retry budget
- **DSN paths are now preserved as a base-path prefix** (`https://lp_key@host/logtide` → ingest at `https://host/logtide/api/v1/ingest`) for reverse-proxied installs. Previously the path was ignored

## [0.7.2] - 2026-04-07

### Fixed
- **Smoke test regression**: Upgraded `express` to v5 in `test-app-node-express` — the `path-to-regexp >=8.4.0` security override broke express 4.x, which calls the `pathRegexp` named export removed in 8.4.0. Express 5 uses path-to-regexp 8.4+ natively.

### Changed
- **Security hardening**: Patched all 54 Dependabot security alerts via `pnpm.overrides` in the root `package.json`. Affected packages include: `tar`, `esbuild`, `webpack`, `cookie`, `minimatch`, `rollup`, `ajv`, `qs`, `devalue`, `hono`, `@angular/core`, `@angular/compiler`, `@sveltejs/kit`, `svelte`, `nanotar`, `simple-git`, `@hono/node-server`, `defu`, `elysia`, `h3`, `immutable`, `lodash`, `node-forge`, `path-to-regexp`, `picomatch`, `serialize-javascript`, `svgo`, `undici`, `vite`, `brace-expansion`, `fastify`, `file-type`, `next`, `srvx`, `unhead`, and `yaml`. `pnpm audit` reports no known vulnerabilities.

## [0.7.1] - 2026-04-07

### Fixed
- **Broken 0.7.0 release**: All `@logtide/*@0.7.0` packages were published with `workspace:*` literals in their `dependencies`, causing `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` on `pnpm add` and equivalent failures on npm. Republished with proper version specifiers ([#189](https://github.com/logtide-dev/logtide/issues/189)).

### Changed
- **CI hardening**: `publish.yml` now fails fast if any `package.json` still contains the `workspace:` protocol after the version-rewrite step, preventing future broken releases.
- **CI completeness**: `publish.yml` now also publishes `@logtide/browser` and `@logtide/cli`, which were previously missing from the publish job.

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

[0.7.2]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.7.2
[0.7.1]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.7.1
[0.7.0]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.7.0
[0.6.1]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.6.1
[0.6.0]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.6.0
[0.5.6]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.5.6
[0.5.5]: https://github.com/logtide-dev/logtide-javascript/releases/tag/v0.5.5
