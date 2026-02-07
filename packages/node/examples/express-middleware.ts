import express from 'express';
import { LogTideClient, logTideMiddleware } from '../src/index.js';

const app = express();

// Initialize LogTide client
const logger = new LogTideClient({
  apiUrl: 'http://localhost:8080',
  apiKey: 'lp_your_api_key_here',
  globalMetadata: {
    service: 'express-api',
    env: process.env.NODE_ENV || 'development',
  },
});

// Use LogTide middleware
app.use(
  logTideMiddleware({
    client: logger,
    serviceName: 'express-api',
    logRequests: true,
    logResponses: true,
    logErrors: true,
    includeHeaders: false, // Set to true to log headers
    includeBody: false, // Set to true to log request body
    skipHealthCheck: true, // Skip /health and /healthz
    skipPaths: ['/metrics'], // Additional paths to skip
  }),
);

// Parse JSON body
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  logger.info('express-api', 'Fetching user', { userId });

  // Simulate user fetch
  res.json({ id: userId, name: 'John Doe' });
});

app.post('/users', (req, res) => {
  logger.info('express-api', 'Creating user', { body: req.body });

  // Simulate user creation
  res.status(201).json({ id: '123', ...req.body });
});

app.get('/error', (req, res) => {
  throw new Error('Simulated error');
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('express-api', 'Unhandled error', err);
  res.status(500).json({ error: err.message });
});

// Health check (not logged due to skipHealthCheck)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info('express-api', `Server started on port ${PORT}`);
  console.log(`Express server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await logger.close();
  process.exit(0);
});
