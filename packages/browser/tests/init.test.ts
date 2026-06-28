import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Integration } from '@logtide/types';
import { hub } from '@logtide/core';
import { initLogtide } from '../src/init';

const DSN = 'https://lp_key@api.logtide.dev/proj';

describe('initLogtide', () => {
  beforeEach(async () => {
    await hub.close();
  });

  afterEach(async () => {
    await hub.close();
  });

  it('initializes the hub client with the given service', () => {
    initLogtide({ dsn: DSN, service: 'react-frontend' });

    const client = hub.getClient();
    expect(client).not.toBeNull();
    expect(client?.service).toBe('react-frontend');
  });

  it('sets a session id on the global scope', () => {
    initLogtide({ dsn: DSN, service: 'react-frontend' });

    expect(hub.getScope().sessionId).toBeDefined();
  });

  it('installs user-provided integrations', () => {
    const setup = vi.fn();
    const custom: Integration = { name: 'custom-test', setup };

    initLogtide({ dsn: DSN, service: 'react-frontend', integrations: [custom] });

    expect(setup).toHaveBeenCalledOnce();
  });

  it('applies a default service when none is provided in options', () => {
    initLogtide({ dsn: DSN }, { defaultService: 'nextjs' });

    expect(hub.getClient()?.service).toBe('nextjs');
  });

  it('prefers the explicit service over the default', () => {
    initLogtide({ dsn: DSN, service: 'my-app' }, { defaultService: 'nextjs' });

    expect(hub.getClient()?.service).toBe('my-app');
  });
});
