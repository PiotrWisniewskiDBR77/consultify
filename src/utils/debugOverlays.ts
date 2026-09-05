/**
 * Shared gate for the small admin/dev diagnostic chrome pinned to the
 * bottom-right corner of every screen (`EnvironmentBadge`,
 * `ChatV9FlagsIndicator`).
 *
 * 2026-09-05: these overlays are admin/owner-only, but they rendered on
 * *every* screen the admin/owner opened — noise on otherwise clean
 * screens during MVP acceptance review. They now render only in local
 * Vite dev (`import.meta.env.DEV`) or after an explicit opt-in via the
 * `?debug=1` query param. The opt-in is persisted in `sessionStorage`
 * so it survives client-side navigation within the same tab; `?debug=0`
 * clears it again.
 */

export const DEBUG_OVERLAYS_SESSION_KEY = 'consultify.debugOverlays';

function readDebugParam(): '0' | '1' | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('debug');
    return value === '1' || value === '0' ? value : null;
  } catch {
    return null;
  }
}

/**
 * True when this tab has explicitly opted into debug chrome via
 * `?debug=1` (persisted for the rest of the tab session), and has not
 * since opted out via `?debug=0`. Does NOT consider
 * `import.meta.env.DEV` — callers that need to bypass this for admins
 * only (as opposed to any visitor who guesses the query param) combine
 * it with their own authorization check.
 */
export function isDebugOverlaysOptedIn(): boolean {
  if (typeof window === 'undefined') return false;

  const param = readDebugParam();
  try {
    if (param === '1') {
      window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
      return true;
    }
    if (param === '0') {
      window.sessionStorage.removeItem(DEBUG_OVERLAYS_SESSION_KEY);
      return false;
    }
    return window.sessionStorage.getItem(DEBUG_OVERLAYS_SESSION_KEY) === '1';
  } catch {
    // Private browsing / storage blocked: fall back to URL-only, no persistence.
    return param === '1';
  }
}

/**
 * True when debug chrome should render at all in this runtime: local
 * Vite dev, or an explicit `?debug=1` opt-in. Convenience for callers
 * that already gate on authorization separately (so the opt-in itself
 * needs no further role check here).
 */
export function shouldShowDebugOverlays(): boolean {
  return import.meta.env.DEV || isDebugOverlaysOptedIn();
}
