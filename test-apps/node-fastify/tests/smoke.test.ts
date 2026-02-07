import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockServer, waitForLogs } from 'logtide-mock-server/test-utils';
import { createApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import type { LogTideClient } from '@logtide/sdk-node';

describe('Fastify + @logtide/sdk-node smoke test', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockUrl: string;
  let fastify: FastifyInstance;
  let appPort: number;
  let client: LogTideClient;

  beforeAll(async () => {
    mockServer = createMockServer();
    const mock = await mockServer.start();
    mockUrl = mock.url;

    const result = await createApp(mockUrl, 'test-api-key');
    fastify = result.fastify;
    client = result.client;

    const address = await fastify.listen({ port: 0, host: '127.0.0.1' });
    appPort = new URL(address).port as unknown as number;
  });

  afterAll(async () => {
    await client.close();
    await fastify.close();
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('should send request logs via plugin', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-log`);
    expect(res.status).toBe(200);

    const logs = await waitForLogs(mockUrl, 1);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const manualLog = logs.find((l) => l.message === 'manual log from fastify');
    expect(manualLog).toBeDefined();
    expect(manualLog!.service).toBe('test-fastify');
    expect(manualLog!.level).toBe('info');
  });

  it('should log request and response via plugin', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 2);

    // Should have a request log
    const requestLog = logs.find((l) => l.message?.includes('GET /test-log') && !l.message?.includes('200'));
    expect(requestLog).toBeDefined();

    // Should have a response log
    const responseLog = logs.find((l) => l.message?.includes('GET /test-log') && l.message?.includes('200'));
    expect(responseLog).toBeDefined();
  });

  it('should capture errors', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-error`);
    expect(res.status).toBe(500);

    const logs = await waitForLogs(mockUrl, 1);
    const errorLog = logs.find((l) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.service).toBe('test-fastify');
  });

  it('should include metadata in manual logs', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 1);
    const log = logs.find((l) => l.message === 'manual log from fastify');
    expect(log).toBeDefined();
    expect(log!.metadata).toBeDefined();
    expect(log!.metadata!.route).toBe('/test-log');
  });
});
