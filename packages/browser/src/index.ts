// Initialization
export {
  initLogtide,
  buildBrowserIntegrations,
  buildBrowserTransportWrapper,
  type InitLogtideExtraOptions,
} from './init';

// React error boundary (requires the optional `react` peer dependency)
export { LogtideErrorBoundary } from './error-boundary';

// Session
export { getSessionId, resetSessionId } from './session';

// Integrations
export { WebVitalsIntegration } from './integrations/web-vitals';
export { ClickBreadcrumbIntegration } from './integrations/click-breadcrumbs';
export { NetworkBreadcrumbIntegration } from './integrations/network-breadcrumbs';

// Transport
export { OfflineTransport, type OfflineTransportOptions } from './transport/offline-transport';

// Types
export type {
  BrowserClientOptions,
  BrowserOptions,
  ClickBreadcrumbOptions,
  NetworkBreadcrumbOptions,
} from './types';
