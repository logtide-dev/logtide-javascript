import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/index.ts',
    'src/client/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@logtide/core', '@logtide/types', '@sveltejs/kit'],
});
