import { test, expect } from '@playwright/test';
import { createMockServer } from 'logtide-mock-server/test-utils';

const MOCK_SERVER_PORT = 9100;
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

test('API route sends logs to mock server', async ({ request }) => {
  const res = await request.get('/api/test-log');
  expect(res.status()).toBe(200);

  // Wait for logs to arrive at mock server
  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    expect(data.logs.length).toBeGreaterThanOrEqual(1);
    const log = data.logs.find((l: any) => l.message === 'manual log from nextjs');
    expect(log).toBeDefined();
    expect(log.service).toBe('test-nextjs');
    expect(log.level).toBe('info');
  }).toPass({ timeout: 10_000 });
});

test('API route log includes metadata', async ({ request }) => {
  const res = await request.get('/api/test-log');
  expect(res.status()).toBe(200);

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    const log = data.logs.find((l: any) => l.message === 'manual log from nextjs');
    expect(log).toBeDefined();
    expect(log.metadata.environment).toBe('test');
    expect(log.metadata.route).toBe('/api/test-log');
  }).toPass({ timeout: 10_000 });
});

test('clicking log link navigates and triggers log', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('log-link').click();
  await page.waitForURL('**/api/test-log');

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    expect(data.logs.some((l: any) => l.message === 'manual log from nextjs')).toBe(true);
  }).toPass({ timeout: 10_000 });
});

test('API route sends OTLP spans', async ({ request }) => {
  const res = await request.get('/api/test-log');
  expect(res.status()).toBe(200);

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const spansRes = await fetch(`${mockUrl}/test/spans`);
    const data = await spansRes.json();
    expect(data.spans.length).toBeGreaterThanOrEqual(1);
    const span = data.spans.find((s: any) => s.serviceName === 'test-nextjs');
    expect(span).toBeDefined();
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.status.code).toBe(1); // OK
  }).toPass({ timeout: 10_000 });
});
