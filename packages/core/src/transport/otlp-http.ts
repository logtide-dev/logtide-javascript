import type { InternalLogEntry, Span, Transport } from '@logtide/types';
import type { DSN } from '@logtide/types';

function serializeAttrValue(
  value: string | number | boolean,
): { stringValue: string } | { intValue: string } | { boolValue: boolean } {
  if (typeof value === 'number') return { intValue: String(value) };
  if (typeof value === 'boolean') return { boolValue: value };
  return { stringValue: value };
}

function serializeAttrs(
  attrs: Record<string, string | number | boolean | undefined>,
): { key: string; value: ReturnType<typeof serializeAttrValue> }[] {
  return (Object.entries(attrs) as [string, string | number | boolean | undefined][])
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => ({ key, value: serializeAttrValue(value) }));
}

/**
 * Convert internal spans to OTLP JSON trace format.
 * Follows the OpenTelemetry Protocol (OTLP/HTTP) JSON specification.
 */
function toOtlpTracePayload(
  spans: Span[],
  serviceName: string,
  options?: { environment?: string; release?: string },
) {
  const resourceAttributes: { key: string; value: { stringValue: string } }[] = [
    { key: 'service.name', value: { stringValue: serviceName } },
  ];

  if (options?.environment) {
    resourceAttributes.push({
      key: 'deployment.environment',
      value: { stringValue: options.environment },
    });
  }

  if (options?.release) {
    resourceAttributes.push({
      key: 'service.version',
      value: { stringValue: options.release },
    });
  }

  return {
    resourceSpans: [
      {
        resource: {
          attributes: resourceAttributes,
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
              attributes: serializeAttrs(s.attributes),
              status: {
                code: s.status === 'error' ? 2 : s.status === 'ok' ? 1 : 0,
              },
              events: (s.events ?? []).map((e) => ({
                name: e.name,
                timeUnixNano: String(e.timestamp * 1_000_000),
                attributes: serializeAttrs(e.attributes ?? {}),
              })),
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
  private environment?: string;
  private release?: string;

  constructor(dsn: DSN, serviceName: string, options?: { environment?: string; release?: string }) {
    this.dsn = dsn;
    this.serviceName = serviceName;
    this.environment = options?.environment;
    this.release = options?.release;
  }

  async sendLogs(_logs: InternalLogEntry[]): Promise<void> {
    // OTLP transport only handles spans; logs go via LogtideHttpTransport.
  }

  async sendSpans(spans: Span[]): Promise<void> {
    if (spans.length === 0) return;

    const payload = toOtlpTracePayload(spans, this.serviceName, {
      environment: this.environment,
      release: this.release,
    });

    const response = await fetch(`${this.dsn.apiUrl}/v1/otlp/traces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.dsn.apiKey,
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
