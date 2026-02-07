import Fastify from 'fastify';
import { LogTideClient } from '@logtide/sdk-node';
import { logTideFastifyPlugin } from '@logtide/sdk-node/middleware';

export async function createApp(apiUrl: string, apiKey: string) {
  const client = new LogTideClient({
    apiUrl,
    apiKey,
    batchSize: 1,
    flushInterval: 500,
    maxRetries: 0,
  });

  const fastify = Fastify();

  await fastify.register(logTideFastifyPlugin, {
    client,
    serviceName: 'test-fastify',
    logRequests: true,
    logResponses: true,
    logErrors: true,
  });

  fastify.get('/test-log', async () => {
    client.info('test-fastify', 'manual log from fastify', { route: '/test-log' });
    return { ok: true };
  });

  fastify.get('/test-error', async () => {
    throw new Error('Test error from Fastify');
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  return { fastify, client };
}
