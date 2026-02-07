import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogTideClient, serializeError, StructuredException } from '../src/index.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('LogTideClient', () => {
  let client: LogTideClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    client = new LogTideClient({
      apiUrl: 'http://localhost:8080',
      apiKey: 'test-api-key',
      batchSize: 5,
      flushInterval: 1000,
      maxBufferSize: 10,
      maxRetries: 2,
      retryDelayMs: 100,
    });
  });

  afterEach(async () => {
    await client.close();
    vi.useRealTimers();
  });

  describe('Logging Methods', () => {
    it('should log messages with correct levels', () => {
      client.debug('test-service', 'Debug message');
      client.info('test-service', 'Info message');
      client.warn('test-service', 'Warn message');
      client.error('test-service', 'Error message');
      client.critical('test-service', 'Critical message');

      const metrics = client.getMetrics();
      expect(metrics.logsSent).toBe(0); // Not flushed yet
    });

    it('should add metadata to logs', () => {
      client.info('test-service', 'Test message', { userId: 123 });

      // Flush manually to check
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      client.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"userId":123'),
        }),
      );
    });

    it('should serialize errors in error/critical logs', () => {
      const error = new Error('Test error');

      client.error('test-service', 'Error occurred', error);

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      client.flush();

      // Should use new StructuredException format with "exception" key and "type" field
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"exception"'),
        }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"type":"Error"'),
        }),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"language":"nodejs"'),
        }),
      );
    });
  });

  describe('Batching & Flushing', () => {
    it('should auto-flush when batch size is reached', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      // Add 5 logs (batch size)
      for (let i = 0; i < 5; i++) {
        client.info('test-service', `Message ${i}`);
      }

      // The flush is triggered synchronously when batch size is reached,
      // but fetch is async, so we need to wait for the promise to resolve
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('should auto-flush on interval', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      client.info('test-service', 'Test message');

      // Advance timer by flush interval
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should not flush empty buffer', async () => {
      const mockFetch = vi.mocked(fetch);

      await client.flush();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Max Buffer Size', () => {
    it('should drop logs when buffer is full', async () => {
      // Create client with batchSize > maxBufferSize to prevent auto-flush
      const bufferClient = new LogTideClient({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test-api-key',
        batchSize: 100, // High batch size to prevent auto-flush
        maxBufferSize: 10,
        flushInterval: 60000, // Long interval to prevent timer flush
      });

      // Fill buffer beyond max (10 logs)
      for (let i = 0; i < 15; i++) {
        bufferClient.info('test-service', `Message ${i}`);
      }

      const metrics = bufferClient.getMetrics();
      expect(metrics.logsDropped).toBe(5); // 15 - 10 = 5 dropped

      await bufferClient.close();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      const mockFetch = vi.mocked(fetch);

      // Fail twice, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response);

      client.info('test-service', 'Test message');

      const flushPromise = client.flush();

      // Wait for retries with exponential backoff
      await vi.advanceTimersByTimeAsync(100); // First retry after 100ms
      await vi.advanceTimersByTimeAsync(200); // Second retry after 200ms

      await flushPromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);

      const metrics = client.getMetrics();
      expect(metrics.retries).toBe(2);
      expect(metrics.logsSent).toBe(1);
    });

    it('should fail after max retries', async () => {
      const mockFetch = vi.mocked(fetch);

      // Always fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Create a dedicated client for this test with long flush interval
      const retryClient = new LogTideClient({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test-api-key',
        batchSize: 5,
        flushInterval: 60000, // Long interval to prevent interference
        maxRetries: 2,
        retryDelayMs: 100,
      });

      retryClient.info('test-service', 'Test message');

      const flushPromise = retryClient.flush();

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry

      await flushPromise;

      expect(mockFetch).toHaveBeenCalledTimes(3); // maxRetries = 2, so 3 total attempts

      const metrics = retryClient.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
      expect(metrics.logsSent).toBe(0);

      // Clean up without waiting for flush (buffer was already processed)
      vi.useRealTimers();
      await retryClient.close();
      vi.useFakeTimers();
    });
  });

  describe('Context Helpers', () => {
    it('should set and get trace ID', () => {
      client.setTraceId('trace-123');

      expect(client.getTraceId()).toBe('trace-123');
    });

    it('should use trace ID in logs', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      client.setTraceId('trace-456');
      client.info('test-service', 'Test message');

      await client.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"trace_id":"trace-456"'),
        }),
      );
    });

    it('should execute function with trace ID context', () => {
      client.withTraceId('temp-trace', () => {
        expect(client.getTraceId()).toBe('temp-trace');
      });

      expect(client.getTraceId()).toBeNull();
    });

    it('should auto-generate trace ID when enabled', () => {
      const autoClient = new LogTideClient({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test-api-key',
        autoTraceId: true,
      });

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      autoClient.info('test-service', 'Test message');
      autoClient.flush();

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs?.body as string);

      expect(body.logs[0].trace_id).toBeDefined();
      expect(body.logs[0].trace_id).toMatch(/^[0-9a-f-]{36}$/);

      autoClient.close();
    });
  });

  describe('Global Metadata', () => {
    it('should add global metadata to all logs', async () => {
      const clientWithGlobalMetadata = new LogTideClient({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test-api-key',
        globalMetadata: {
          env: 'test',
          version: '1.0.0',
        },
      });

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      clientWithGlobalMetadata.info('test-service', 'Test message', { custom: 'data' });
      await clientWithGlobalMetadata.flush();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"env":"test"'),
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"version":"1.0.0"'),
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"custom":"data"'),
        }),
      );

      await clientWithGlobalMetadata.close();
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      client.info('test-service', 'Message 1');
      client.info('test-service', 'Message 2');
      await client.flush();

      const metrics = client.getMetrics();

      expect(metrics.logsSent).toBe(2);
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      client.info('test-service', 'Test message');
      await client.flush();

      client.resetMetrics();

      const metrics = client.getMetrics();
      expect(metrics.logsSent).toBe(0);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize Error objects to StructuredException format', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      const serialized = serializeError(error);

      expect(serialized).toEqual({
        type: 'Error',
        message: 'Test error',
        language: 'nodejs',
        stacktrace: [
          { file: 'test.js', line: 1, column: 1 },
        ],
        raw: 'Error: Test error\n    at test.js:1:1',
      });
    });

    it('should serialize Error with cause', () => {
      const cause = new Error('Cause error');
      cause.stack = 'Error: Cause error\n    at cause.js:10:5';
      const error = new Error('Main error', { cause });
      error.stack = 'Error: Main error\n    at main.js:20:10';

      const serialized = serializeError(error);

      expect(serialized).toHaveProperty('cause');
      expect(serialized.cause).toEqual({
        type: 'Error',
        message: 'Cause error',
        language: 'nodejs',
        stacktrace: [
          { file: 'cause.js', line: 10, column: 5 },
        ],
        raw: 'Error: Cause error\n    at cause.js:10:5',
      });
    });

    it('should serialize string errors', () => {
      const serialized = serializeError('String error');

      expect(serialized).toEqual({
        type: 'Error',
        message: 'String error',
        language: 'nodejs',
      });
    });

    it('should serialize unknown types', () => {
      const serialized = serializeError(42);

      expect(serialized).toEqual({
        type: 'Error',
        message: '42',
        language: 'nodejs',
      });
    });

    it('should parse function name from stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at handleRequest (/app/src/api.ts:42:15)\n    at processRequest (/app/src/server.ts:128:10)';

      const serialized = serializeError(error);

      expect(serialized.stacktrace).toEqual([
        { function: 'handleRequest', file: '/app/src/api.ts', line: 42, column: 15 },
        { function: 'processRequest', file: '/app/src/server.ts', line: 128, column: 10 },
      ]);
    });

    it('should include Node.js error properties in metadata', () => {
      const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = '/missing/file.txt';
      error.stack = 'Error: ENOENT\n    at fs.js:1:1';

      const serialized = serializeError(error);

      expect(serialized.metadata).toEqual({
        code: 'ENOENT',
        errno: -2,
        syscall: 'open',
        path: '/missing/file.txt',
      });
    });
  });
});

// Separate describe for Circuit Breaker tests - uses real timers to avoid issues with rejected promises
describe('LogTideClient Circuit Breaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should open circuit after threshold failures', { timeout: 20000 }, async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValue(new Error('Network error'));

    const circuitBreakerClient = new LogTideClient({
      apiUrl: 'http://localhost:8080',
      apiKey: 'test-api-key',
      maxRetries: 0,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 1000,
      flushInterval: 300000, // Very long interval to prevent interference
    });

    // Fail twice to open circuit
    circuitBreakerClient.info('test-service', 'Message 1');
    await circuitBreakerClient.flush();

    circuitBreakerClient.info('test-service', 'Message 2');
    await circuitBreakerClient.flush();

    expect(circuitBreakerClient.getCircuitBreakerState()).toBe('OPEN');

    // Next flush should be skipped (circuit is open)
    circuitBreakerClient.info('test-service', 'Message 3');
    await circuitBreakerClient.flush(); // This returns immediately when circuit is open

    const metrics = circuitBreakerClient.getMetrics();
    expect(metrics.circuitBreakerTrips).toBeGreaterThan(0);

    // Cleanup: clear the timer manually
    // @ts-expect-error accessing private property for cleanup
    if (circuitBreakerClient.timer) clearInterval(circuitBreakerClient.timer);
  });
});
