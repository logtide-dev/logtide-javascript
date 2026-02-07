import { createMockServer, type ReceivedLog, type ReceivedSpan } from './server.js';

export { createMockServer, type ReceivedLog, type ReceivedSpan };
export type { MockServerState } from './server.js';

/**
 * Poll the mock server until the expected number of logs is received or timeout.
 */
export async function waitForLogs(
  mockUrl: string,
  expectedCount: number,
  timeoutMs = 10_000,
): Promise<ReceivedLog[]> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${mockUrl}/test/logs`);
    const data = await res.json();
    if (data.logs.length >= expectedCount) {
      return data.logs;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const res = await fetch(`${mockUrl}/test/logs`);
  const data = await res.json();
  if (data.logs.length >= expectedCount) {
    return data.logs;
  }

  throw new Error(
    `Timeout: expected ${expectedCount} logs, got ${data.logs.length} after ${timeoutMs}ms`,
  );
}

/**
 * Poll the mock server until the expected number of spans is received or timeout.
 */
export async function waitForSpans(
  mockUrl: string,
  expectedCount: number,
  timeoutMs = 10_000,
): Promise<ReceivedSpan[]> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${mockUrl}/test/spans`);
    const data = await res.json();
    if (data.spans.length >= expectedCount) {
      return data.spans;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const res = await fetch(`${mockUrl}/test/spans`);
  const data = await res.json();
  if (data.spans.length >= expectedCount) {
    return data.spans;
  }

  throw new Error(
    `Timeout: expected ${expectedCount} spans, got ${data.spans.length} after ${timeoutMs}ms`,
  );
}

/**
 * Reset the mock server state.
 */
export async function resetMockServer(mockUrl: string): Promise<void> {
  await fetch(`${mockUrl}/test/reset`, { method: 'POST' });
}

/**
 * Build a DSN string pointing to the mock server.
 * Format: http://lp_testkey@host:port/test-project
 */
export function buildMockDSN(mockUrl: string): string {
  const url = new URL(mockUrl);
  return `${url.protocol}//lp_testkey@${url.host}/test-project`;
}
