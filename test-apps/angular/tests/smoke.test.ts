import { test, expect } from '@playwright/test';
import { createMockServer } from 'logtide-mock-server/test-utils';

const MOCK_SERVER_PORT = 9103;
let mockServer: ReturnType<typeof createMockServer>;

test.beforeAll(async () => {
  mockServer = createMockServer();
  await mockServer.start(MOCK_SERVER_PORT);
});

test.afterAll(async () => {
  await mockServer.stop();
});

test.beforeEach(async () => {
  mockServer.reset();
});

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status')).toHaveText('Ready');
});

test('manual log is sent to mock server', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('log-button').click();

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    expect(data.logs.length).toBeGreaterThanOrEqual(1);
    const log = data.logs.find((l: any) => l.message === 'manual log from angular');
    expect(log).toBeDefined();
    expect(log.service).toBe('test-angular');
    expect(log.level).toBe('info');
  }).toPass({ timeout: 10_000 });
});

test('manual log includes metadata', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('log-button').click();

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    const log = data.logs.find((l: any) => l.message === 'manual log from angular');
    expect(log).toBeDefined();
    expect(log.metadata.environment).toBe('test');
    expect(log.metadata.route).toBe('/test-log');
  }).toPass({ timeout: 10_000 });
});

test('error handler captures errors', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('error-button').click();

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    const errorLog = data.logs.find((l: any) => l.level === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog.service).toBe('test-angular');
  }).toPass({ timeout: 10_000 });
});

test('http interceptor sends spans', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('http-button').click();

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const spansRes = await fetch(`${mockUrl}/test/spans`);
    const data = await spansRes.json();
    expect(data.spans.length).toBeGreaterThanOrEqual(1);
    const span = data.spans.find((s: any) => s.serviceName === 'test-angular');
    expect(span).toBeDefined();
    expect(span.name).toContain('HTTP GET');
  }).toPass({ timeout: 10_000 });
});
