/**
 * Global 401 guard for API calls that bypass `tokenService`'s own fetch
 * wrappers.
 *
 * Context (auth-401-po-resecie, 2026-09-08): `src/services/api.ts`,
 * `src/services/api/baseClient.ts` and `src/services/apiUtils.ts` all already
 * detect a 401, try a token refresh, and — if that also fails — dispatch
 * `auth:token-expired` (consumed by `App.tsx`, which now clears the local
 * session and redirects to `/login?reason=session_expired`). But several
 * modules call `fetch()` directly and rely purely on the httpOnly auth
 * cookie (no `Authorization` header, no retry) —
 * e.g. `src/services/initiatives-execution/runtimeApi.ts`. Those call sites
 * never touched any of the above machinery, so once the server revoked a
 * session (e.g. right after a password reset — `POST /api/auth/reset-password`
 * calls `refreshTokenService.revokeAllUserTokens` and clears cookies), every
 * one of their requests kept returning 401 forever while the UI still showed
 * the user as logged in (`currentUser` lives in a separately-persisted
 * Zustand store, untouched by a failed fetch).
 *
 * Rather than rewriting every direct-fetch call site (out of scope for a
 * minimal fix, and there is no single shared client to change), this patches
 * `window.fetch` ONCE, at app boot, to observe (never alter) the response and
 * feed an unhandled 401 on a protected `/api/*` path into the EXISTING
 * `tokenService` recovery chain via the `auth-error` event
 * (`tokenService.ts` already listens for it and is storm-safe: cooldown,
 * in-flight de-dup, and the auth-loop guard all already live there — this
 * file adds no new throttling logic on purpose).
 */

const PATCHED_FLAG = '__consultifyGlobalAuthFetchGuardInstalled__';

// Endpoints that legitimately return 401 as part of normal, unauthenticated
// operation (login attempt, token refresh itself, logout, health checks) —
// must never feed the recovery loop, or a failed login could look like a
// stale-session redirect, or refresh-triggered-by-refresh could loop.
const AUTH_ALLOWLIST_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/health',
  '/api/ready',
];

function resolveSameOriginApiPath(input: RequestInfo | URL): string | null {
  try {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function isAllowlisted(path: string): boolean {
  return AUTH_ALLOWLIST_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Installs the guard exactly once per page load. Safe to call multiple
 * times (idempotent) and safe in environments without `fetch`/`window`
 * (SSR/tests).
 */
export function installGlobalAuthFetchGuard(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const globalWindow = window as typeof window & { [PATCHED_FLAG]?: boolean };
  if (globalWindow[PATCHED_FLAG]) return;
  globalWindow[PATCHED_FLAG] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await originalFetch(...args);
    try {
      if (response.status === 401) {
        const path = resolveSameOriginApiPath(args[0]);
        if (path && path.startsWith('/api/') && !isAllowlisted(path)) {
          window.dispatchEvent(new CustomEvent('auth-error'));
        }
      }
    } catch {
      // Never let the guard's own bookkeeping break the real response.
    }
    return response;
  }) as typeof fetch;
}
