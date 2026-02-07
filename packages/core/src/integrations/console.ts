import type { Integration, Client } from '@logtide/types';

/** Console interception integration — captures console.* calls as logs and breadcrumbs. */
export class ConsoleIntegration implements Integration {
  name = 'console';

  private client: Client | null = null;
  private originals: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  } | null = null;

  setup(client: Client): void {
    this.client = client;

    this.originals = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    const intercept = (
      method: 'log' | 'info' | 'warn' | 'error' | 'debug',
      level: 'info' | 'warn' | 'error' | 'debug',
    ) => {
      const original = this.originals![method];
      return (...args: unknown[]) => {
        original(...args);

        const message = args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ');

        if (message.startsWith('[LogTide]')) return;

        this.client!.addBreadcrumb({
          type: 'console',
          category: `console.${method}`,
          message,
          level: level === 'debug' ? 'debug' : level,
          timestamp: Date.now(),
        });
      };
    };

    console.log = intercept('log', 'info');
    console.info = intercept('info', 'info');
    console.warn = intercept('warn', 'warn');
    console.error = intercept('error', 'error');
    console.debug = intercept('debug', 'debug');
  }

  teardown(): void {
    if (this.originals) {
      console.log = this.originals.log;
      console.info = this.originals.info;
      console.warn = this.originals.warn;
      console.error = this.originals.error;
      console.debug = this.originals.debug;
      this.originals = null;
    }
    this.client = null;
  }
}
