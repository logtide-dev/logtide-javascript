import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    '@logtide/core',
    '@logtide/types',
    '@angular/core',
    '@angular/common',
    '@angular/common/http',
    'rxjs',
  ],
});
