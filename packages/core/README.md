<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/core</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/core"><img src="https://img.shields.io/npm/v/@logtide/core?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  Core client, hub, transports, and utilities for the <a href="https://logtide.dev">LogTide</a> JavaScript SDK ecosystem.
</p>

---

## Features

- **LogtideClient** — capture logs, errors, breadcrumbs, and spans
- **Hub** — global singleton for convenient access across your app
- **Scope** — per-request context isolation with tags, extras, and breadcrumbs
- **SpanManager** — distributed tracing with W3C Trace Context (`traceparent`)
- **BatchTransport** — automatic batching with retry logic and circuit breaker
- **Integrations** — console interception and global error handling
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/core
# or
pnpm add @logtide/core
# or
yarn add @logtide/core
```

> **Note:** You typically don't need to install this package directly. Use a framework-specific package like `@logtide/nextjs`, `@logtide/hono`, etc. which include `@logtide/core` as a dependency.

---

## Quick Start

### Using the Hub (recommended)

```typescript
import { hub } from '@logtide/core';

// Initialize once
hub.init({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-app',
});

// Log messages
hub.captureLog('info', 'Server started', { port: 3000 });

// Capture errors
try {
  dangerousOperation();
} catch (error) {
  hub.captureError(error, { context: 'startup' });
}

// Add breadcrumbs
hub.addBreadcrumb({
  type: 'http',
  category: 'request',
  message: 'GET /api/users',
  timestamp: Date.now(),
});

// Graceful shutdown
process.on('SIGTERM', () => hub.close());
```

### Using the Client directly

```typescript
import { LogtideClient } from '@logtide/core';

const client = new LogtideClient({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-app',
});

// Create isolated scopes per request
const scope = client.createScope();
scope.setTag('userId', '123');

client.captureLog('info', 'Request handled', {}, scope);
client.captureError(new Error('oops'), {}, scope);

await client.close();
```

---

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dsn` | `string` | **required** | DSN string: `https://lp_KEY@host/PROJECT` |
| `service` | `string` | **required** | Service name for log attribution |
| `environment` | `string` | — | Environment (e.g. `production`, `staging`) |
| `release` | `string` | — | Release / version identifier |
| `batchSize` | `number` | `100` | Logs to batch before sending |
| `flushInterval` | `number` | `5000` | Auto-flush interval in ms |
| `maxBufferSize` | `number` | `10000` | Max logs in buffer before dropping |
| `maxRetries` | `number` | `3` | Max retry attempts on failure |
| `retryDelayMs` | `number` | `1000` | Initial retry delay (exponential backoff) |
| `circuitBreakerThreshold` | `number` | `5` | Failures before opening circuit |
| `circuitBreakerResetMs` | `number` | `30000` | Time before retrying after circuit opens |
| `debug` | `boolean` | `false` | Enable debug logging |
| `transport` | `Transport` | — | Custom transport (overrides default) |
| `integrations` | `Integration[]` | — | Integrations to install |
| `maxBreadcrumbs` | `number` | `100` | Max breadcrumbs to keep |
| `tracesSampleRate` | `number` | `1.0` | Sample rate for traces (0.0 to 1.0) |

---

## Distributed Tracing

```typescript
import { hub, parseTraceparent, createTraceparent, generateTraceId } from '@logtide/core';

const client = hub.getClient()!;

// Parse incoming traceparent header
const ctx = parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
// => { traceId: '4bf92f...', parentSpanId: '00f067...', sampled: true }

// Start a span
const span = client.startSpan({
  name: 'GET /api/users',
  traceId: ctx?.traceId ?? generateTraceId(),
  parentSpanId: ctx?.parentSpanId,
  attributes: { 'http.method': 'GET' },
});

// Finish the span
client.finishSpan(span.spanId, 'ok');

// Create traceparent header for outgoing requests
const header = createTraceparent(span.traceId, span.spanId, true);
// => '00-4bf92f...-abcdef...-01'
```

---

## Integrations

### ConsoleIntegration

Intercepts `console.log/warn/error` and records breadcrumbs:

```typescript
import { hub, ConsoleIntegration } from '@logtide/core';

hub.init({
  dsn: '...',
  service: 'my-app',
  integrations: [new ConsoleIntegration()],
});
```

### GlobalErrorIntegration

Captures `unhandledrejection` and `uncaughtException` events:

```typescript
import { hub, GlobalErrorIntegration } from '@logtide/core';

hub.init({
  dsn: '...',
  service: 'my-app',
  integrations: [new GlobalErrorIntegration()],
});
```

---

## Exports

```typescript
// Core classes
export { LogtideClient, hub, Scope, SpanManager, BreadcrumbBuffer } from '@logtide/core';

// DSN
export { parseDSN } from '@logtide/core';

// Transports
export { LogtideHttpTransport, OtlpHttpTransport, BatchTransport } from '@logtide/core';

// Utils
export { serializeError, generateTraceId, generateSpanId, CircuitBreaker } from '@logtide/core';
export { parseTraceparent, createTraceparent } from '@logtide/core';

// Integrations
export { ConsoleIntegration, GlobalErrorIntegration } from '@logtide/core';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
