import { test, expect } from '@playwright/test';
import { createMockServer } from 'logtide-mock-server/test-utils';

const MOCK_SERVER_PORT = 9101;
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

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    expect(data.logs.length).toBeGreaterThanOrEqual(1);
    const log = data.logs.find((l: any) => l.message === 'manual log from sveltekit');
    expect(log).toBeDefined();
    expect(log.service).toBe('test-sveltekit');
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
    const log = data.logs.find((l: any) => l.message === 'manual log from sveltekit');
    expect(log).toBeDefined();
    expect(log.metadata.environment).toBe('test');
    expect(log.metadata.route).toBe('/api/test-log');
  }).toPass({ timeout: 10_000 });
});

test('clicking log link triggers log', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('log-link').click();

  const mockUrl = `http://127.0.0.1:${MOCK_SERVER_PORT}`;
  await expect(async () => {
    const logsRes = await fetch(`${mockUrl}/test/logs`);
    const data = await logsRes.json();
    expect(data.logs.some((l: any) => l.message === 'manual log from sveltekit')).toBe(true);
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
    const span = data.spans.find((s: any) => s.serviceName === 'test-sveltekit');
    expect(span).toBeDefined();
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.status.code).toBe(1); // OK
  }).toPass({ timeout: 10_000 });
});

test('response includes traceparent header', async ({ request }) => {
  const res = await request.get('/api/test-log');
  const traceparent = res.headers()['traceparent'];
  expect(traceparent).toBeDefined();
  expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
});
