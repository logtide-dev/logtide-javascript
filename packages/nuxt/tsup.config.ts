import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/module.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@logtide/core',
    '@logtide/types',
    'nuxt',
    '@nuxt/kit',
    '@nuxt/schema',
    'nitropack',
    'vue',
    'h3',
  ],
});
