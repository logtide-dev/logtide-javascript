import { describe, it, expect, vi } from 'vitest';

// Nuxt module tests are limited since the full Nuxt runtime isn't available.
// We test the module definition structure and exported API.

describe('@logtide/nuxt module', () => {
  it('should export a default module', async () => {
    const mod = await import('../src/module');
    expect(mod.default).toBeDefined();
  });

  it('should have correct meta via getMeta()', async () => {
    const mod = await import('../src/module');
    const module = mod.default;
    // @nuxt/kit v3.21+ exposes meta via getMeta() async method
    const meta = await (module as any).getMeta();
    expect(meta.name).toBe('@logtide/nuxt');
    expect(meta.configKey).toBe('logtide');
  });

  it('should have getOptions helper', async () => {
    const mod = await import('../src/module');
    const module = mod.default;
    // defineNuxtModule attaches getOptions to the returned function
    expect(typeof (module as any).getOptions).toBe('function');
  });

  it('should export ModuleOptions type', async () => {
    const mod = await import('../src/module');
    // Type-only check — if this compiles, the type exists
    const opts: import('../src/module').ModuleOptions = {
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'test',
    };
    expect(opts.dsn).toBeDefined();
    expect(opts.service).toBeDefined();
  });
});
