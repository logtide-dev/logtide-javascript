import type { Integration, Client } from '@logtide/types';
import type { NetworkBreadcrumbOptions } from '../types';

/**
 * Captures fetch and XMLHttpRequest calls as HTTP breadcrumbs.
 *
 * - Records method, URL (query params stripped by default), status, duration
 * - Never captures request/response bodies
 * - Automatically skips requests to the Logtide API
 */
export class NetworkBreadcrumbIntegration implements Integration {
  name = 'network-breadcrumbs';

  private client: Client | null = null;
  private captureQueryParams: boolean;
  private denyUrls: (string | RegExp)[];
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;

  constructor(
    options?: NetworkBreadcrumbOptions & { apiUrl?: string },
  ) {
    this.captureQueryParams = options?.captureQueryParams ?? false;
    this.denyUrls = options?.denyUrls ?? [];
    if (options?.apiUrl) {
      this.denyUrls.push(options.apiUrl);
    }
  }

  setup(client: Client): void {
    if (typeof globalThis === 'undefined') return;

    this.client = client;
    this.patchFetch();
    this.patchXhr();
  }

  teardown(): void {
    if (this.originalFetch && typeof globalThis.fetch !== 'undefined') {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      if (this.originalXhrOpen) {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        this.originalXhrOpen = null;
      }
      if (this.originalXhrSend) {
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.originalXhrSend = null;
      }
    }
    this.client = null;
  }

  // ─── Fetch ──────────────────────────────────────────────

  private patchFetch(): void {
    if (typeof globalThis.fetch !== 'function') return;

    this.originalFetch = globalThis.fetch;
    const self = this;

    globalThis.fetch = function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const method = init?.method?.toUpperCase() ?? 'GET';
      const url = self.extractUrl(input);

      if (self.isDenied(url)) {
        return self.originalFetch!.call(globalThis, input, init);
      }

      const displayUrl = self.sanitizeUrl(url);
      const startTime = Date.now();

      return self.originalFetch!.call(globalThis, input, init).then(
        (response) => {
          const duration = Date.now() - startTime;
          self.recordBreadcrumb(
            'fetch',
            method,
            displayUrl,
            response.status,
            duration,
          );
          return response;
        },
        (error) => {
          const duration = Date.now() - startTime;
          self.recordBreadcrumb('fetch', method, displayUrl, 0, duration);
          throw error;
        },
      );
    };
  }

  // ─── XHR ────────────────────────────────────────────────

  private patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      (this as any).__lt_method = method.toUpperCase();
      (this as any).__lt_url = typeof url === 'string' ? url : url.toString();
      return self.originalXhrOpen!.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function patchedSend(
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const method: string = (this as any).__lt_method ?? 'GET';
      const rawUrl: string = (this as any).__lt_url ?? '';

      if (!rawUrl || self.isDenied(rawUrl)) {
        return self.originalXhrSend!.call(this, body);
      }

      const displayUrl = self.sanitizeUrl(rawUrl);
      const startTime = Date.now();

      this.addEventListener('loadend', function onLoadEnd() {
        const duration = Date.now() - startTime;
        self.recordBreadcrumb(
          'xhr',
          method,
          displayUrl,
          this.status,
          duration,
        );
        this.removeEventListener('loadend', onLoadEnd);
      });

      return self.originalXhrSend!.call(this, body);
    };
  }

  // ─── Helpers ────────────────────────────────────────────

  private recordBreadcrumb(
    category: 'fetch' | 'xhr',
    method: string,
    url: string,
    status: number,
    duration: number,
  ): void {
    const isError = status === 0 || status >= 400;
    this.client?.addBreadcrumb({
      type: 'http',
      category,
      message: `${method} ${url} → ${status || 'ERR'} (${duration}ms)`,
      level: isError ? 'error' : 'info',
      timestamp: Date.now(),
      data: { method, url, status, duration },
    });
  }

  private extractUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    return String(input);
  }

  private sanitizeUrl(url: string): string {
    if (this.captureQueryParams) return url;
    try {
      // Handle relative URLs
      const parsed = new URL(url, 'http://localhost');
      return url.startsWith('http')
        ? `${parsed.origin}${parsed.pathname}`
        : parsed.pathname;
    } catch {
      return url;
    }
  }

  private isDenied(url: string): boolean {
    for (const pattern of this.denyUrls) {
      if (typeof pattern === 'string') {
        if (url.startsWith(pattern)) return true;
      } else if (pattern.test(url)) {
        return true;
      }
    }
    return false;
  }
}
