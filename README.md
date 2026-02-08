<p align="center">
  <img src="https://raw.githubusercontent.com/logtide-dev/logtide/main/docs/images/logo.png" alt="LogTide Logo" width="400">
</p>

<h1 align="center">LogTide JavaScript SDK</h1>

<p align="center">
  <a href="https://github.com/logtide-dev/logtide-javascript/releases"><img src="https://img.shields.io/github/v/release/logtide-dev/logtide-javascript" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/logtide-dev/logtide-javascript/actions"><img src="https://img.shields.io/github/actions/workflow/status/logtide-dev/logtide-javascript/ci.yml?branch=main" alt="CI"></a>
</p>

<p align="center">
  Official JavaScript SDKs for <a href="https://logtide.dev">LogTide</a> — self-hosted log management with distributed tracing, error capture, and breadcrumbs for every major framework.
</p>

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@logtide/types`](./packages/types) | [![npm](https://img.shields.io/npm/v/@logtide/types?color=blue)](https://www.npmjs.com/package/@logtide/types) | Shared type definitions |
| [`@logtide/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@logtide/core?color=blue)](https://www.npmjs.com/package/@logtide/core) | Core client, hub, transports, and utilities |
| [`@logtide/express`](./packages/express) | [![npm](https://img.shields.io/npm/v/@logtide/express?color=blue)](https://www.npmjs.com/package/@logtide/express) | Express middleware |
| [`@logtide/fastify`](./packages/fastify) | [![npm](https://img.shields.io/npm/v/@logtide/fastify?color=blue)](https://www.npmjs.com/package/@logtide/fastify) | Fastify plugin |
| [`@logtide/nextjs`](./packages/nextjs) | [![npm](https://img.shields.io/npm/v/@logtide/nextjs?color=blue)](https://www.npmjs.com/package/@logtide/nextjs) | Next.js integration (App Router & Pages) |
| [`@logtide/nuxt`](./packages/nuxt) | [![npm](https://img.shields.io/npm/v/@logtide/nuxt?color=blue)](https://www.npmjs.com/package/@logtide/nuxt) | Nuxt 3 module with Nitro hooks |
| [`@logtide/sveltekit`](./packages/sveltekit) | [![npm](https://img.shields.io/npm/v/@logtide/sveltekit?color=blue)](https://www.npmjs.com/package/@logtide/sveltekit) | SvelteKit hooks integration |
| [`@logtide/hono`](./packages/hono) | [![npm](https://img.shields.io/npm/v/@logtide/hono?color=blue)](https://www.npmjs.com/package/@logtide/hono) | Hono middleware |
| [`@logtide/angular`](./packages/angular) | [![npm](https://img.shields.io/npm/v/@logtide/angular?color=blue)](https://www.npmjs.com/package/@logtide/angular) | Angular ErrorHandler, HTTP Interceptor |
| [`@logtide/elysia`](./packages/elysia) | [![npm](https://img.shields.io/npm/v/@logtide/elysia?color=blue)](https://www.npmjs.com/package/@logtide/elysia) | Elysia plugin |
| [`@logtide/sdk-node`](./packages/node) | [![npm](https://img.shields.io/npm/v/@logtide/sdk-node?color=blue)](https://www.npmjs.com/package/@logtide/sdk-node) | Legacy Node.js SDK _(use `@logtide/express` or `@logtide/fastify` instead)_ |

## Quick Start

Every framework package follows the same pattern — pass your DSN and service name:

```bash
# Install for your framework
npm install @logtide/express   # Express
npm install @logtide/fastify   # Fastify
npm install @logtide/nextjs    # Next.js
npm install @logtide/nuxt      # Nuxt 3
npm install @logtide/sveltekit # SvelteKit
npm install @logtide/hono      # Hono
npm install @logtide/angular   # Angular
npm install @logtide/elysia    # Elysia
```

```typescript
// Every integration follows the same pattern:
{
  dsn: 'https://lp_your_key@your-logtide-instance.com',
  service: 'my-app',
}

// Or use apiUrl + apiKey separately:
{
  apiUrl: 'https://your-logtide-instance.com',
  apiKey: 'lp_your_key',
  service: 'my-app',
}
```

See each package's README for framework-specific setup instructions.

---

## Architecture

```
@logtide/types          ← Shared TypeScript interfaces
    ↓
@logtide/core           ← Client, Hub, Scope, Transports, Integrations
    ↓
├── @logtide/express    ← Express middleware
├── @logtide/fastify    ← Fastify plugin
├── @logtide/nextjs     ← Next.js (App Router + Pages)
├── @logtide/nuxt       ← Nuxt 3 (Nitro + Vue)
├── @logtide/sveltekit  ← SvelteKit (handle/handleError/handleFetch)
├── @logtide/hono       ← Hono middleware
├── @logtide/angular    ← Angular (ErrorHandler + HttpInterceptor)
├── @logtide/elysia     ← Elysia plugin
└── @logtide/sdk-node   ← Legacy standalone Node.js SDK
```

All framework packages share `@logtide/core` for:
- **Distributed tracing** (W3C Trace Context / `traceparent`)
- **Error serialization** with structured stack traces
- **Breadcrumbs** for navigation, HTTP, console, and custom events
- **Batched transport** with retry logic and circuit breaker
- **Scope isolation** per request

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# TypeScript check
pnpm typecheck

# Set version across all packages
pnpm version:set 0.6.0
```

## Branch Model

```
feature/* ──> develop ──> main ──> tag v*.*.* ──> npm publish
hotfix/*  ──> main (direct, for urgent fixes)
```

See [`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md) for full details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Links

- [LogTide Website](https://logtide.dev)
- [Documentation](https://logtide.dev/docs)
- [GitHub Issues](https://github.com/logtide-dev/logtide-javascript/issues)
