import { logtideHandle, logtideHandleError } from '@logtide/sveltekit/server';

const dsn = process.env.LOGTIDE_DSN ?? 'http://lp_testkey@127.0.0.1:9101/test-project';

export const handle = logtideHandle({
  dsn,
  service: 'test-sveltekit',
  environment: 'test',
  batchSize: 1,
  flushInterval: 500,
});

export const handleError = logtideHandleError();
