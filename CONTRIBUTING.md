# Contributing to LogTide JavaScript SDK

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/logtide-dev/logtide-javascript.git
cd logtide-javascript
```

2. Install dependencies:
```bash
pnpm install
```

3. Build all packages:
```bash
pnpm build
```

## Project Structure

This is a pnpm monorepo. All packages live under `packages/`:

- `types` — Shared TypeScript type definitions
- `core` — Core client, hub, transports, and utilities
- `express` — Express middleware
- `fastify` — Fastify plugin
- `nextjs` — Next.js integration
- `nuxt` — Nuxt 3 module
- `sveltekit` — SvelteKit hooks
- `hono` — Hono middleware
- `angular` — Angular integration
- `elysia` — Elysia plugin
- `node` — Legacy standalone Node.js SDK

## Code Style

- Follow [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- Use strict TypeScript with no implicit any
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm -r --filter @logtide/express test

# Type checking
pnpm typecheck

# Build all packages
pnpm build
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure tests pass (`pnpm test`)
5. Ensure type checking passes (`pnpm typecheck`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Reporting Issues

- Use the GitHub issue tracker
- Provide clear description and reproduction steps
- Include Node.js version and OS information
- Include relevant logs and error messages

## Questions?

Feel free to open an issue for any questions or discussions!
