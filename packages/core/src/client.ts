import type {
  Breadcrumb,
  Client as IClient,
  ClientOptions,
  InternalLogEntry,
  Integration,
  LogLevel,
  Span,
  SpanAttributes,
  SpanEvent,
  Transport,
} from '@logtide/types';
import { resolveDSN } from './dsn';
import { Scope } from './scope';
import { SpanManager, type StartSpanOptions } from './span-manager';
import { BreadcrumbBuffer } from './breadcrumb-buffer';
import { serializeError } from './utils/error-serializer';
import { generateTraceId } from './utils/trace-id';
import { LogtideHttpTransport } from './transport/logtide-http';
import { OtlpHttpTransport } from './transport/otlp-http';
import { BatchTransport } from './transport/batch';

/**
 * Composite transport that sends logs via LogTide HTTP and spans via OTLP.
 */
class DefaultTransport implements Transport {
  private logTransport: BatchTransport;
  private spanTransport: BatchTransport;

  constructor(options: ClientOptions) {
    const dsn = resolveDSN(options);

    this.logTransport = new BatchTransport({
      inner: new LogtideHttpTransport(dsn),
      batchSize: options.batchSize,
      flushInterval: options.flushInterval,
      maxBufferSize: options.maxBufferSize,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      circuitBreakerThreshold: options.circuitBreakerThreshold,
      circuitBreakerResetMs: options.circuitBreakerResetMs,
      debug: options.debug,
    });

    this.spanTransport = new BatchTransport({
      inner: new OtlpHttpTransport(dsn, options.service || 'unknown', {
        environment: options.environment,
        release: options.release,
      }),
      batchSize: options.batchSize,
      flushInterval: options.flushInterval,
      maxBufferSize: options.maxBufferSize,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      circuitBreakerThreshold: options.circuitBreakerThreshold,
      circuitBreakerResetMs: options.circuitBreakerResetMs,
      debug: options.debug,
    });
  }

  async sendLogs(logs: InternalLogEntry[]): Promise<void> {
    await this.logTransport.sendLogs(logs);
  }

  async sendSpans(spans: Span[]): Promise<void> {
    await this.spanTransport.sendSpans(spans);
  }

  async flush(): Promise<void> {
    await Promise.all([this.logTransport.flush(), this.spanTransport.flush()]);
  }

  destroy(): void {
    this.logTransport.destroy();
    this.spanTransport.destroy();
  }
}

export class LogtideClient implements IClient {
  private options: ClientOptions;
  private transport: Transport & { destroy?: () => void };
  private spanManager = new SpanManager();
  private globalBreadcrumbs: BreadcrumbBuffer;
  private integrations: Integration[] = [];
  private _isInitialized = false;

  constructor(options: ClientOptions) {
    this.options = options;
    this.globalBreadcrumbs = new BreadcrumbBuffer(options.maxBreadcrumbs ?? 100);

    let transport: Transport & { destroy?: () => void };
    if (options.transport) {
      transport = options.transport;
    } else {
      transport = new DefaultTransport(options);
    }
    if (options.transportWrapper) {
      transport = options.transportWrapper(transport) as Transport & { destroy?: () => void };
    }
    this.transport = transport;

    // Install integrations
    if (options.integrations) {
      for (const integration of options.integrations) {
        this.addIntegration(integration);
      }
    }

    this._isInitialized = true;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get service(): string | undefined {
    return this.options.service;
  }

  get environment(): string | undefined {
    return this.options.environment;
  }

  get release(): string | undefined {
    return this.options.release;
  }

  private resolveService(scope?: Scope): string {
    return scope?.service || this.options.service || 'unknown';
  }

  // ─── Logging ───────────────────────────────────────────

  captureLog(
    level: LogLevel | string,
    message: string,
    metadata?: Record<string, unknown>,
    scope?: Scope,
  ): void {
    // Merge scope breadcrumbs with client-level breadcrumbs (from integrations).
    // Integrations call client.addBreadcrumb() directly, which writes to globalBreadcrumbs.
    // Hub calls also write to the scope. Deduplicate by using the larger set,
    // which is always globalBreadcrumbs since it receives from both paths.
    const breadcrumbs = this.globalBreadcrumbs.getAll();

    const entry: InternalLogEntry = {
      service: this.resolveService(scope),
      level: level as LogLevel,
      message,
      time: new Date().toISOString(),
      metadata: {
        ...metadata,
        ...(this.options.environment ? { environment: this.options.environment } : {}),
        ...(this.options.release ? { release: this.options.release } : {}),
        ...(scope ? { tags: scope.tags, ...scope.extras } : {}),
        ...(breadcrumbs.length > 0 ? { breadcrumbs } : {}),
      },
      trace_id: scope?.traceId,
      span_id: scope?.spanId,
      session_id: scope?.sessionId,
    };

    this.transport.sendLogs([entry]);
  }

  captureError(
    error: unknown,
    metadata?: Record<string, unknown>,
    scope?: Scope,
  ): void {
    const serialized = serializeError(error);

    this.captureLog(
      'error',
      serialized.message,
      { exception: serialized, ...metadata },
      scope,
    );
  }

  // ─── Breadcrumbs ───────────────────────────────────────

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.globalBreadcrumbs.add(breadcrumb);
  }

  getBreadcrumbs(): Breadcrumb[] {
    return this.globalBreadcrumbs.getAll();
  }

  // ─── Spans ─────────────────────────────────────────────

  startSpan(options: StartSpanOptions): Span {
    const rate = this.options.tracesSampleRate ?? 1.0;
    if (Math.random() > rate) {
      // Return a no-op span that won't be recorded
      return {
        traceId: options.traceId ?? generateTraceId(),
        spanId: '0000000000000000',
        name: options.name,
        status: 'unset',
        startTime: Date.now(),
        attributes: options.attributes ?? {},
      };
    }
    return this.spanManager.startSpan(options);
  }

  finishSpan(
    spanId: string,
    status: 'ok' | 'error' = 'ok',
    options?: { extraAttributes?: SpanAttributes; events?: SpanEvent[] },
  ): void {
    const span = this.spanManager.finishSpan(spanId, status, options);
    if (span && this.transport.sendSpans) {
      this.transport.sendSpans([span]);
    }
  }

  /**
   * Start a child span under the given scope.
   */
  startChildSpan(name: string, scope: Scope, attributes?: SpanAttributes): Span {
    return this.startSpan({
      name,
      traceId: scope.traceId,
      parentSpanId: scope.spanId,
      attributes,
    });
  }

  /**
   * Finish a child span by ID.
   */
  finishChildSpan(
    spanId: string,
    status: 'ok' | 'error' = 'ok',
    options?: { extraAttributes?: SpanAttributes; events?: SpanEvent[] },
  ): void {
    this.finishSpan(spanId, status, options);
  }

  // ─── Integrations ─────────────────────────────────────

  addIntegration(integration: Integration): void {
    integration.setup(this);
    this.integrations.push(integration);
  }

  // ─── Scope helpers ────────────────────────────────────

  createScope(traceId?: string): Scope {
    return new Scope(traceId ?? generateTraceId(), this.options.maxBreadcrumbs ?? 100);
  }

  // ─── Lifecycle ────────────────────────────────────────

  async flush(): Promise<void> {
    await this.transport.flush();
  }

  async close(): Promise<void> {
    for (const integration of this.integrations) {
      integration.teardown?.();
    }
    this.integrations = [];
    await this.flush();
    if ('destroy' in this.transport && typeof this.transport.destroy === 'function') {
      this.transport.destroy();
    }
    this._isInitialized = false;
  }
}
