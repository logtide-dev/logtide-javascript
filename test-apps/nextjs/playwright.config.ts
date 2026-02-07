import { defineConfig } from '@playwright/test';

const MOCK_SERVER_PORT = 9100;
const APP_PORT = 3100;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx next dev -p ${APP_PORT}`,
    port: APP_PORT,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      LOGTIDE_DSN: `http://lp_testkey@127.0.0.1:${MOCK_SERVER_PORT}/test-project`,
    },
  },
});
