import { Elysia } from 'elysia';
import { logtide } from '@logtide/elysia';
import { hub } from '@logtide/core';

export function createApp(dsn: string) {
  const app = new Elysia()
    .use(logtide({
      dsn,
      service: 'test-elysia',
      environment: 'test',
      batchSize: 1,
      flushInterval: 500,
    }))
    .get('/test-log', () => {
      const client = hub.getClient();
      client?.captureLog('info', 'manual log from elysia', { route: '/test-log' });
      return { ok: true };
    })
    .get('/test-error', () => {
      throw new Error('Test error from Elysia');
    })
    .get('/health', () => ({ status: 'ok' }));

  return app;
}
