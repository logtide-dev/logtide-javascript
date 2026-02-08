<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">@logtide/nextjs</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@logtide/nextjs"><img src="https://img.shields.io/npm/v/@logtide/nextjs?color=blue" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14+-black.svg" alt="Next.js"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
</p>

<p align="center">
  <a href="https://logtide.dev">LogTide</a> integration for Next.js — auto error capture, request tracing, and performance spans for both server and client.
</p>

---

## Features

- **Server-side request tracing** with automatic span creation
- **Error capture** via Next.js `onRequestError` hook
- **Client-side error boundary** for React components
- **Navigation tracking** as breadcrumbs
- **W3C Trace Context** propagation (`traceparent`)
- **App Router & Pages Router** support
- **Full TypeScript support** with strict types

## Installation

```bash
npm install @logtide/nextjs
# or
pnpm add @logtide/nextjs
# or
yarn add @logtide/nextjs
```

---

## Quick Start

### 1. Server-side Setup

Create (or update) your `instrumentation.ts` at the project root:

```typescript
// instrumentation.ts
import { registerLogtide, captureRequestError } from '@logtide/nextjs/server';

export async function register() {
  await registerLogtide({
    dsn: 'https://lp_your_key@your-instance.com',
    // Or use apiUrl + apiKey instead of dsn:
    // apiUrl: 'https://your-instance.com',
    // apiKey: 'lp_your_key',
    service: 'my-nextjs-app',
    environment: process.env.NODE_ENV,
  });
}

export const onRequestError = captureRequestError;
```

### 2. Client-side Setup

Initialize LogTide in your root layout:

```typescript
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { initLogtide, trackNavigation } from '@logtide/nextjs/client';

initLogtide({
  dsn: 'https://lp_your_key@your-instance.com',
  // Or use apiUrl + apiKey instead of dsn:
  // apiUrl: 'https://your-instance.com',
  // apiKey: 'lp_your_key',
  service: 'my-nextjs-app',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => trackNavigation(), []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## Server API

### `registerLogtide(options)`

Initialize LogTide in Next.js `instrumentation.ts`. Automatically installs `ConsoleIntegration` and `GlobalErrorIntegration`.

```typescript
import { registerLogtide } from '@logtide/nextjs/server';

await registerLogtide({
  dsn: 'https://lp_key@host',
  service: 'my-app',
  environment: 'production',
  release: '1.0.0',
});
```

### `captureRequestError(error, request, context)`

Next.js `onRequestError` handler. Automatically captures errors with route context, HTTP metadata, and breadcrumbs.

```typescript
import { captureRequestError } from '@logtide/nextjs/server';

// instrumentation.ts
export const onRequestError = captureRequestError;
```

Captured metadata includes:
- `route.path`, `route.kind`, `route.type`
- `http.method`, `http.url`
- `render.source` (if available)

### `instrumentRequest(request)`

Manually instrument a server-side request (creates a span and scope):

```typescript
import { instrumentRequest, finishRequest } from '@logtide/nextjs/server';

const result = instrumentRequest({
  headers: new Headers(),
  method: 'GET',
  url: 'http://localhost:3000/api/data',
});

// ... handle request ...

finishRequest(result!.spanId, 200);
```

### `finishRequest(spanId, statusCode)`

Finish a request span. Marks as `error` for 5xx status codes, `ok` otherwise.

---

## Client API

### `initLogtide(options)`

Initialize LogTide on the client side. Installs `GlobalErrorIntegration` for `unhandledrejection` events.

```typescript
import { initLogtide } from '@logtide/nextjs/client';

initLogtide({
  dsn: 'https://lp_key@host',
  service: 'my-app',
});
```

### `trackNavigation()`

Track client-side navigation (pushState, replaceState, popstate) as breadcrumbs. Returns a cleanup function.

```typescript
import { useEffect } from 'react';
import { trackNavigation } from '@logtide/nextjs/client';

export default function Layout({ children }) {
  useEffect(() => trackNavigation(), []);
  return <>{children}</>;
}
```

---

## Exports

```typescript
// Main entry — re-exports both server and client
import { registerLogtide, captureRequestError } from '@logtide/nextjs';
import { initLogtide, trackNavigation } from '@logtide/nextjs';

// Server-specific
import { registerLogtide, captureRequestError, instrumentRequest, finishRequest } from '@logtide/nextjs/server';

// Client-specific
import { initLogtide, trackNavigation } from '@logtide/nextjs/client';
```

---

## License

MIT License - see [LICENSE](../../LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs/sdks/nextjs/)
- [GitHub](https://github.com/logtide-dev/logtide-javascript)
