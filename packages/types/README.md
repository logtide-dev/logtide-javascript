<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/types</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/types"><img src="https://img.shields.io/npm/v/@logtide/types?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  Shared TypeScript type definitions for the <a href="https://logtide.dev">LogTide</a> JavaScript SDK ecosystem.
</p>

---

## Installation

```bash
npm install @logtide/types
# or
pnpm add @logtide/types
# or
yarn add @logtide/types
```

> **Note:** You typically don't need to install this package directly. It's automatically included as a dependency of `@logtide/core` and all framework packages.

---

## Exported Types

### Log Types

```typescript
import type { LogLevel, LogEntry, InternalLogEntry } from '@logtide/types';
```

| Type | Description |
|------|-------------|
| `LogLevel` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'critical'` |
| `LogEntry` | Log entry with service, level, message, metadata, trace/span IDs |
| `InternalLogEntry` | `LogEntry` with required `time` field (used internally) |

### Span Types

```typescript
import type { Span, SpanStatus, SpanAttributes } from '@logtide/types';
```

| Type | Description |
|------|-------------|
| `Span` | Distributed trace span with traceId, spanId, name, status, timing |
| `SpanStatus` | `'ok' \| 'error' \| 'unset'` |
| `SpanAttributes` | `Record<string, string \| number \| boolean \| undefined>` |

### Breadcrumb Types

```typescript
import type { Breadcrumb, BreadcrumbType } from '@logtide/types';
```

| Type | Description |
|------|-------------|
| `BreadcrumbType` | `'http' \| 'navigation' \| 'ui' \| 'console' \| 'error' \| 'query' \| 'custom'` |
| `Breadcrumb` | Breadcrumb with type, category, message, level, timestamp, data |

### Transport & Integration

```typescript
import type { Transport, Integration, Client } from '@logtide/types';
```

| Type | Description |
|------|-------------|
| `Transport` | Interface for sending logs and spans (`sendLogs`, `sendSpans`, `flush`) |
| `Integration` | Plugin interface with `setup(client)` and optional `teardown()` |
| `Client` | Minimal client interface for integrations |

### Configuration

```typescript
import type { ClientOptions, DSN } from '@logtide/types';
```

| Type | Description |
|------|-------------|
| `ClientOptions` | Full configuration: DSN (or `apiUrl` + `apiKey`), service, batching, retry, circuit breaker, etc. |
| `DSN` | Parsed DSN with `apiUrl`, `apiKey` |

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
