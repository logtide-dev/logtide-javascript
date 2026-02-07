import Fastify from 'fastify';
import { LogTideClient, logTideFastifyPlugin } from '../src/index.js';

const fastify = Fastify({
  logger: false, // Disable Fastify's built-in logger
});

// Initialize LogTide client
const logger = new LogTideClient({
  apiUrl: 'http://localhost:8080',
  apiKey: 'lp_your_api_key_here',
  globalMetadata: {
    service: 'fastify-api',
    env: process.env.NODE_ENV || 'development',
  },
});

// Register LogTide plugin
await fastify.register(logTideFastifyPlugin, {
  client: logger,
  serviceName: 'fastify-api',
  logRequests: true,
  logResponses: true,
  logErrors: true,
  includeHeaders: false,
  includeBody: false,
  skipHealthCheck: true,
  skipPaths: ['/metrics'],
});

// Routes
fastify.get('/', async (request, reply) => {
  return { message: 'Hello World' };
});

fastify.get('/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  logger.info('fastify-api', 'Fetching user', { userId: id });

  return { id, name: 'John Doe' };
});

fastify.post('/users', async (request, reply) => {
  logger.info('fastify-api', 'Creating user', { body: request.body });

  reply.status(201);
  return { id: '123', ...(request.body as object) };
});

fastify.get('/error', async (request, reply) => {
  throw new Error('Simulated error');
});

// Health check (not logged)
fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  logger.error('fastify-api', 'Unhandled error', error);
  reply.status(500).send({ error: error.message });
});

// Start server
try {
  const PORT = process.env.PORT || 3000;
  await fastify.listen({ port: Number(PORT) });
  logger.info('fastify-api', `Server started on port ${PORT}`);
  console.log(`Fastify server listening on port ${PORT}`);
} catch (err) {
  logger.critical('fastify-api', 'Failed to start server', err as Error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await fastify.close();
  await logger.close();
  process.exit(0);
});
