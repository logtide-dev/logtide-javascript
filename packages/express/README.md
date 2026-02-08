<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/express</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/express"><img src="https://img.shields.io/npm/v/@logtide/express?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-4%2F5-000000.svg" alt="Express"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> middleware for Express — automatic request tracing, error capture, and breadcrumbs.
</p>

---

## Features

- **Automatic request spans** for every incoming request
- **Error capture** with full request context
- **W3C Trace Context** propagation (`traceparent` in/out)
- **Breadcrumbs** for HTTP requests
- **Scope access** via `req.logtideScope`
- **Express 4 and 5** support
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/express
# or
pnpm add @logtide/express
# or
yarn add @logtide/express
```

---

## Quick Start

```typescript
import express from 'express';
import { logtide } from '@logtide/express';

const app = express();

app.use(logtide({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-express-api',
  environment: 'production',
}));

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
```

---

## How It Works

The middleware runs on every request and:

1. **Extracts** incoming `traceparent` header (or generates a new trace ID)
2. **Creates a span** named after the request (e.g. `GET /hello`)
3. **Stores scope** on the request object (`req.logtideScope`)
4. **Calls `next()`** to process the request
5. **Finishes the span** with `ok` or `error` based on response status
6. **Injects `traceparent`** into the response headers
7. **Captures errors** for 5xx responses with full context

---

## Accessing the Scope

Use `req.logtideScope` to access the LogTide scope inside your handlers:

```typescript
app.get('/users/:id', (req, res) => {
  const scope = req.logtideScope;
  const traceId = req.logtideTraceId;

  // Add custom breadcrumbs
  scope?.addBreadcrumb({
    type: 'query',
    category: 'database',
    message: 'SELECT * FROM users WHERE id = ?',
    timestamp: Date.now(),
  });

  res.json({ id: req.params.id });
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

5xx responses are automatically captured with:
- HTTP method and URL
- Request span marked as `error`
- Error log with status code

For custom error handling, use Express error middleware:

```typescript
app.use((err, req, res, next) => {
  const scope = req.logtideScope;
  if (scope) {
    const { hub } = require('@logtide/core');
    hub.getClient()?.captureError(err, {
      'http.method': req.method,
      'http.url': req.originalUrl,
    }, scope);
  }
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## Exports

```typescript
import { logtide } from '@logtide/express';
import type { LogtideExpressOptions } from '@logtide/express';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/express/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
