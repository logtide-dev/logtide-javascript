import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';

export interface ReceivedLog {
  service: string;
  level: string;
  message: string;
  time?: string;
  metadata?: Record<string, unknown>;
  trace_id?: string;
  span_id?: string;
  breadcrumbs?: unknown[];
}

export interface ReceivedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: Array<{ key: string; value: unknown }>;
  status?: { code: number };
  serviceName?: string;
}

export interface MockServerState {
  logs: ReceivedLog[];
  spans: ReceivedSpan[];
  requests: Array<{
    timestamp: number;
    apiKey: string | null;
    endpoint: string;
    count: number;
  }>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export function createMockServer() {
  const state: MockServerState = {
    logs: [],
    spans: [],
    requests: [],
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const method = req.method ?? 'GET';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const apiKey = req.headers['x-api-key'] as string | undefined;

      // Ingest endpoint - receives logs from SDK
      if (url.pathname === '/api/v1/ingest' && method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body);

        const logs: ReceivedLog[] = payload.logs ?? [];
        state.logs.push(...logs);
        state.requests.push({
          timestamp: Date.now(),
          apiKey: apiKey ?? null,
          endpoint: '/api/v1/ingest',
          count: logs.length,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, received: logs.length }));
        return;
      }

      // OTLP traces endpoint - receives spans from SDK
      if (url.pathname === '/v1/otlp/traces' && method === 'POST') {
        const body = await readBody(req);
        const payload = JSON.parse(body);

        const spans: ReceivedSpan[] = [];
        for (const rs of payload.resourceSpans ?? []) {
          // Extract service name from resource attributes
          const serviceAttr = rs.resource?.attributes?.find(
            (a: any) => a.key === 'service.name',
          );
          const serviceName = serviceAttr?.value?.stringValue;

          for (const ss of rs.scopeSpans ?? []) {
            for (const span of ss.spans ?? []) {
              spans.push({
                ...span,
                serviceName,
              });
            }
          }
        }

        state.spans.push(...spans);
        state.requests.push({
          timestamp: Date.now(),
          apiKey: apiKey ?? null,
          endpoint: '/v1/otlp/traces',
          count: spans.length,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, received: spans.length }));
        return;
      }

      // Test endpoint - get all received logs
      if (url.pathname === '/test/logs' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs: state.logs, requests: state.requests }));
        return;
      }

      // Test endpoint - get all received spans
      if (url.pathname === '/test/spans' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ spans: state.spans }));
        return;
      }

      // Test endpoint - get everything
      if (url.pathname === '/test/all' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs: state.logs, spans: state.spans, requests: state.requests }));
        return;
      }

      // Test endpoint - reset state
      if (url.pathname === '/test/reset' && method === 'POST') {
        state.logs = [];
        state.spans = [];
        state.requests = [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // Health check
      if (url.pathname === '/test/health' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  return {
    server,
    state,
    start(port = 0): Promise<{ url: string; port: number }> {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({ url: `http://127.0.0.1:${actualPort}`, port: actualPort });
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    reset() {
      state.logs = [];
      state.spans = [];
      state.requests = [];
    },
  };
}

// Allow running standalone
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const mock = createMockServer();
  const { url } = await mock.start(9999);
  console.log(`Mock LogTide server running at ${url}`);
}
