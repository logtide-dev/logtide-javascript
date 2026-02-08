<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/nuxt</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/nuxt"><img src="https://img.shields.io/npm/v/@logtide/nuxt?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://nuxt.com/"><img src="https://img.shields.io/badge/Nuxt-3+-00DC82.svg" alt="Nuxt"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> integration for Nuxt 3 — auto error capture, request tracing via Nitro hooks, and Vue error handling.
</p>

---

## Features

- **Nuxt Module** — zero-config setup via `nuxt.config.ts`
- **Server-side request tracing** via Nitro lifecycle hooks
- **Vue error handler** for client-side error capture
- **Navigation tracking** as breadcrumbs on the client
- **W3C Trace Context** propagation (`traceparent`)
- **Runtime config** injection (server + public)
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/nuxt
# or
pnpm add @logtide/nuxt
# or
yarn add @logtide/nuxt
```

---

## Quick Start

Add the module to your `nuxt.config.ts`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@logtide/nuxt'],

  logtide: {
    dsn: 'https://lp_your_key@your-instance.com',
    // Or use apiUrl + apiKey instead of dsn:
    // apiUrl: 'https://your-instance.com',
    // apiKey: 'lp_your_key',
    service: 'my-nuxt-app',
    environment: 'production',
    release: '1.0.0',
  },
});
```

That's it. The module automatically:
1. Registers a **Nitro server plugin** that traces every request and captures errors
2. Registers a **Vue client plugin** that captures Vue errors and tracks navigation

---

## Configuration

All options are set in `nuxt.config.ts` under the `logtide` key:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | **required** | DSN string: `https://lp_KEY@host/PROJECT` |
| `service` | `string` | `'nuxt-app'` | Service name for log attribution |
| `environment` | `string` | — | Environment (e.g. `production`, `staging`) |
| `release` | `string` | — | Release / version identifier |
| `debug` | `boolean` | `false` | Enable debug logging |

---

## How It Works

### Server (Nitro)

The server plugin hooks into Nitro's lifecycle:

- **`request`** — creates a trace span, extracts incoming `traceparent`, stores context on the event
- **`afterResponse`** — finishes the span as `ok`
- **`error`** — finishes the span as `error` and captures the error with full context

### Client (Vue)

The client plugin:

- Sets up `vueApp.config.errorHandler` to capture Vue component errors
- Tracks `page:start` and `page:finish` hooks as navigation breadcrumbs
- Reads configuration from Nuxt runtime config (public)

---

## Runtime Config

The module injects LogTide configuration into Nuxt's runtime config, making it available in both server and client plugins:

```typescript
// Server-side
const config = useRuntimeConfig().logtide;

// Client-side
const config = useRuntimeConfig().public.logtide;
```

---

## Type Support

```typescript
import type { ModuleOptions } from '@logtide/nuxt';
```

The `ModuleOptions` interface extends `ClientOptions` from `@logtide/types` (excluding `integrations` and `transport` which are configured automatically).

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/nuxt/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
