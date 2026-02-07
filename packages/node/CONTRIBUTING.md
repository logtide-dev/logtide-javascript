# Contributing to LogTide Node.js SDK

Thank you for your interest in contributing!

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/logtide-dev/logtide-sdk-node.git
cd logtide-sdk-node
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the project:
```bash
pnpm build
```

## Code Style

- Follow [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- Use strict TypeScript with no implicit any
- Format code with [Prettier](https://prettier.io/)
- Lint with [ESLint](https://eslint.org/)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure tests pass (`pnpm test`)
5. Lint and format code (`pnpm lint && pnpm format`)
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
