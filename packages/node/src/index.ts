import { randomUUID } from 'crypto';

// ==================== Types ====================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface ConsoleInterceptOptions {
  enabled: boolean;
  service?: string;
  preserveOriginal?: boolean;
  includeStackTrace?: boolean;
  levels?: {
    log?: boolean;
    info?: boolean;
    warn?: boolean;
    error?: boolean;
    debug?: boolean;
  };
}

export interface PayloadLimitsOptions {
  /** Maximum size in bytes for a single field value (default: 10KB) */
  maxFieldSize?: number;
  /** Maximum size in bytes for the entire log entry (default: 100KB) */
  maxLogSize?: number;
  /** Fields to exclude from metadata (e.g., ['body', 'requestBody', 'responseBody']) */
  excludeFields?: string[];
  /** Marker to append when a field is truncated (default: '...[TRUNCATED]') */
  truncationMarker?: string;
}

export interface LogTideClientOptions {
  apiUrl: string;
  apiKey: string;
  batchSize?: number;
  flushInterval?: number;
  maxBufferSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
  enableMetrics?: boolean;
  debug?: boolean;
  globalMetadata?: Record<string, unknown>;
  autoTraceId?: boolean;
  interceptConsole?: ConsoleInterceptOptions;
  /** Payload size limits to prevent 413 errors */
  payloadLimits?: PayloadLimitsOptions;
}

export interface LogEntry {
  service: string;
  level: LogLevel;
  message: string;
  time?: string;
  metadata?: Record<string, unknown>;
  trace_id?: string;
}

export interface InternalLogEntry extends LogEntry {
  time: string;
}

export interface QueryOptions {
  service?: string;
  level?: LogLevel;
  from?: Date | string;
  to?: Date | string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: InternalLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AggregatedStatsOptions {
  from: Date | string;
  to: Date | string;
  interval?: '1m' | '5m' | '1h' | '1d';
  service?: string;
}

export interface AggregatedStatsResponse {
  timeseries: Array<{
    bucket: string;
    total: number;
    by_level: Record<string, number>;
  }>;
  top_services: Array<{ service: string; count: number }>;
  top_errors: Array<{ message: string; count: number }>;
}

export interface ClientMetrics {
  logsSent: number;
  logsDropped: number;
  errors: number;
  retries: number;
  avgLatencyMs: number;
  circuitBreakerTrips: number;
}

export interface StreamOptions {
  service?: string;
  level?: LogLevel;
  onLog: (log: InternalLogEntry) => void;
  onError?: (error: Error) => void;
}

// ==================== Circuit Breaker ====================

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private threshold: number,
    private resetMs: number,
  ) {}

  recordSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.resetMs) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow one attempt
    return true;
  }

  getState(): CircuitState {
    return this.state;
  }
}


// ==================== Structured Exception Types ====================

export interface StructuredStackFrame {
  /** File path or module name */
  file?: string;
  /** Function/method name */
  function?: string;
  /** Line number (1-based) */
  line?: number;
  /** Column number */
  column?: number;
  /** Additional frame metadata */
  metadata?: Record<string, unknown>;
}

export interface StructuredException {
  /** Exception type/class name (e.g., "TypeError", "Error") */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace as an array of frames (top to bottom) */
  stacktrace?: StructuredStackFrame[];
  /** Language hint for better fingerprinting */
  language?: string;
  /** Inner/cause exception (for wrapped exceptions) */
  cause?: StructuredException;
  /** Additional exception metadata */
  metadata?: Record<string, unknown>;
  /** Original raw stack trace as a string (fallback) */
  raw?: string;
}

// ==================== Error Serialization ====================

/**
 * Parse a V8/Node.js stack trace string into structured frames
 */
function parseNodeStackTrace(stack: string | undefined): StructuredStackFrame[] {
  if (!stack) return [];

  const frames: StructuredStackFrame[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    // Skip the first line (error message) and empty lines
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    // Format 1: "at functionName (file:line:column)"
    const match1 = trimmed.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    if (match1) {
      frames.push({
        function: match1[1],
        file: match1[2],
        line: parseInt(match1[3], 10),
        column: parseInt(match1[4], 10),
      });
      continue;
    }

    // Format 2: "at file:line:column" (anonymous function)
    const match2 = trimmed.match(/^at\s+(.+):(\d+):(\d+)$/);
    if (match2) {
      frames.push({
        file: match2[1],
        line: parseInt(match2[2], 10),
        column: parseInt(match2[3], 10),
      });
      continue;
    }

    // Format 3: "at functionName (native)" or similar
    const match3 = trimmed.match(/^at\s+(.+?)\s+\((.+)\)$/);
    if (match3) {
      frames.push({
        function: match3[1],
        file: match3[2],
      });
      continue;
    }

    // Format 4: "at functionName" (no file info)
    const match4 = trimmed.match(/^at\s+(.+)$/);
    if (match4) {
      frames.push({
        function: match4[1],
      });
    }
  }

  return frames;
}

/**
 * Serialize an error into the StructuredException format
 */
export function serializeError(error: unknown): StructuredException {
  if (error instanceof Error) {
    const result: StructuredException = {
      type: error.name,
      message: error.message,
      language: 'nodejs',
      stacktrace: parseNodeStackTrace(error.stack),
      raw: error.stack,
    };

    // Handle error.cause (Node.js 16.9+)
    if (error.cause) {
      result.cause = serializeError(error.cause);
    }

    // Extract additional error properties as metadata
    const errorMetadata: Record<string, unknown> = {};
    const standardProps = ['name', 'message', 'stack', 'cause'];

    for (const key of Object.keys(error)) {
      if (!standardProps.includes(key)) {
        errorMetadata[key] = (error as unknown as Record<string, unknown>)[key];
      }
    }

    // Include common Node.js error properties
    if ('code' in error) errorMetadata.code = (error as NodeJS.ErrnoException).code;
    if ('errno' in error) errorMetadata.errno = (error as NodeJS.ErrnoException).errno;
    if ('syscall' in error) errorMetadata.syscall = (error as NodeJS.ErrnoException).syscall;
    if ('path' in error) errorMetadata.path = (error as NodeJS.ErrnoException).path;

    if (Object.keys(errorMetadata).length > 0) {
      result.metadata = errorMetadata;
    }

    return result;
  }

  if (typeof error === 'string') {
    return {
      type: 'Error',
      message: error,
      language: 'nodejs',
    };
  }

  if (typeof error === 'object' && error !== null) {
    // Try to extract type and message from the object
    const obj = error as Record<string, unknown>;
    return {
      type: (typeof obj.type === 'string' ? obj.type : typeof obj.name === 'string' ? obj.name : 'Error'),
      message: (typeof obj.message === 'string' ? obj.message : JSON.stringify(error)),
      language: 'nodejs',
      metadata: obj,
    };
  }

  return {
    type: 'Error',
    message: String(error),
    language: 'nodejs',
  };
}

// ==================== Main Client ====================

export class LogTideClient {
  private apiUrl: string;
  private apiKey: string;
  private batchSize: number;
  private flushInterval: number;
  private maxBufferSize: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private enableMetrics: boolean;
  private debugMode: boolean;
  private globalMetadata: Record<string, unknown>;
  private autoTraceId: boolean;

  private buffer: InternalLogEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private circuitBreaker: CircuitBreaker;

  // Metrics
  private metrics: ClientMetrics = {
    logsSent: 0,
    logsDropped: 0,
    errors: 0,
    retries: 0,
    avgLatencyMs: 0,
    circuitBreakerTrips: 0,
  };
  private latencies: number[] = [];

  // Context tracking
  private currentTraceId: string | null = null;

  // Console interception
  private consoleInterceptOptions: ConsoleInterceptOptions | null = null;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  } | null = null;

  // Payload limits
  private payloadLimits: Required<PayloadLimitsOptions>;

  constructor(options: LogTideClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.maxBufferSize = options.maxBufferSize || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.enableMetrics = options.enableMetrics ?? true;
    this.debugMode = options.debug ?? false;
    this.globalMetadata = options.globalMetadata || {};
    this.autoTraceId = options.autoTraceId ?? false;

    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerThreshold || 5,
      options.circuitBreakerResetMs || 30000,
    );

    // Initialize payload limits with defaults
    this.payloadLimits = {
      maxFieldSize: options.payloadLimits?.maxFieldSize ?? 10 * 1024, // 10KB
      maxLogSize: options.payloadLimits?.maxLogSize ?? 100 * 1024, // 100KB
      excludeFields: options.payloadLimits?.excludeFields ?? [],
      truncationMarker: options.payloadLimits?.truncationMarker ?? '...[TRUNCATED]',
    };

    this.startFlushTimer();

    // Start console interception if configured
    if (options.interceptConsole?.enabled) {
      this.startConsoleInterception(options.interceptConsole);
    }
  }

  // ==================== Context Helpers ====================

  /**
   * Set trace ID for subsequent logs
   */
  setTraceId(traceId: string | null) {
    this.currentTraceId = traceId;
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string | null {
    return this.currentTraceId;
  }

  /**
   * Execute function with a specific trace ID context
   */
  withTraceId<T>(traceId: string, fn: () => T): T {
    const previousTraceId = this.currentTraceId;
    this.currentTraceId = traceId;
    try {
      return fn();
    } finally {
      this.currentTraceId = previousTraceId;
    }
  }

  /**
   * Execute function with a new auto-generated trace ID
   */
  withNewTraceId<T>(fn: () => T): T {
    return this.withTraceId(randomUUID(), fn);
  }

  // ==================== Console Interception ====================

  /**
   * Start intercepting console methods and forward them to LogTide
   */
  startConsoleInterception(options?: Partial<ConsoleInterceptOptions>) {
    if (this.originalConsole) {
      // Already intercepting
      return;
    }

    const config: ConsoleInterceptOptions = {
      enabled: true,
      service: options?.service ?? 'console',
      preserveOriginal: options?.preserveOriginal ?? true,
      includeStackTrace: options?.includeStackTrace ?? false,
      levels: {
        log: options?.levels?.log ?? true,
        info: options?.levels?.info ?? true,
        warn: options?.levels?.warn ?? true,
        error: options?.levels?.error ?? true,
        debug: options?.levels?.debug ?? true,
      },
    };

    this.consoleInterceptOptions = config;

    // Save original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    const createInterceptor = (
      method: 'log' | 'info' | 'warn' | 'error' | 'debug',
      level: LogLevel,
    ) => {
      const original = this.originalConsole![method];

      return (...args: unknown[]) => {
        // Always call original if preserveOriginal is true
        if (config.preserveOriginal) {
          original(...args);
        }

        // Skip if this method is not configured for interception
        if (!config.levels?.[method]) {
          return;
        }

        // Skip internal LogTide logs to prevent infinite loops
        const message = args
          .map((arg) => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return arg.message;
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' ');

        if (message.startsWith('[LogTide]')) {
          return;
        }

        // Build metadata
        const metadata: Record<string, unknown> = {
          source: 'console',
          originalMethod: method,
        };

        // Include stack trace if configured
        if (config.includeStackTrace) {
          const stack = new Error().stack;
          if (stack) {
            // Remove the first two lines (Error + this interceptor function)
            const stackLines = stack.split('\n').slice(2);
            metadata.stackTrace = stackLines.join('\n');

            // Extract caller location from first relevant stack line
            const callerLine = stackLines[0];
            if (callerLine) {
              const match = callerLine.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
              if (match) {
                metadata.caller = {
                  function: match[1],
                  file: match[2],
                  line: parseInt(match[3], 10),
                  column: parseInt(match[4], 10),
                };
              } else {
                // Try alternative format: "at file:line:column"
                const altMatch = callerLine.match(/at\s+(.+):(\d+):(\d+)/);
                if (altMatch) {
                  metadata.caller = {
                    file: altMatch[1],
                    line: parseInt(altMatch[2], 10),
                    column: parseInt(altMatch[3], 10),
                  };
                }
              }
            }
          }
        }

        // Include raw arguments for complex objects
        if (args.length > 1 || (args.length === 1 && typeof args[0] !== 'string')) {
          metadata.args = args.map((arg) => {
            if (arg instanceof Error) {
              return serializeError(arg);
            }
            return arg;
          });
        }

        // For error level, if any argument is an Error, add it to metadata.exception
        if (level === 'error' || level === 'critical') {
          const errorArg = args.find((arg) => arg instanceof Error);
          if (errorArg instanceof Error) {
            metadata.exception = serializeError(errorArg);
          }
        }

        // Log to LogTide
        this.log({
          service: config.service!,
          level,
          message,
          metadata,
        });
      };
    };

    // Replace console methods
    console.log = createInterceptor('log', 'info');
    console.info = createInterceptor('info', 'info');
    console.warn = createInterceptor('warn', 'warn');
    console.error = createInterceptor('error', 'error');
    console.debug = createInterceptor('debug', 'debug');

    if (this.debugMode) {
      this.originalConsole.log('[LogTide] Console interception started');
    }
  }

  /**
   * Stop intercepting console methods and restore originals
   */
  stopConsoleInterception() {
    if (!this.originalConsole) {
      return;
    }

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    if (this.debugMode) {
      console.log('[LogTide] Console interception stopped');
    }

    this.originalConsole = null;
    this.consoleInterceptOptions = null;
  }

  /**
   * Check if console interception is active
   */
  isConsoleInterceptionActive(): boolean {
    return this.originalConsole !== null;
  }

  // ==================== Payload Processing ====================

  /**
   * Check if a string looks like base64 encoded data
   */
  private looksLikeBase64(str: string): boolean {
    if (typeof str !== 'string' || str.length < 100) return false;
    // Check for common base64 patterns: data URLs or long base64 strings
    if (str.startsWith('data:')) return true;
    // Check if it's a long string with only base64 characters
    const base64Regex = /^[A-Za-z0-9+/=]{100,}$/;
    return base64Regex.test(str.replace(/\s/g, ''));
  }

  /**
   * Process a value for payload limits (truncation, base64 removal, etc.)
   */
  private processValue(value: unknown, fieldPath: string): unknown {
    // Check if this field should be excluded
    const fieldName = fieldPath.split('.').pop() || fieldPath;
    if (this.payloadLimits.excludeFields.includes(fieldName)) {
      return '[EXCLUDED]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      // Check for base64 data
      if (this.looksLikeBase64(value)) {
        return '[BASE64 DATA REMOVED]';
      }
      // Truncate if too long
      if (value.length > this.payloadLimits.maxFieldSize) {
        return value.substring(0, this.payloadLimits.maxFieldSize) + this.payloadLimits.truncationMarker;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => this.processValue(item, `${fieldPath}[${index}]`));
    }

    if (typeof value === 'object') {
      const processed: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        processed[key] = this.processValue(val, `${fieldPath}.${key}`);
      }
      return processed;
    }

    return value;
  }

  /**
   * Process metadata to apply payload limits
   */
  private processMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!metadata) return metadata;
    return this.processValue(metadata, 'metadata') as Record<string, unknown>;
  }

  /**
   * Ensure log entry doesn't exceed max size
   */
  private enforceMaxLogSize(entry: InternalLogEntry): InternalLogEntry {
    const serialized = JSON.stringify(entry);
    if (serialized.length <= this.payloadLimits.maxLogSize) {
      return entry;
    }

    // Log is too large, progressively truncate metadata
    if (this.debugMode) {
      console.warn(`[LogTide] Log entry too large (${serialized.length} bytes), truncating metadata`);
    }

    // Create a copy and truncate metadata heavily
    const truncated: InternalLogEntry = {
      ...entry,
      metadata: {
        _truncated: true,
        _originalSize: serialized.length,
        message: entry.message,
      },
    };

    return truncated;
  }

  // ==================== Logging Methods ====================

  private startFlushTimer() {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  log(entry: LogEntry) {
    // Check buffer size limit
    if (this.buffer.length >= this.maxBufferSize) {
      this.metrics.logsDropped++;
      if (this.debugMode) {
        console.warn(`[LogTide] Buffer full, dropping log: ${entry.message}`);
      }
      return;
    }

    // Determine trace_id: use entry's trace_id, current context, or auto-generate if enabled
    const traceId = entry.trace_id || this.currentTraceId || (this.autoTraceId ? randomUUID() : undefined);

    // Merge and process metadata (applies truncation, exclusion, base64 removal)
    const mergedMetadata = {
      ...this.globalMetadata,
      ...entry.metadata,
    };
    const processedMetadata = this.processMetadata(mergedMetadata);

    let internalEntry: InternalLogEntry = {
      ...entry,
      time: entry.time || new Date().toISOString(),
      metadata: processedMetadata,
      trace_id: traceId,
    };

    // Enforce max log size
    internalEntry = this.enforceMaxLogSize(internalEntry);

    this.buffer.push(internalEntry);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  debug(service: string, message: string, metadata?: Record<string, unknown>) {
    this.log({ service, level: 'debug', message, metadata });
  }

  info(service: string, message: string, metadata?: Record<string, unknown>) {
    this.log({ service, level: 'info', message, metadata });
  }

  warn(service: string, message: string, metadata?: Record<string, unknown>) {
    this.log({ service, level: 'warn', message, metadata });
  }

  error(service: string, message: string, metadataOrError?: Record<string, unknown> | Error) {
    let metadata: Record<string, unknown> = {};

    if (metadataOrError instanceof Error) {
      metadata = { exception: serializeError(metadataOrError) };
    } else if (metadataOrError) {
      metadata = metadataOrError;
    }

    this.log({ service, level: 'error', message, metadata });
  }

  critical(service: string, message: string, metadataOrError?: Record<string, unknown> | Error) {
    let metadata: Record<string, unknown> = {};

    if (metadataOrError instanceof Error) {
      metadata = { exception: serializeError(metadataOrError) };
    } else if (metadataOrError) {
      metadata = metadataOrError;
    }

    this.log({ service, level: 'critical', message, metadata });
  }

  // ==================== Flush with Retry & Circuit Breaker ====================

  async flush() {
    if (this.buffer.length === 0) return;

    // Check circuit breaker
    if (!this.circuitBreaker.canAttempt()) {
      this.metrics.circuitBreakerTrips++;
      if (this.debugMode) {
        console.warn('[LogTide] Circuit breaker OPEN, skipping flush');
      }
      return;
    }

    const logs = [...this.buffer];
    this.buffer = [];

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({ logs }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Success
        this.circuitBreaker.recordSuccess();
        this.metrics.logsSent += logs.length;

        if (this.enableMetrics) {
          const latency = Date.now() - startTime;
          this.latencies.push(latency);
          if (this.latencies.length > 100) {
            this.latencies.shift();
          }
          this.metrics.avgLatencyMs =
            this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
        }

        if (this.debugMode) {
          console.log(`[LogTide] Sent ${logs.length} logs successfully`);
        }

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.metrics.errors++;

        if (attempt < this.maxRetries) {
          this.metrics.retries++;
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          if (this.debugMode) {
            console.warn(
              `[LogTide] Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms: ${lastError.message}`,
            );
          }
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - drop logs to prevent infinite retry loop
    this.circuitBreaker.recordFailure();
    this.metrics.logsDropped += logs.length;

    if (this.debugMode) {
      console.error(`[LogTide] Failed to send ${logs.length} logs after ${this.maxRetries} retries, dropping them:`, lastError);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== Query Methods ====================

  async query(options: QueryOptions = {}): Promise<LogsResponse> {
    const params = new URLSearchParams();

    if (options.service) params.append('service', options.service);
    if (options.level) params.append('level', options.level);
    if (options.from) {
      const from = options.from instanceof Date ? options.from.toISOString() : options.from;
      params.append('from', from);
    }
    if (options.to) {
      const to = options.to instanceof Date ? options.to.toISOString() : options.to;
      params.append('to', to);
    }
    if (options.q) params.append('q', options.q);
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));

    const url = `${this.apiUrl}/api/v1/logs?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Query failed: HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as LogsResponse;
  }

  async getByTraceId(traceId: string): Promise<InternalLogEntry[]> {
    const url = `${this.apiUrl}/api/v1/logs/trace/${traceId}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get by trace ID failed: HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { logs?: InternalLogEntry[] };
    return data.logs || [];
  }

  async getAggregatedStats(options: AggregatedStatsOptions): Promise<AggregatedStatsResponse> {
    const params = new URLSearchParams();

    const from = options.from instanceof Date ? options.from.toISOString() : options.from;
    const to = options.to instanceof Date ? options.to.toISOString() : options.to;

    params.append('from', from);
    params.append('to', to);
    if (options.interval) params.append('interval', options.interval);
    if (options.service) params.append('service', options.service);

    const url = `${this.apiUrl}/api/v1/logs/aggregated?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Get aggregated stats failed: HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as AggregatedStatsResponse;
  }

  // ==================== Live Tail (SSE) ====================

  stream(options: StreamOptions): () => void {
    const params = new URLSearchParams();
    params.append('token', this.apiKey);
    if (options.service) params.append('service', options.service);
    if (options.level) params.append('level', options.level);

    const url = `${this.apiUrl}/api/v1/logs/stream?${params.toString()}`;

    const eventSource = new EventSource(url);

    eventSource.addEventListener('log', (event: Event) => {
      try {
        const messageEvent = event as MessageEvent;
        const log = JSON.parse(messageEvent.data) as InternalLogEntry;
        options.onLog(log);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        options.onError?.(err);
      }
    });

    eventSource.addEventListener('error', () => {
      const error = new Error('SSE connection error');
      options.onError?.(error);
    });

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  // ==================== Metrics ====================

  getMetrics(): ClientMetrics {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics = {
      logsSent: 0,
      logsDropped: 0,
      errors: 0,
      retries: 0,
      avgLatencyMs: 0,
      circuitBreakerTrips: 0,
    };
    this.latencies = [];
  }

  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  // ==================== Cleanup ====================

  async close() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopConsoleInterception();
    await this.flush();
  }
}

export default LogTideClient;
