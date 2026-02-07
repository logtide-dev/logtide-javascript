import { hub } from '@logtide/core';

/**
 * Track client-side navigation as breadcrumbs.
 * Call this once from a layout component or a client-side init module.
 *
 * @example
 * ```ts
 * // app/layout.tsx (client component)
 * 'use client';
 * import { useEffect } from 'react';
 * import { trackNavigation } from '@logtide/nextjs/client';
 *
 * export default function Layout({ children }) {
 *   useEffect(() => trackNavigation(), []);
 *   return <>{children}</>;
 * }
 * ```
 */
export function trackNavigation(): () => void {
  if (typeof window === 'undefined') return () => {};

  let currentUrl = window.location.href;

  const handler = () => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      hub.addBreadcrumb({
        type: 'navigation',
        category: 'navigation',
        message: `Navigated to ${newUrl}`,
        timestamp: Date.now(),
        data: { from: currentUrl, to: newUrl },
      });
      currentUrl = newUrl;
    }
  };

  // Listen to popstate (back/forward) and pushstate/replacestate
  window.addEventListener('popstate', handler);

  // Monkey-patch pushState/replaceState
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    origPush(...args);
    handler();
  };
  history.replaceState = function (...args) {
    origReplace(...args);
    handler();
  };

  return () => {
    window.removeEventListener('popstate', handler);
    history.pushState = origPush;
    history.replaceState = origReplace;
  };
}
