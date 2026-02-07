import express from 'express';
import { LogTideClient } from '@logtide/sdk-node';
import { logTideMiddleware } from '@logtide/sdk-node/middleware';

export function createApp(apiUrl: string, apiKey: string) {
  const client = new LogTideClient({
    apiUrl,
    apiKey,
    batchSize: 1,
    flushInterval: 500,
    maxRetries: 0,
  });

  const app = express();

  app.use(logTideMiddleware({
    client,
    serviceName: 'test-express',
    logRequests: true,
    logResponses: true,
    logErrors: true,
  }));

  app.get('/test-log', (_req, res) => {
    client.info('test-express', 'manual log from express', { route: '/test-log' });
    res.json({ ok: true });
  });

  app.get('/test-error', () => {
    throw new Error('Test error from Express');
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    client.error('test-express', `Unhandled error: ${err.message}`, err);
    res.status(500).json({ error: err.message });
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  return { app, client };
}
