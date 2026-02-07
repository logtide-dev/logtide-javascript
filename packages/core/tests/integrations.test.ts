import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleIntegration } from '../src/integrations/console';
import { GlobalErrorIntegration } from '../src/integrations/global-error';
import type { Client, Breadcrumb } from '@logtide/types';

function mockClient(): Client & {
  errors: unknown[];
  logs: Array<{ level: string; message: string }>;
  breadcrumbs: Breadcrumb[];
} {
  return {
    errors: [],
    logs: [],
    breadcrumbs: [],
    captureError(error: unknown, metadata?: Record<string, unknown>) {
      this.errors.push({ error, metadata });
    },
    captureLog(level: string, message: string, metadata?: Record<string, unknown>) {
      this.logs.push({ level, message });
    },
    addBreadcrumb(breadcrumb: Breadcrumb) {
      this.breadcrumbs.push(breadcrumb);
    },
  };
}

describe('ConsoleIntegration', () => {
  let integration: ConsoleIntegration;
  let client: ReturnType<typeof mockClient>;
  let origLog: typeof console.log;
  let origWarn: typeof console.warn;
  let origError: typeof console.error;

  beforeEach(() => {
    origLog = console.log;
    origWarn = console.warn;
    origError = console.error;
    integration = new ConsoleIntegration();
    client = mockClient();
  });

  afterEach(() => {
    integration.teardown();
    // Ensure console is restored even if teardown fails
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  });

  it('should have the correct name', () => {
    expect(integration.name).toBe('console');
  });

  it('should intercept console.log and add breadcrumb', () => {
    integration.setup(client);
    console.log('test message');

    expect(client.breadcrumbs).toHaveLength(1);
    expect(client.breadcrumbs[0].type).toBe('console');
    expect(client.breadcrumbs[0].category).toBe('console.log');
    expect(client.breadcrumbs[0].message).toBe('test message');
  });

  it('should intercept console.warn', () => {
    integration.setup(client);
    console.warn('warning!');

    expect(client.breadcrumbs).toHaveLength(1);
    expect(client.breadcrumbs[0].category).toBe('console.warn');
    expect(client.breadcrumbs[0].level).toBe('warn');
  });

  it('should intercept console.error', () => {
    integration.setup(client);
    console.error('bad thing');

    expect(client.breadcrumbs).toHaveLength(1);
    expect(client.breadcrumbs[0].category).toBe('console.error');
    expect(client.breadcrumbs[0].level).toBe('error');
  });

  it('should ignore [LogTide] prefixed messages', () => {
    integration.setup(client);
    console.log('[LogTide] internal message');

    expect(client.breadcrumbs).toHaveLength(0);
  });

  it('should restore original console on teardown', () => {
    const beforeSetup = console.log;
    integration.setup(client);
    // console.log should now be different (intercepted)
    expect(console.log).not.toBe(beforeSetup);

    integration.teardown();
    // After teardown, console.log should be restored to what it was before setup
    // (which may be vitest's wrapper, not the raw function — so we just check it's no longer our interceptor)
    console.log('after teardown');
    // If teardown works, this should NOT add a breadcrumb
    expect(client.breadcrumbs.filter(b => b.message === 'after teardown')).toHaveLength(0);
  });
});

describe('GlobalErrorIntegration', () => {
  it('should have the correct name', () => {
    const integration = new GlobalErrorIntegration();
    expect(integration.name).toBe('global-error');
  });

  it('should setup without throwing', () => {
    const integration = new GlobalErrorIntegration();
    const client = mockClient();
    expect(() => integration.setup(client)).not.toThrow();
    integration.teardown();
  });

  it('should teardown without throwing', () => {
    const integration = new GlobalErrorIntegration();
    expect(() => integration.teardown()).not.toThrow();
  });
});
