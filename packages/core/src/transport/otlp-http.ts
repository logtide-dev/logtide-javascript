import type { InternalLogEntry, Span, Transport } from '@logtide/types';
import type { DSN } from '@logtide/types';

/**
 * Convert internal spans to OTLP JSON trace format.
 * Follows the OpenTelemetry Protocol (OTLP/HTTP) JSON specification.
 */
function toOtlpTracePayload(spans: Span[], serviceName: string) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: '@logtide/core', version: '0.1.0' },
            spans: spans.map((s) => ({
              traceId: s.traceId,
              spanId: s.spanId,
              parentSpanId: s.parentSpanId || '',
              name: s.name,
              kind: 2, // SPAN_KIND_SERVER
              startTimeUnixNano: String(s.startTime * 1_000_000),
              endTimeUnixNano: String((s.endTime ?? s.startTime) * 1_000_000),
              attributes: Object.entries(s.attributes).map(([key, value]) => ({
                key,
                value:
                  typeof value === 'string'
                    ? { stringValue: value }
                    : typeof value === 'number'
                      ? { intValue: String(value) }
                      : { boolValue: value },
              })),
              status: {
                code: s.status === 'error' ? 2 : s.status === 'ok' ? 1 : 0,
              },
            })),
          },
        ],
      },
    ],
  };
}

/** OTLP/HTTP transport that sends traces to /v1/otlp/traces. */
export class OtlpHttpTransport implements Transport {
  private dsn: DSN;
  private serviceName: string;

  constructor(dsn: DSN, serviceName: string) {
    this.dsn = dsn;
    this.serviceName = serviceName;
  }

  async sendLogs(_logs: InternalLogEntry[]): Promise<void> {
    // OTLP transport only handles spans; logs go via LogtideHttpTransport.
  }

  async sendSpans(spans: Span[]): Promise<void> {
    if (spans.length === 0) return;

    const payload = toOtlpTracePayload(spans, this.serviceName);

    const response = await fetch(`${this.dsn.apiUrl}/v1/otlp/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.dsn.apiKey,
        'X-Project-Id': this.dsn.projectId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OTLP trace export failed: HTTP ${response.status}: ${text}`);
    }
  }

  async flush(): Promise<void> {
    // No-op: batching is handled by BatchTransport wrapper.
  }
}
