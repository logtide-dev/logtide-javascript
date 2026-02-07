import { LogTideClient } from '../src/index.js';

const client = new LogTideClient({
  apiUrl: 'http://localhost:8080',
  apiKey: 'your-api-key-here',
  batchSize: 50,
  flushInterval: 3000,
});

// Example usage
client.info('api-gateway', 'Server started', {
  port: 3000,
  env: 'development',
});

client.error('database', 'Connection timeout', {
  host: 'localhost',
  port: 5432,
  timeout_ms: 5000,
});

// Flush and close on exit
process.on('SIGINT', async () => {
  console.log('Flushing logs...');
  await client.close();
  process.exit(0);
});
