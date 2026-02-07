import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/middleware/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: true, // Important for CommonJS compatibility (adds __dirname, __filename)
  treeshake: true,
});
