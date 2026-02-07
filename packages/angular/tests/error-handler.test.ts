import '@angular/compiler';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalLogEntry, Span } from '@logtide/types';

function createMockTransport() {
  return {
    logs: [] as InternalLogEntry[],
    spans: [] as Span[],
    async sendLogs(logs: InternalLogEntry[]) { this.logs.push(...logs); },
    async sendSpans(spans: Span[]) { this.spans.push(...spans); },
    async flush() {},
  };
}

describe('@logtide/angular', () => {
  let hub: typeof import('@logtide/core').hub;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    const core = await import('@logtide/core');
    hub = core.hub;
    await hub.close();
    transport = createMockTransport();
    hub.init({
      dsn: 'https://lp_key@api.logtide.dev/proj',
      service: 'angular-test',
      transport,
    });
  });

  afterEach(async () => {
    await hub.close();
  });

  describe('LogtideErrorHandler', () => {
    it('should capture errors via handleError', async () => {
      const { LogtideErrorHandler } = await import('../src/error-handler');
      const handler = new LogtideErrorHandler();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      handler.handleError(new Error('angular crash'));
      consoleSpy.mockRestore();

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].level).toBe('error');
      expect(transport.logs[0].message).toBe('angular crash');
    });

    it('should log error to console as well', async () => {
      const { LogtideErrorHandler } = await import('../src/error-handler');
      const handler = new LogtideErrorHandler();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('visible error');
      handler.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });

    it('should handle string errors', async () => {
      const { LogtideErrorHandler } = await import('../src/error-handler');
      const handler = new LogtideErrorHandler();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      handler.handleError('string error');
      consoleSpy.mockRestore();

      expect(transport.logs).toHaveLength(1);
      expect(transport.logs[0].message).toBe('string error');
    });
  });

  describe('provideLogtide', () => {
    it('should export provideLogtide function', async () => {
      const mod = await import('../src/provide');
      expect(mod.provideLogtide).toBeDefined();
      expect(typeof mod.provideLogtide).toBe('function');
    });

    it('should export getLogtideProviders function', async () => {
      const mod = await import('../src/provide');
      expect(mod.getLogtideProviders).toBeDefined();
      expect(typeof mod.getLogtideProviders).toBe('function');
    });
  });

  describe('LogtideHttpInterceptor', () => {
    it('should export the interceptor class', async () => {
      const mod = await import('../src/http-interceptor');
      expect(mod.LogtideHttpInterceptor).toBeDefined();
    });
  });
});
