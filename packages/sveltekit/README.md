<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/sveltekit</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/sveltekit"><img src="https://img.shields.io/npm/v/@logtide/sveltekit?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://kit.svelte.dev/"><img src="https://img.shields.io/badge/SvelteKit-2+-FF3E00.svg" alt="SvelteKit"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> integration for SvelteKit — handle, handleError, and handleFetch hooks with distributed tracing.
</p>

---

## Features

- **`handle` hook** — automatic request spans with trace context
- **`handleError` hook** — capture unexpected errors with request context
- **`handleFetch` hook** — propagate `traceparent` to server-side fetches
- **Client-side init** — global error handler for the browser
- **W3C Trace Context** propagation (`traceparent`)
- **Scope in `event.locals`** — access trace context in load functions
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/sveltekit
# or
pnpm add @logtide/sveltekit
# or
yarn add @logtide/sveltekit
```

---

## Quick Start

### 1. Server Hooks

```typescript
// src/hooks.server.ts
import { logtideHandle, logtideHandleError, logtideHandleFetch } from '@logtide/sveltekit/server';

export const handle = logtideHandle({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-sveltekit-app',
  environment: 'production',
});

export const handleError = logtideHandleError();

export const handleFetch = logtideHandleFetch();
```

### 2. Client Hooks

```typescript
// src/hooks.client.ts
import { initLogtide } from '@logtide/sveltekit/client';

initLogtide({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or: apiUrl + apiKey instead of dsn
  service: 'my-sveltekit-app',
});
```

---

## Server API

### `logtideHandle(options)`

Creates a SvelteKit `handle` hook that:
1. Extracts incoming `traceparent` header (or generates a new trace ID)
2. Creates a span for the request (e.g. `GET /dashboard`)
3. Stores the scope and span ID in `event.locals`
4. Finishes the span with `ok` or `error` based on response status
5. Injects `traceparent` into the response headers

```typescript
import { logtideHandle } from '@logtide/sveltekit/server';

export const handle = logtideHandle({
  dsn: '...',
  service: 'my-app',
});
```

**Locals available in load functions:**
```typescript
// In +page.server.ts or +layout.server.ts
export function load({ locals }) {
  // locals.__logtideScope  — the Scope object for this request
  // locals.__logtideSpanId — the current span ID
}
```

### `logtideHandleError()`

Creates a SvelteKit `handleError` hook that captures unexpected errors with HTTP context and the request scope.

```typescript
import { logtideHandleError } from '@logtide/sveltekit/server';

export const handleError = logtideHandleError();
```

### `logtideHandleFetch()`

Creates a SvelteKit `handleFetch` hook that injects `traceparent` into server-side fetch requests, enabling distributed tracing across services.

```typescript
import { logtideHandleFetch } from '@logtide/sveltekit/server';

export const handleFetch = logtideHandleFetch();
```

---

## Client API

### `initLogtide(options)`

Initialize LogTide on the client side. Installs `GlobalErrorIntegration` for `unhandledrejection` events.

```typescript
import { initLogtide } from '@logtide/sveltekit/client';

initLogtide({
  dsn: '...',
  service: 'my-app',
});
```

---

## Exports

```typescript
// Main entry — re-exports server and client
import { logtideHandle, logtideHandleError, logtideHandleFetch, initLogtide } from '@logtide/sveltekit';

// Server-specific
import { logtideHandle, logtideHandleError, logtideHandleFetch } from '@logtide/sveltekit/server';

// Client-specific
import { initLogtide } from '@logtide/sveltekit/client';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/sveltekit/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
