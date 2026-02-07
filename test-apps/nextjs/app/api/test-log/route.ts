import { NextResponse } from 'next/server';
import { hub } from '@logtide/core';

// Next.js bundles API routes separately from instrumentation.ts,
// creating a separate hub singleton. Initialize it here if needed.
if (!hub.getClient()) {
  hub.init({
    dsn: process.env.LOGTIDE_DSN ?? 'http://lp_testkey@127.0.0.1:9100/test-project',
    service: 'test-nextjs',
    environment: 'test',
    batchSize: 1,
    flushInterval: 500,
  });
}

export async function GET() {
  const client = hub.getClient();

  // Create a span to test OTLP span sending
  const span = client?.startSpan({
    name: 'GET /api/test-log',
    attributes: { 'http.method': 'GET', 'http.target': '/api/test-log' },
  });

  client?.captureLog('info', 'manual log from nextjs', { route: '/api/test-log' });

  if (span) {
    client?.finishSpan(span.spanId, 'ok');
  }

  await hub.flush();
  return NextResponse.json({ ok: true, message: 'Log sent' });
}
