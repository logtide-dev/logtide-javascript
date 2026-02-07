<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/hono</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/hono"><img src="https://img.shields.io/npm/v/@logtide/hono?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-4+-E36002.svg" alt="Hono"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> middleware for Hono — automatic request tracing, error capture, and breadcrumbs.
</p>

---

## Features

- **Automatic request spans** for every incoming request
- **Error capture** with full request context
- **W3C Trace Context** propagation (`traceparent` in/out)
- **Breadcrumbs** for HTTP requests
- **Scope access** via `c.get('logtideScope')`
- **Works everywhere** — Node.js, Bun, Deno, Cloudflare Workers
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/hono
# or
pnpm add @logtide/hono
# or
yarn add @logtide/hono
```

---

## Quick Start

```typescript
import { Hono } from 'hono';
import { logtide } from '@logtide/hono';

const app = new Hono();

app.use('*', logtide({
  dsn: 'https://lp_your_key@your-instance.com/project-id',
  service: 'my-hono-api',
  environment: 'production',
}));

app.get('/hello', (c) => c.json({ message: 'Hello World' }));

export default app;
```

---

## How It Works

The middleware runs on every request and:

1. **Extracts** incoming `traceparent` header (or generates a new trace ID)
2. **Creates a span** named after the request (e.g. `GET /hello`)
3. **Stores scope** on the Hono context (`c.set('logtideScope', scope)`)
4. **Calls `next()`** to process the request
5. **Finishes the span** with `ok` or `error` based on response status
6. **Injects `traceparent`** into the response headers
7. **Captures errors** thrown by handlers with full context

---

## Accessing the Scope

Use `c.get()` to access the LogTide scope inside your handlers:

```typescript
app.get('/users/:id', (c) => {
  const scope = c.get('logtideScope');
  const traceId = c.get('logtideTraceId');

  // Add custom breadcrumbs
  scope.addBreadcrumb({
    type: 'query',
    category: 'database',
    message: 'SELECT * FROM users WHERE id = ?',
    timestamp: Date.now(),
  });

  return c.json({ id: c.req.param('id') });
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
app.get('/boom', () => {
  throw new Error('Something broke');
  // Automatically captured by LogTide middleware
});
```

For 5xx responses (e.g. from Hono's error handler), the middleware also logs an error entry.

---

## Exports

```typescript
import { logtide } from '@logtide/hono';
import type { LogtideHonoOptions } from '@logtide/hono';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/hono/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
