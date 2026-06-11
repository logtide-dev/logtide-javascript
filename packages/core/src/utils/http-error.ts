/**
 * Error thrown by HTTP transports for non-2xx responses. Carries the status
 * so the retry logic can distinguish retryable failures (408, 429, 5xx)
 * from permanent ones (other 4xx), plus the parsed Retry-After delay.
 */
export class HttpError extends Error {
  readonly status: number;
  /** Parsed Retry-After header in milliseconds, when present. */
  readonly retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  get isRetryable(): boolean {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

/** Parse a Retry-After header value (delta-seconds form) to milliseconds. */
export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return undefined;
}
