import type { Breadcrumb, ClientOptions } from '@logtide/types';
import { LogtideClient } from './client';
import { Scope } from './scope';
import { generateTraceId } from './utils/trace-id';

/**
 * Global Hub singleton.
 * Stores the active client and provides a convenience API.
 */
class Hub {
  private client: LogtideClient | null = null;
  private globalScope: Scope;

  constructor() {
    this.globalScope = new Scope(generateTraceId());
  }

  init(options: ClientOptions): LogtideClient {
    if (this.client) {
      if (options.debug) {
        console.warn('[LogTide] Hub already initialised – returning existing client');
      }
      return this.client;
    }
    this.client = new LogtideClient(options);
    return this.client;
  }

  getClient(): LogtideClient | null {
    return this.client;
  }

  getScope(): Scope {
    return this.globalScope;
  }

  captureError(error: unknown, metadata?: Record<string, unknown>): void {
    this.client?.captureError(error, metadata, this.globalScope);
  }

  captureLog(level: string, message: string, metadata?: Record<string, unknown>): void {
    this.client?.captureLog(level, message, metadata, this.globalScope);
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.globalScope.addBreadcrumb(breadcrumb);
    this.client?.addBreadcrumb(breadcrumb);
  }

  async flush(): Promise<void> {
    await this.client?.flush();
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
  }
}

/** The global hub singleton. */
export const hub = new Hub();
