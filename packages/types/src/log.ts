export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  service: string;
  level: LogLevel;
  message: string;
  time?: string;
  metadata?: Record<string, unknown>;
  trace_id?: string;
  span_id?: string;
  breadcrumbs?: import('./breadcrumb').Breadcrumb[];
}

export interface InternalLogEntry extends LogEntry {
  time: string;
}
