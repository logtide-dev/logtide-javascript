import type { Integration } from './integration';
import type { Transport } from './transport';

export interface DSN {
  apiUrl: string;
  apiKey: string;
  projectId: string;
}

export interface ClientOptions {
  /** DSN string: https://lp_APIKEY@api.logtide.dev/PROJECT_ID */
  dsn: string;
  /** Service name for log attribution */
  service: string;
  /** Environment (e.g. production, staging) */
  environment?: string;
  /** Release / version identifier */
  release?: string;
  /** Batch size before flushing (default: 100) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number;
  /** Max buffer size before dropping (default: 10000) */
  maxBufferSize?: number;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay base in ms (default: 1000) */
  retryDelayMs?: number;
  /** Circuit breaker failure threshold (default: 5) */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset time in ms (default: 30000) */
  circuitBreakerResetMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Custom transport (overrides default) */
  transport?: Transport;
  /** Integrations to install */
  integrations?: Integration[];
  /** Max breadcrumbs to keep (default: 100) */
  maxBreadcrumbs?: number;
  /** Sample rate for traces (0.0 to 1.0, default: 1.0) */
  tracesSampleRate?: number;
}
