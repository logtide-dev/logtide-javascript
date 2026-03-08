import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebVitalsIntegration } from '../src/integrations/web-vitals';
import type { Client } from '@logtide/types';

function createMockClient(): Client {
  return {
    captureError: vi.fn(),
    captureLog: vi.fn(),
    addBreadcrumb: vi.fn(),
  };
}

// Store callbacks from web-vitals mock
const callbacks: Record<string, (metric: any) => void> = {};

vi.mock('web-vitals', () => ({
  onLCP: (cb: any) => { callbacks['LCP'] = cb; },
  onINP: (cb: any) => { callbacks['INP'] = cb; },
  onCLS: (cb: any) => { callbacks['CLS'] = cb; },
}));

describe('WebVitalsIntegration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(callbacks)) delete callbacks[key];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has the correct name', () => {
    const integration = new WebVitalsIntegration();
    expect(integration.name).toBe('web-vitals');
  });

  it('calls captureLog when web-vitals metrics fire', async () => {
    const client = createMockClient();
    const integration = new WebVitalsIntegration();
    integration.setup(client);

    // Wait for dynamic import to resolve
    await new Promise((r) => setTimeout(r, 10));

    // Simulate LCP metric
    callbacks['LCP']?.({ value: 1200, rating: 'needs-improvement', id: 'v4-1' });
    expect(client.captureLog).toHaveBeenCalledWith(
      'info',
      'Web Vital: LCP = 1200',
      expect.objectContaining({
        'performance.metric': 'LCP',
        'performance.value': 1200,
        'performance.rating': 'needs-improvement',
        'performance.id': 'v4-1',
      }),
    );

    // Simulate INP metric
    callbacks['INP']?.({ value: 50, rating: 'good', id: 'v4-2' });
    expect(client.captureLog).toHaveBeenCalledWith(
      'info',
      'Web Vital: INP = 50',
      expect.objectContaining({
        'performance.metric': 'INP',
        'performance.value': 50,
        'performance.rating': 'good',
      }),
    );

    // Simulate CLS metric
    callbacks['CLS']?.({ value: 0.05, rating: 'good', id: 'v4-3' });
    expect(client.captureLog).toHaveBeenCalledWith(
      'info',
      'Web Vital: CLS = 0.05',
      expect.objectContaining({
        'performance.metric': 'CLS',
        'performance.value': 0.05,
      }),
    );
  });

  it('skips when sampled out (sampleRate = 0)', async () => {
    const client = createMockClient();
    vi.stubGlobal('window', {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const integration = new WebVitalsIntegration({ sampleRate: 0 });
    integration.setup(client);

    await new Promise((r) => setTimeout(r, 10));

    // web-vitals callbacks should not have been registered
    expect(callbacks['LCP']).toBeUndefined();
    expect(callbacks['INP']).toBeUndefined();
    expect(callbacks['CLS']).toBeUndefined();
  });

  it('skips in non-browser environment (no window)', async () => {
    const client = createMockClient();
    // Temporarily remove window to simulate non-browser
    vi.stubGlobal('window', undefined);

    const integration = new WebVitalsIntegration();
    integration.setup(client);

    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks['LCP']).toBeUndefined();
  });

  it('defaults sampleRate to 1.0', async () => {
    const client = createMockClient();

    const integration = new WebVitalsIntegration();
    integration.setup(client);

    await new Promise((r) => setTimeout(r, 10));

    // All callbacks should be registered
    expect(callbacks['LCP']).toBeDefined();
    expect(callbacks['INP']).toBeDefined();
    expect(callbacks['CLS']).toBeDefined();
  });
});
