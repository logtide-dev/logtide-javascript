/**
 * Lightweight session context — random UUID per page load.
 * Stored in sessionStorage so it persists across SPA navigations
 * but NOT across tabs or browser sessions.
 * No fingerprinting, no persistent tracking.
 */

const SESSION_KEY = '__logtide_session_id';

let cachedSessionId: string | null = null;

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  if (typeof sessionStorage !== 'undefined') {
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) {
        cachedSessionId = existing;
        return existing;
      }
    } catch {
      // sessionStorage not available (e.g. SSR, iframe sandbox)
    }
  }

  const id = crypto.randomUUID();
  cachedSessionId = id;

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch {
      // quota exceeded or not available
    }
  }

  return id;
}

/** Reset cached session ID (useful for testing) */
export function resetSessionId(): void {
  cachedSessionId = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // not available
    }
  }
}
