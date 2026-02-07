import { LogTideClient } from '../src/index.js';

// Initialize client with advanced options
const client = new LogTideClient({
  apiUrl: 'http://localhost:8080',
  apiKey: 'lp_your_api_key_here',

  // Batching configuration
  batchSize: 100,
  flushInterval: 5000,

  // Buffer management
  maxBufferSize: 10000,

  // Retry configuration
  maxRetries: 3,
  retryDelayMs: 1000, // Exponential backoff: 1s, 2s, 4s

  // Circuit breaker
  circuitBreakerThreshold: 5, // Open after 5 consecutive failures
  circuitBreakerResetMs: 30000, // Try again after 30s

  // Metrics & debugging
  enableMetrics: true,
  debug: true,

  // Global metadata added to all logs
  globalMetadata: {
    env: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    hostname: process.env.HOSTNAME,
  },

  // Auto-generate trace IDs
  autoTraceId: false, // Set to true to auto-generate for each log
});

// ==================== Basic Logging ====================

client.info('api-gateway', 'Server started', {
  port: 3000,
  env: 'production',
});

client.error('database', 'Connection failed', new Error('Timeout after 5s'));

// ==================== Trace ID Context ====================

// Manual trace ID
client.setTraceId('request-123');
client.info('api', 'Processing request');
client.info('database', 'Querying users');
client.info('api', 'Request completed');
client.setTraceId(null); // Clear context

// Execute with trace ID
client.withTraceId('request-456', () => {
  client.info('api', 'Inside trace context');
  client.warn('cache', 'Cache miss');
});

// Auto-generate new trace ID
client.withNewTraceId(() => {
  client.info('worker', 'Background job started');
  client.info('worker', 'Job completed');
});

// ==================== Query Logs ====================

async function queryLogs() {
  try {
    // Basic query
    const result = await client.query({
      service: 'api-gateway',
      level: 'error',
      from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      to: new Date(),
      limit: 100,
    });

    console.log(`Found ${result.total} logs`);
    console.log('First log:', result.logs[0]);

    // Full-text search
    const searchResult = await client.query({
      q: 'timeout',
      limit: 50,
    });

    console.log(`Search found ${searchResult.total} logs containing "timeout"`);

    // Get logs by trace ID
    const traceLogs = await client.getByTraceId('request-123');
    console.log(`Trace has ${traceLogs.length} logs`);

    // Get aggregated statistics
    const stats = await client.getAggregatedStats({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      to: new Date(),
      interval: '1h',
      service: 'api-gateway',
    });

    console.log('Timeseries:', stats.timeseries.slice(0, 5));
    console.log('Top services:', stats.top_services);
    console.log('Top errors:', stats.top_errors);
  } catch (error) {
    console.error('Query failed:', error);
  }
}

// ==================== Live Tail (Streaming) ====================

function startLiveTail() {
  const cleanup = client.stream({
    service: 'api-gateway',
    level: 'error',
    onLog: (log) => {
      console.log(`[LIVE] ${log.time} - ${log.level.toUpperCase()} - ${log.message}`);
    },
    onError: (error) => {
      console.error('Stream error:', error);
    },
  });

  // Stop streaming after 60 seconds
  setTimeout(() => {
    cleanup();
    console.log('Live tail stopped');
  }, 60000);
}

// ==================== Metrics ====================

function checkMetrics() {
  const metrics = client.getMetrics();

  console.log('Client Metrics:');
  console.log(`- Logs sent: ${metrics.logsSent}`);
  console.log(`- Logs dropped: ${metrics.logsDropped}`);
  console.log(`- Errors: ${metrics.errors}`);
  console.log(`- Retries: ${metrics.retries}`);
  console.log(`- Avg latency: ${metrics.avgLatencyMs.toFixed(2)}ms`);
  console.log(`- Circuit breaker trips: ${metrics.circuitBreakerTrips}`);
  console.log(`- Circuit breaker state: ${client.getCircuitBreakerState()}`);
}

// Log metrics every 30 seconds
setInterval(checkMetrics, 30000);

// ==================== Graceful Shutdown ====================

async function gracefulShutdown() {
  console.log('Shutting down...');

  // Check final metrics
  checkMetrics();

  // Flush and close client
  await client.close();

  console.log('Client closed successfully');
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ==================== Run Examples ====================

async function main() {
  console.log('LogTide SDK - Advanced Examples');
  console.log('=================================\n');

  // Send some test logs
  for (let i = 0; i < 10; i++) {
    client.info('example', `Test log ${i}`, { iteration: i });
  }

  // Query logs (uncomment to test)
  // await queryLogs();

  // Start live tail (uncomment to test)
  // startLiveTail();

  // Check metrics after 10 seconds
  setTimeout(checkMetrics, 10000);
}

main().catch(console.error);
