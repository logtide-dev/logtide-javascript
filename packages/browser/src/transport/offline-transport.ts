import type { InternalLogEntry, Span, Transport } from '@logtide/types';

export interface OfflineTransportOptions {
  /** The inner transport to delegate to when online */
  inner: Transport;
  /** Max buffered items when offline (default: 1000) */
  maxBufferSize?: number;
  /** Ingestion URL for sendBeacon on page unload (e.g. "https://api.logtide.dev/api/v1/ingest") */
  beaconUrl?: string;
  /** API key for sendBeacon auth header workaround */
  apiKey?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Transport wrapper that buffers logs/spans during connectivity loss
 * and uses sendBeacon on page unload for reliable delivery.
 *
 * - Listens to `navigator.onLine` and `online`/`offline` events
 * - When offline: buffers items in memory (bounded)
 * - When back online: flushes buffered items to inner transport
 * - On `pagehide`/`visibilitychange`: uses `sendBeacon` for a final flush
 */
export class OfflineTransport implements Transport {
  private inner: Transport;
  private logBuffer: InternalLogEntry[] = [];
  private spanBuffer: Span[] = [];
  private maxBufferSize: number;
  private beaconUrl: string | undefined;
  private apiKey: string | undefined;
  private debug: boolean;
  private isOnline: boolean;
  private boundOnline: () => void;
  private boundOffline: () => void;
  private boundPageHide: () => void;

  constructor(options: OfflineTransportOptions) {
    this.inner = options.inner;
    this.maxBufferSize = options.maxBufferSize ?? 1000;
    this.beaconUrl = options.beaconUrl;
    this.apiKey = options.apiKey;
    this.debug = options.debug ?? false;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    this.boundOnline = this.handleOnline.bind(this);
    this.boundOffline = this.handleOffline.bind(this);
    this.boundPageHide = this.handlePageHide.bind(this);

    if (typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', this.boundOnline);
      globalThis.addEventListener('offline', this.boundOffline);
      // pagehide is more reliable than beforeunload for mobile browsers
      globalThis.addEventListener('pagehide', this.boundPageHide);
      globalThis.addEventListener('visibilitychange', () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          this.handlePageHide();
        }
      });
    }
  }

  async sendLogs(logs: InternalLogEntry[]): Promise<void> {
    if (this.isOnline) {
      try {
        await this.inner.sendLogs(logs);
        return;
      } catch {
        // Network failed despite navigator.onLine — buffer them
        if (this.debug) console.warn('[LogTide:Offline] sendLogs failed, buffering');
      }
    }

    for (const log of logs) {
      if (this.logBuffer.length >= this.maxBufferSize) {
        if (this.debug) console.warn('[LogTide:Offline] Log buffer full, dropping');
        break;
      }
      this.logBuffer.push(log);
    }
  }

  async sendSpans(spans: Span[]): Promise<void> {
    if (this.isOnline) {
      try {
        if (this.inner.sendSpans) {
          await this.inner.sendSpans(spans);
        }
        return;
      } catch {
        if (this.debug) console.warn('[LogTide:Offline] sendSpans failed, buffering');
      }
    }

    for (const span of spans) {
      if (this.spanBuffer.length >= this.maxBufferSize) {
        if (this.debug) console.warn('[LogTide:Offline] Span buffer full, dropping');
        break;
      }
      this.spanBuffer.push(span);
    }
  }

  async flush(): Promise<void> {
    // Flush offline buffers first
    await this.flushBuffers();
    // Then flush inner transport
    await this.inner.flush();
  }

  destroy(): void {
    if (typeof globalThis !== 'undefined' && typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('online', this.boundOnline);
      globalThis.removeEventListener('offline', this.boundOffline);
      globalThis.removeEventListener('pagehide', this.boundPageHide);
    }
    if ('destroy' in this.inner && typeof (this.inner as any).destroy === 'function') {
      (this.inner as any).destroy();
    }
  }

  // ─── Internal ─────────────────────────────────────────

  private handleOnline(): void {
    this.isOnline = true;
    if (this.debug) console.log('[LogTide:Offline] Back online, flushing buffers');
    this.flushBuffers().catch(() => {
      // Silently fail — items stay in buffer for next attempt
    });
  }

  private handleOffline(): void {
    this.isOnline = false;
    if (this.debug) console.log('[LogTide:Offline] Gone offline, buffering');
  }

  private handlePageHide(): void {
    // Use sendBeacon for reliable delivery on page unload
    if (this.beaconUrl && this.logBuffer.length > 0) {
      this.sendViaBeacon(this.logBuffer.splice(0));
    }
    // Also flush any buffered data through inner transport
    // (sendBeacon is fire-and-forget, but try the regular path too)
    if (this.logBuffer.length > 0 || this.spanBuffer.length > 0) {
      this.flushBuffers().catch(() => {});
    }
  }

  private async flushBuffers(): Promise<void> {
    if (this.logBuffer.length > 0) {
      const logs = this.logBuffer.splice(0);
      try {
        await this.inner.sendLogs(logs);
        if (this.debug) console.log(`[LogTide:Offline] Flushed ${logs.length} buffered logs`);
      } catch {
        // Put them back at the front
        this.logBuffer.unshift(...logs);
        if (this.debug) console.warn('[LogTide:Offline] Failed to flush logs, re-buffering');
      }
    }

    if (this.spanBuffer.length > 0 && this.inner.sendSpans) {
      const spans = this.spanBuffer.splice(0);
      try {
        await this.inner.sendSpans(spans);
        if (this.debug) console.log(`[LogTide:Offline] Flushed ${spans.length} buffered spans`);
      } catch {
        this.spanBuffer.unshift(...spans);
        if (this.debug) console.warn('[LogTide:Offline] Failed to flush spans, re-buffering');
      }
    }
  }

  private sendViaBeacon(logs: InternalLogEntry[]): void {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon || !this.beaconUrl) return;

    // sendBeacon has a ~64KB limit per call — split into chunks if needed
    const MAX_BEACON_SIZE = 60_000; // leave margin below 64KB
    const chunks = this.chunkBySize(logs, MAX_BEACON_SIZE);

    for (const chunk of chunks) {
      const payload = JSON.stringify({
        logs: chunk,
        ...(this.apiKey ? { _apiKey: this.apiKey } : {}),
      });

      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(this.beaconUrl, blob);

      if (this.debug) {
        console.log(`[LogTide:Offline] sendBeacon ${sent ? 'ok' : 'failed'}: ${chunk.length} logs`);
      }
    }
  }

  private chunkBySize(logs: InternalLogEntry[], maxBytes: number): InternalLogEntry[][] {
    const chunks: InternalLogEntry[][] = [];
    let current: InternalLogEntry[] = [];
    let currentSize = 0;

    for (const log of logs) {
      const logSize = JSON.stringify(log).length;
      if (currentSize + logSize > maxBytes && current.length > 0) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(log);
      currentSize += logSize;
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
  }
}
