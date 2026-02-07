import type { InternalLogEntry, Span, Transport } from '@logtide/types';
import { CircuitBreaker } from '../utils/circuit-breaker';

export interface BatchTransportOptions {
  /** Underlying transport to delegate to */
  inner: Transport;
  /** Batch size before auto-flush (default: 100) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Max buffer size before dropping (default: 10000) */
  maxBufferSize?: number;
  /** Max retries per flush (default: 3) */
  maxRetries?: number;
  /** Base retry delay in ms (default: 1000) */
  retryDelayMs?: number;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset time in ms (default: 30000) */
  circuitBreakerResetMs?: number;
  /** Debug mode (default: false) */
  debug?: boolean;
}

export class BatchTransport implements Transport {
  private logBuffer: InternalLogEntry[] = [];
  private spanBuffer: Span[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private inner: Transport;
  private batchSize: number;
  private maxBufferSize: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private circuitBreaker: CircuitBreaker;
  private debug: boolean;

  constructor(options: BatchTransportOptions) {
    this.inner = options.inner;
    this.batchSize = options.batchSize ?? 100;
    this.maxBufferSize = options.maxBufferSize ?? 10000;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.debug = options.debug ?? false;

    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerThreshold ?? 5,
      options.circuitBreakerResetMs ?? 30000,
    );

    const interval = options.flushInterval ?? 5000;
    this.timer = setInterval(() => this.flush(), interval);
  }

  async sendLogs(logs: InternalLogEntry[]): Promise<void> {
    for (const log of logs) {
      if (this.logBuffer.length >= this.maxBufferSize) {
        if (this.debug) console.warn('[LogTide] Log buffer full, dropping log');
        continue;
      }
      this.logBuffer.push(log);
    }

    if (this.logBuffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async sendSpans(spans: Span[]): Promise<void> {
    for (const span of spans) {
      if (this.spanBuffer.length >= this.maxBufferSize) {
        if (this.debug) console.warn('[LogTide] Span buffer full, dropping span');
        continue;
      }
      this.spanBuffer.push(span);
    }

    if (this.spanBuffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.circuitBreaker.canAttempt()) {
      if (this.debug) console.warn('[LogTide] Circuit breaker open, skipping flush');
      return;
    }

    const logs = this.logBuffer.splice(0);
    const spans = this.spanBuffer.splice(0);

    if (logs.length > 0) {
      await this.sendWithRetry(() => this.inner.sendLogs(logs), logs.length, 'logs');
    }

    if (spans.length > 0 && this.inner.sendSpans) {
      await this.sendWithRetry(() => this.inner.sendSpans!(spans), spans.length, 'spans');
    }
  }

  private async sendWithRetry(
    fn: () => Promise<void>,
    count: number,
    type: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await fn();
        this.circuitBreaker.recordSuccess();
        if (this.debug) console.log(`[LogTide] Sent ${count} ${type}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          if (this.debug) {
            console.warn(`[LogTide] Retry ${attempt + 1}/${this.maxRetries} for ${type}: ${lastError.message}`);
          }
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    this.circuitBreaker.recordFailure();
    if (this.debug) {
      console.error(`[LogTide] Failed to send ${count} ${type}: ${lastError?.message}`);
    }
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
