import type { ClientOptions, DSN } from '@logtide/types';

/**
 * Parse a LogTide DSN string into its components.
 * Format: https://lp_APIKEY@host[/base-path]
 * The path, when present, is a base-path prefix (reverse-proxied installs)
 * and is preserved in the resulting apiUrl (spec 002 §3).
 */
export function parseDSN(dsn: string): DSN {
  try {
    const url = new URL(dsn);
    const apiKey = url.username;
    const basePath = url.pathname.replace(/\/+$/, '');
    const apiUrl = `${url.protocol}//${url.host}${basePath === '/' ? '' : basePath}`;

    if (!apiKey) {
      throw new Error('Missing API key in DSN');
    }

    return { apiUrl, apiKey };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Missing')) {
      throw err;
    }
    throw new Error(`Invalid DSN: ${dsn}`);
  }
}

/**
 * Resolve a DSN from ClientOptions.
 * Accepts either a `dsn` string or separate `apiUrl` + `apiKey` fields.
 */
export function resolveDSN(options: ClientOptions): DSN {
  if (options.dsn) {
    return parseDSN(options.dsn);
  }
  if (options.apiUrl && options.apiKey) {
    return {
      apiUrl: options.apiUrl.replace(/\/$/, ''),
      apiKey: options.apiKey,
    };
  }
  throw new Error('Either "dsn" or both "apiUrl" and "apiKey" must be provided');
}
