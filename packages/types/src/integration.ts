import type { Breadcrumb } from './breadcrumb';

/** Minimal Client interface for integrations to depend on. */
export interface Client {
  captureError(error: unknown, metadata?: Record<string, unknown>): void;
  captureLog(level: string, message: string, metadata?: Record<string, unknown>): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
}

export interface Integration {
  name: string;
  setup(client: Client): void;
  teardown?(): void;
}
