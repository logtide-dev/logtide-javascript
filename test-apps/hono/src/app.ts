import { Hono } from 'hono';
import { logtide } from '@logtide/hono';
import { hub } from '@logtide/core';

export function createApp(dsn: string) {
  const app = new Hono();

  app.use('*', logtide({
    dsn,
    service: 'test-hono',
    environment: 'test',
    batchSize: 1,
    flushInterval: 500,
  }));

  app.get('/test-log', (c) => {
    const client = hub.getClient();
    const scope = c.get('logtideScope');
    client?.captureLog('info', 'manual log from hono', { route: '/test-log' }, scope);
    return c.json({ ok: true });
  });

  app.get('/test-error', () => {
    throw new Error('Test error from Hono');
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}
