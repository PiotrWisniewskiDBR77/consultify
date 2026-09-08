/**
 * auth-401-po-resecie (2026-09-08): a small handoff so the login screen can
 * explain WHY the user landed there.
 *
 * `RouterSync` (src/components/RouterSync.tsx) is the single authority for
 * the "not authenticated on a protected route -> /login?redirect=..."
 * redirect: it reacts to `currentUser.isAuthenticated` flipping to false and
 * fires its own `navigate(...)`, which races with (and overwrites) any
 * `navigate('/login?reason=...')` called from elsewhere in that same React
 * commit — e.g. `App.tsx`'s `auth:token-expired` handler, which runs on a
 * sibling effect and loses that race whenever the user was sitting on an
 * already-mounted protected screen. Rather than fight RouterSync for the
 * navigation, callers drop a short-lived reason here right before ending the
 * local session; RouterSync itself reads (and clears) it when it builds the
 * login redirect, appending `&reason=...` to its own `redirect=` URL.
 *
 * Session-scoped (survives a redirect, not a fresh tab) and short-lived
 * (ignored past MAX_AGE_MS) so a flag from a much earlier session can never
 * leak into an unrelated later redirect.
 */

const STORAGE_KEY = 'consultify:pendingLoginRedirectReason:v1';
const MAX_AGE_MS = 10_000;

export function setPendingLoginRedirectReason(reason: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ reason, ts: Date.now() }));
  } catch {
    // ignore storage failures — worst case the login screen shows no banner
  }
}

/** Reads and clears the pending reason. Returns null if absent, malformed, or stale. */
export function consumePendingLoginRedirectReason(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as { reason?: unknown; ts?: unknown };
    if (typeof parsed.reason !== 'string' || !parsed.reason) return null;
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed.reason;
  } catch {
    return null;
  }
}
