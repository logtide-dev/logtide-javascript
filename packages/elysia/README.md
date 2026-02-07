<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/elysia</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/elysia"><img src="https://img.shields.io/npm/v/@logtide/elysia?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://elysiajs.com/"><img src="https://img.shields.io/badge/Elysia-1+-7C6AEF.svg" alt="Elysia"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> plugin for Elysia — automatic request tracing, error capture, and breadcrumbs via lifecycle hooks.
</p>

---

## Features

- **Automatic request spans** via `onRequest` / `onAfterHandle` lifecycle hooks
- **Error capture** via `onError` hook with full request context
- **W3C Trace Context** propagation (`traceparent` in/out)
- **Breadcrumbs** for HTTP requests
- **Global plugin** — traces all routes automatically
- **Designed for Bun** — works with Elysia's native runtime
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/elysia
# or
pnpm add @logtide/elysia
# or
bun add @logtide/elysia
```

---

## Quick Start

```typescript
import { Elysia } from 'elysia';
import { logtide } from '@logtide/elysia';

const app = new Elysia()
  .use(logtide({
    dsn: 'https://lp_your_key@your-instance.com/project-id',
    service: 'my-elysia-api',
    environment: 'production',
  }))
  .get('/hello', () => 'Hello World')
  .listen(3000);
```

---

## How It Works

The plugin registers global lifecycle hooks on the Elysia app:

1. **`onRequest`** — extracts incoming `traceparent`, creates a span, stores scope on a WeakMap keyed by the request
2. **`onAfterHandle`** — finishes the span with `ok` or `error`, injects `traceparent` into response headers
3. **`onError`** — finishes the span as `error`, captures the error with full HTTP context

The plugin is registered with `.as('global')` so it applies to all routes, including those added after the plugin.

---

## Configuration

All `ClientOptions` from `@logtide/core` are supported:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | **required** | DSN string: `https://lp_KEY@host/PROJECT` |
| `service` | `string` | **required** | Service name for log attribution |
| `environment` | `string` | — | Environment (e.g. `production`, `staging`) |
| `release` | `string` | — | Release / version identifier |
| `debug` | `boolean` | `false` | Enable debug logging |
| `tracesSampleRate` | `number` | `1.0` | Sample rate for traces (0.0 to 1.0) |

See [`@logtide/core` README](../core/README.md) for the full list of options.

---

## Error Handling

Errors thrown by handlers are automatically captured:

```typescript
const app = new Elysia()
  .use(logtide({ dsn: '...', service: 'my-api' }))
  .get('/boom', () => {
    throw new Error('Something broke');
    // Automatically captured with:
    // - http.url, http.method
    // - Error message and stack trace
    // - Span marked as 'error'
  });
```

---

## Distributed Tracing

Incoming `traceparent` headers are extracted and used as parent context:

```bash
# Client sends a traced request
curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  http://localhost:3000/api/data
```

The span created by the plugin will use the same trace ID, enabling end-to-end distributed tracing across services.

Outgoing responses include a `traceparent` header with the span's context.

---

## Exports

```typescript
import { logtide } from '@logtide/elysia';
import type { LogtideElysiaOptions } from '@logtide/elysia';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/elysia/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
