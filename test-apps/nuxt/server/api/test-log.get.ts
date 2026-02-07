import { hub } from '@logtide/core';

export default defineEventHandler(async () => {
  const client = hub.getClient();
  client?.captureLog('info', 'manual log from nuxt', { route: '/api/test-log' });
  await hub.flush();
  return { ok: true, message: 'Log sent' };
});
