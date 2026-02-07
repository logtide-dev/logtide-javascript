import type { Integration, Client } from '@logtide/types';

/** Captures unhandled rejections and uncaught exceptions. */
export class GlobalErrorIntegration implements Integration {
  name = 'global-error';

  private client: Client | null = null;
  private onUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;
  private onError: ((event: ErrorEvent) => void) | null = null;

  setup(client: Client): void {
    this.client = client;

    if (typeof globalThis.addEventListener === 'function') {
      this.onUnhandledRejection = (event: PromiseRejectionEvent) => {
        this.client?.captureError(event.reason, {
          mechanism: 'unhandledrejection',
        });
      };

      this.onError = (event: ErrorEvent) => {
        this.client?.captureError(event.error ?? event.message, {
          mechanism: 'onerror',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      };

      globalThis.addEventListener('unhandledrejection', this.onUnhandledRejection as EventListener);
      globalThis.addEventListener('error', this.onError as EventListener);
    }

    // Node.js style handlers (runtime-safe without @types/node)
    const proc = (globalThis as Record<string, unknown>).process as
      | { on?: (event: string, handler: (...args: unknown[]) => void) => void }
      | undefined;

    if (proc?.on) {
      proc.on('unhandledRejection', (reason: unknown) => {
        this.client?.captureError(reason, { mechanism: 'unhandledrejection' });
      });

      proc.on('uncaughtException', (error: unknown) => {
        this.client?.captureError(error, { mechanism: 'uncaughtException' });
      });
    }
  }

  teardown(): void {
    if (typeof globalThis.removeEventListener === 'function') {
      if (this.onUnhandledRejection) {
        globalThis.removeEventListener('unhandledrejection', this.onUnhandledRejection as EventListener);
      }
      if (this.onError) {
        globalThis.removeEventListener('error', this.onError as EventListener);
      }
    }
    this.client = null;
  }
}
