import { json } from '@sveltejs/kit';
import { hub } from '@logtide/core';

export async function GET() {
  const client = hub.getClient();
  client?.captureLog('info', 'manual log from sveltekit', { route: '/api/test-log' });
  await hub.flush();
  return json({ ok: true, message: 'Log sent' });
}
