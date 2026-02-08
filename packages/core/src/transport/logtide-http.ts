import type { InternalLogEntry, Span, Transport } from '@logtide/types';
import type { DSN } from '@logtide/types';

/** HTTP transport that sends logs to the LogTide native API (/api/v1/ingest). */
export class LogtideHttpTransport implements Transport {
  private dsn: DSN;

  constructor(dsn: DSN) {
    this.dsn = dsn;
  }

  async sendLogs(logs: InternalLogEntry[]): Promise<void> {
    const response = await fetch(`${this.dsn.apiUrl}/api/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.dsn.apiKey,
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LogTide ingest failed: HTTP ${response.status}: ${text}`);
    }
  }

  async sendSpans(_spans: Span[]): Promise<void> {
    // LogTide native transport does not send spans; use OtlpHttpTransport for that.
  }

  async flush(): Promise<void> {
    // No-op: batching is handled by BatchTransport wrapper.
  }
}
