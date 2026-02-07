import type { InternalLogEntry } from './log';
import type { Span } from './span';

export interface Transport {
  sendLogs(logs: InternalLogEntry[]): Promise<void>;
  sendSpans?(spans: Span[]): Promise<void>;
  flush(): Promise<void>;
}
