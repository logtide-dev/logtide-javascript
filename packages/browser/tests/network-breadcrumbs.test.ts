import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkBreadcrumbIntegration } from '../src/integrations/network-breadcrumbs';
import type { Client } from '@logtide/types';

function createMockClient(): Client {
  return {
    captureError: vi.fn(),
    captureLog: vi.fn(),
    addBreadcrumb: vi.fn(),
  };
}

describe('NetworkBreadcrumbIntegration', () => {
  let integration: NetworkBreadcrumbIntegration;
  let client: Client;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = createMockClient();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    integration?.teardown();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has the correct name', () => {
    integration = new NetworkBreadcrumbIntegration();
    expect(integration.name).toBe('network-breadcrumbs');
  });

  // ─── Fetch patching ──────────────────────────────────

  describe('fetch', () => {
    it('records a breadcrumb for successful fetch', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      await fetch('/api/users');

      expect(client.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'http',
          category: 'fetch',
          level: 'info',
          message: expect.stringContaining('GET /api/users → 200'),
          data: expect.objectContaining({
            method: 'GET',
            url: '/api/users',
            status: 200,
          }),
        }),
      );
    });

    it('records method from init', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('', { status: 201 }),
      );

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      await fetch('/api/users', { method: 'POST' });

      const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.method).toBe('POST');
      expect(call.data.status).toBe(201);
    });

    it('records error level for 4xx/5xx', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('', { status: 500 }),
      );

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      await fetch('/api/broken');

      expect(client.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          data: expect.objectContaining({ status: 500 }),
        }),
      );
    });

    it('records error level for network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      await expect(fetch('/api/down')).rejects.toThrow('Failed to fetch');

      expect(client.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          data: expect.objectContaining({ status: 0 }),
        }),
      );
    });

    it('strips query params by default', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      await fetch('/api/users?token=secret&page=1');

      const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.url).toBe('/api/users');
    });

    it('preserves query params when configured', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      integration = new NetworkBreadcrumbIntegration({ captureQueryParams: true });
      integration.setup(client);

      await fetch('/api/users?page=1');

      const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.url).toBe('/api/users?page=1');
    });

    it('skips requests to Logtide API URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      integration = new NetworkBreadcrumbIntegration({
        apiUrl: 'https://api.logtide.dev',
      });
      integration.setup(client);

      await fetch('https://api.logtide.dev/api/v1/ingest', { method: 'POST' });

      expect(client.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('skips requests matching denyUrls regexp', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      integration = new NetworkBreadcrumbIntegration({
        denyUrls: [/analytics\.example\.com/],
      });
      integration.setup(client);

      await fetch('https://analytics.example.com/track');

      expect(client.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('records duration', async () => {
      vi.useFakeTimers();

      globalThis.fetch = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(new Response('ok', { status: 200 })), 50);
        });
      });

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      const promise = fetch('/api/slow');
      vi.advanceTimersByTime(50);
      await promise;

      const call = (client.addBreadcrumb as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.duration).toBeGreaterThanOrEqual(0);

      vi.useRealTimers();
    });

    it('restores original fetch on teardown', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
      globalThis.fetch = mockFetch;

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      // fetch is now patched
      expect(globalThis.fetch).not.toBe(mockFetch);

      integration.teardown();

      // fetch is restored
      expect(globalThis.fetch).toBe(mockFetch);
    });
  });

  // ─── XHR patching ────────────────────────────────────

  describe('xhr', () => {
    it('records a breadcrumb for XHR request', async () => {
      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/data');

      // Mock response
      Object.defineProperty(xhr, 'status', { value: 200, writable: true });
      xhr.send();

      // Trigger loadend
      xhr.dispatchEvent(new Event('loadend'));

      expect(client.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'http',
          category: 'xhr',
          data: expect.objectContaining({
            method: 'GET',
            url: '/api/data',
            status: 200,
          }),
        }),
      );
    });

    it('skips XHR requests to denied URLs', () => {
      integration = new NetworkBreadcrumbIntegration({
        apiUrl: 'https://api.logtide.dev',
      });
      integration.setup(client);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.logtide.dev/api/v1/ingest');
      xhr.send();
      xhr.dispatchEvent(new Event('loadend'));

      expect(client.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('restores original XHR methods on teardown', () => {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;

      integration = new NetworkBreadcrumbIntegration();
      integration.setup(client);

      expect(XMLHttpRequest.prototype.open).not.toBe(origOpen);
      expect(XMLHttpRequest.prototype.send).not.toBe(origSend);

      integration.teardown();

      expect(XMLHttpRequest.prototype.open).toBe(origOpen);
      expect(XMLHttpRequest.prototype.send).toBe(origSend);
    });
  });
});
