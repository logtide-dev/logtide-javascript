import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/nextjs',
  'packages/nuxt',
  'packages/sveltekit',
  'packages/hono',
  'packages/elysia',
  'packages/angular',
]);
