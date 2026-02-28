import { describe, it, expect, beforeEach } from 'vitest';
import { LogtideClient } from '../src/client';
import { hub } from '../src/hub';
import { startChildSpan, finishChildSpan } from '../src/child-span';
import type { Transport, InternalLogEntry, Span } from '@logtide/types';

function createMockTransport(): Transport & { spans: Span[] } {
  const transport = {
    logs: [],
    spans: [] as Span[],
    async sendLogs(logs: InternalLogEntry[]) {},
    async sendSpans(spans: Span[]) {
      transport.spans.push(...spans);
    },
    async flush() {},
  };
  return transport;
}

describe('Trace Integration (Complete Payload)', () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(async () => {
    await hub.close();
    transport = createMockTransport();
    hub.init({
      dsn: 'https://key@api.logtide.dev/1',
      service: 'test-api',
      transport,
    });
  });

  it('should generate a complete trace with events, child spans and rich attributes', async () => {
    const client = hub.getClient()!;
    const scope = client.createScope('trace-123');

    // 1. Inizio Root Span (es. Middleware HTTP)
    const rootSpan = client.startSpan({
      name: 'GET /api/users',
      traceId: scope.traceId,
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://api.example.com/api/users',
        'net.peer.ip': '127.0.0.1'
      }
    });
    scope.spanId = rootSpan.spanId;

    // 2. Aggiunta Breadcrumb (che diventeranno eventi)
    scope.addBreadcrumb({
      type: 'auth',
      category: 'middleware',
      message: 'User authenticated',
      data: { user_id: 'user_99' }
    });

    // 3. Esecuzione operazione figlia (es. Query DB)
    const dbSpan = startChildSpan('SELECT users', scope, { 'db.system': 'postgresql' });
    // Simulazione lavoro...
    finishChildSpan(dbSpan.spanId, 'ok');

    // 4. Fine Root Span con attributi finali e conversione breadcrumb -> events
    const events = scope.getBreadcrumbs().map(b => ({
      name: b.message,
      timestamp: b.timestamp,
      attributes: { 'breadcrumb.type': b.type, ...Object.fromEntries(Object.entries(b.data || {}).map(([k,v]) => [`data.${k}`, String(v)])) }
    }));

    client.finishSpan(rootSpan.spanId, 'ok', {
      extraAttributes: {
        'http.status_code': 200,
        'duration_ms': 150
      },
      events
    });

    // VERIFICA
    expect(transport.spans).toHaveLength(2);

    const root = transport.spans.find(s => s.name === 'GET /api/users')!;
    const child = transport.spans.find(s => s.name === 'SELECT users')!;

    // Verifica Gerarchia
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.traceId).toBe(root.traceId);

    // Verifica Attributi Root (ora molto più ricchi)
    expect(root.attributes['http.status_code']).toBe(200);
    expect(root.attributes['duration_ms']).toBe(150);
    expect(root.attributes['net.peer.ip']).toBe('127.0.0.1');

    // Verifica Eventi (le breadcrumb sono ora nella timeline dello span)
    expect(root.events).toBeDefined();
    expect(root.events).toHaveLength(1);
    expect(root.events![0].name).toBe('User authenticated');
    expect(root.events![0].attributes!['data.user_id']).toBe('user_99');
  });
});
