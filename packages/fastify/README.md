<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/fastify</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/fastify"><img src="https://img.shields.io/npm/v/@logtide/fastify?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/Fastify-4%2F5-000000.svg" alt="Fastify"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> plugin for Fastify — automatic request tracing, error capture, and breadcrumbs.
</p>

---

## Features

- **Automatic request spans** for every incoming request
- **Error capture** with full request context
- **W3C Trace Context** propagation (`traceparent` in/out)
- **Breadcrumbs** for HTTP requests
- **Scope access** via `request.logtideScope`
- **Fastify 4 and 5** support
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/fastify
# or
pnpm add @logtide/fastify
# or
yarn add @logtide/fastify
```

---

## Quick Start

```typescript
import Fastify from 'fastify';
import { logtide } from '@logtide/fastify';

const app = Fastify();

await app.register(logtide, {
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-fastify-api',
  environment: 'production',
});

app.get('/hello', async () => ({ message: 'Hello World' }));

await app.listen({ port: 3000 });
```

---

## How It Works

The plugin hooks into Fastify's request lifecycle:

1. **onRequest**: Extracts `traceparent` header (or generates a new trace ID), creates a span, stores scope on `request`
2. **onResponse**: Finishes the span with `ok` or `error` based on status, injects `traceparent` into response
3. **onError**: Captures thrown errors with full HTTP context

---

## Accessing the Scope

Use `request.logtideScope` to access the LogTide scope inside your handlers:

```typescript
app.get('/users/:id', async (request, reply) => {
  const scope = request.logtideScope;
  const traceId = request.logtideTraceId;

  // Add custom breadcrumbs
  scope?.addBreadcrumb({
    type: 'query',
    category: 'database',
    message: 'SELECT * FROM users WHERE id = ?',
    timestamp: Date.now(),
  });

  return { id: request.params.id };
});
```

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

Errors thrown by handlers are automatically captured with:
- HTTP method and URL
- Request span marked as `error`
- Error serialized with stack trace

```typescript
app.get('/boom', async () => {
  throw new Error('Something broke');
  // Automatically captured by LogTide plugin
});
```

For 5xx responses, the plugin also logs an error entry.

---

## Exports

```typescript
import { logtide } from '@logtide/fastify';
import type { LogtideFastifyOptions } from '@logtide/fastify';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/fastify/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
