import { registerLogtide, captureRequestError } from '@logtide/nextjs/server';

export async function register() {
  const dsn = process.env.LOGTIDE_DSN ?? 'http://lp_testkey@127.0.0.1:9100/test-project';

  await registerLogtide({
    dsn,
    service: 'test-nextjs',
    environment: 'test',
    batchSize: 1,
    flushInterval: 500,
  });
}

export const onRequestError = captureRequestError;
