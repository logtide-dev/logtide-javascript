export interface BrowserOptions {
  /** Enable session context (default: true) */
  sessionTracking?: boolean;

  /** Enable Core Web Vitals collection (default: false, requires web-vitals peer dep) */
  webVitals?: boolean;

  /** Sample rate for Web Vitals (0.0-1.0, default: 1.0) */
  webVitalsSampleRate?: number;

  /** Enable click/input breadcrumbs (default: true) */
  clickBreadcrumbs?: boolean | ClickBreadcrumbOptions;

  /** Enable network breadcrumbs (default: true) */
  networkBreadcrumbs?: boolean | NetworkBreadcrumbOptions;

  /** Enable offline resilience (default: true) */
  offlineResilience?: boolean;
}

export interface ClickBreadcrumbOptions {
  /** Max length for element text content (default: 200) */
  maxTextLength?: number;
}

export interface NetworkBreadcrumbOptions {
  /** Include query params in captured URLs (default: false) */
  captureQueryParams?: boolean;
  /** URL patterns to ignore (default: [logtide API URL]) */
  denyUrls?: (string | RegExp)[];
}
