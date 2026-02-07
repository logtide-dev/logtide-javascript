import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Server } from 'node:http';
import { createMockServer, waitForLogs } from 'logtide-mock-server/test-utils';
import { createApp } from '../src/app.js';
import type { LogTideClient } from '@logtide/sdk-node';

describe('Express + @logtide/sdk-node smoke test', () => {
  let mockServer: ReturnType<typeof createMockServer>;
  let mockUrl: string;
  let appServer: Server;
  let appPort: number;
  let client: LogTideClient;

  beforeAll(async () => {
    mockServer = createMockServer();
    const mock = await mockServer.start();
    mockUrl = mock.url;

    const { app, client: c } = createApp(mockUrl, 'test-api-key');
    client = c;

    await new Promise<void>((resolve) => {
      appServer = app.listen(0, '127.0.0.1', () => {
        const addr = appServer.address();
        appPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await client.close();
    await new Promise<void>((resolve, reject) => {
      appServer.close((err) => (err ? reject(err) : resolve()));
    });
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  it('should send request logs via middleware', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-log`);
    expect(res.status).toBe(200);

    const logs = await waitForLogs(mockUrl, 1);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const manualLog = logs.find((l) => l.message === 'manual log from express');
    expect(manualLog).toBeDefined();
    expect(manualLog!.service).toBe('test-express');
    expect(manualLog!.level).toBe('info');
  });

  it('should log request and response via middleware', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 2);

    // Should have a request log (GET /test-log)
    const requestLog = logs.find((l) => l.message?.includes('GET /test-log') && !l.message?.includes('200'));
    expect(requestLog).toBeDefined();

    // Should have a response log (GET /test-log 200)
    const responseLog = logs.find((l) => l.message?.includes('GET /test-log') && l.message?.includes('200'));
    expect(responseLog).toBeDefined();
  });

  it('should capture errors', async () => {
    const res = await fetch(`http://127.0.0.1:${appPort}/test-error`);
    expect(res.status).toBe(500);

    const logs = await waitForLogs(mockUrl, 1);
    const errorLog = logs.find((l) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog!.service).toBe('test-express');
  });

  it('should include metadata in manual logs', async () => {
    await fetch(`http://127.0.0.1:${appPort}/test-log`);

    const logs = await waitForLogs(mockUrl, 1);
    const log = logs.find((l) => l.message === 'manual log from express');
    expect(log).toBeDefined();
    expect(log!.metadata).toBeDefined();
    expect(log!.metadata!.route).toBe('/test-log');
  });
});
