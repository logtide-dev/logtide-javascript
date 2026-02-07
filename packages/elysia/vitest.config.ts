import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    deps: {
      optimizer: {
        ssr: {
          include: ['elysia', '@sinclair/typebox'],
        },
      },
    },
  },
});
