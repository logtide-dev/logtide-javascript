// Re-export all types
export type {
  LogLevel,
  LogEntry,
  InternalLogEntry,
  Span,
  SpanStatus,
  SpanAttributes,
  Breadcrumb,
  BreadcrumbType,
  Transport,
  Integration,
  Client,
  ClientOptions,
  DSN,
} from '@logtide/types';

// Core classes
export { LogtideClient } from './client';
export { hub } from './hub';
export { Scope } from './scope';
export { SpanManager, type StartSpanOptions } from './span-manager';
export { BreadcrumbBuffer } from './breadcrumb-buffer';

// DSN
export { parseDSN, resolveDSN } from './dsn';

// Transports
export { LogtideHttpTransport } from './transport/logtide-http';
export { OtlpHttpTransport } from './transport/otlp-http';
export { BatchTransport, type BatchTransportOptions } from './transport/batch';

// Utils
export { serializeError, type StructuredException, type StructuredStackFrame } from './utils/error-serializer';
export { generateTraceId, generateSpanId } from './utils/trace-id';
export { CircuitBreaker } from './utils/circuit-breaker';
export { parseTraceparent, createTraceparent, type TraceContext } from './utils/w3c-trace-context';

// Integrations
export { ConsoleIntegration } from './integrations/console';
export { GlobalErrorIntegration } from './integrations/global-error';
