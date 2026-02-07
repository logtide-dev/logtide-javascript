export type BreadcrumbType =
  | 'http'
  | 'navigation'
  | 'ui'
  | 'console'
  | 'error'
  | 'query'
  | 'custom';

export interface Breadcrumb {
  type: BreadcrumbType;
  category?: string;
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  timestamp: number;
  data?: Record<string, unknown>;
}
