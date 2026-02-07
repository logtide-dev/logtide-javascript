import type { DSN } from '@logtide/types';

/**
 * Parse a LogTide DSN string into its components.
 * Format: https://lp_APIKEY@host/PROJECT_ID
 */
export function parseDSN(dsn: string): DSN {
  try {
    const url = new URL(dsn);
    const apiKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    const apiUrl = `${url.protocol}//${url.host}`;

    if (!apiKey) {
      throw new Error('Missing API key in DSN');
    }
    if (!projectId) {
      throw new Error('Missing project ID in DSN');
    }

    return { apiUrl, apiKey, projectId };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Missing')) {
      throw err;
    }
    throw new Error(`Invalid DSN: ${dsn}`);
  }
}
