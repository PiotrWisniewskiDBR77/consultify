/**
 * CSRF client interceptor — Faza 1
 * (evidence/sec-20260905/03_CSRF_MFA_PROPOZYCJA.md, 04_CSRF_FAZA1_RAPORT.md)
 *
 * The backend's `csrfProtectionMiddleware` (server/src/middleware/csrf.middleware.ts)
 * validates a double-submit cookie against an `x-csrf-token` header on every
 * mutating `/api/*` request, but only ACTS on it (log in "report" mode, 403
 * in "enforce" mode) when `CSRF_MODE` is set — default is "off", meaning this
 * module changes nothing observable until the server opts in.
 *
 * Rather than touching the ~1300 existing `fetch()`/`fetchWithRetry()` call
 * sites across src/services (most of which build headers via one of the two
 * `getHeaders()` implementations in services/api.ts and services/api/baseClient.ts),
 * this installs a single `window.fetch` wrapper — the same pattern already
 * used by services/feedbackCollector/NetworkBuffer.ts — that transparently
 * attaches the header to every mutating same-origin `/api/` request. Reads
 * (GET/HEAD/OPTIONS) are left untouched.
 */

export const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_ENDPOINT = '/api/csrf-token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let cachedToken: string | null = null;
let pendingFetch: Promise<string | null> | null = null;
let installed = false;

function isMutatingMethod(method: string | undefined): boolean {
  return !!method && MUTATING_METHODS.has(method.toUpperCase());
}

function resolveMethod(input: RequestInfo | URL, init: RequestInit | undefined): string {
  if (init?.method) return String(init.method).toUpperCase();
  try {
    if (typeof input === 'object' && input && 'method' in (input as Request)) {
      const m = (input as Request).method;
      if (m) return String(m).toUpperCase();
    }
  } catch {
    // ignore
  }
  return 'GET';
}

function resolveUrl(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (typeof (input as Request).url === 'string') return (input as Request).url;
  } catch {
    // ignore
  }
  return '';
}

/**
 * Only same-origin `/api/*` requests carry the header — this is the only
 * surface `csrfProtectionMiddleware` validates, and we must never leak the
 * token to a third-party origin (e.g. a signed upload URL or external
 * webhook test tool the app might fetch()).
 */
function isSameOriginApiRequest(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const resolved = new URL(url, window.location.origin);
    return resolved.origin === window.location.origin && resolved.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

async function ensureCsrfToken(nativeFetch: typeof fetch): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (pendingFetch) return pendingFetch;

  pendingFetch = nativeFetch(CSRF_TOKEN_ENDPOINT, { method: 'GET', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const token = data && typeof data.token === 'string' ? data.token : null;
      cachedToken = token;
      return token;
    })
    .catch(() => null)
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
}

/** Drop the cached token so the next mutating request re-fetches a fresh one. */
export function resetCsrfTokenCache(): void {
  cachedToken = null;
  pendingFetch = null;
}

async function maybeResetOnCsrfInvalid(response: Response): Promise<void> {
  if (response.status !== 403) return;
  try {
    const body = await response.clone().json();
    if (body && body.code === 'CSRF_INVALID') {
      resetCsrfTokenCache();
    }
  } catch {
    // Not a CSRF JSON body (or no body) — nothing to do. Best-effort only,
    // must never throw and never alter the response the caller sees.
  }
}

/**
 * Installs the fetch interceptor once. Safe to call multiple times (no-op
 * after the first). Wraps whatever `window.fetch` currently is, so install
 * order relative to other wrappers (e.g. installNetworkBuffer) doesn't
 * matter — each layers on top of the previous one.
 */
export function installCsrfFetchInterceptor(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = resolveMethod(input, init);
    const url = resolveUrl(input);

    if (!isMutatingMethod(method) || !isSameOriginApiRequest(url)) {
      return nativeFetch(input, init);
    }

    const token = await ensureCsrfToken(nativeFetch);

    let headers: Headers;
    try {
      headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    } catch {
      headers = new Headers();
    }
    if (token && !headers.has(CSRF_HEADER_NAME)) {
      headers.set(CSRF_HEADER_NAME, token);
    }

    const response = await nativeFetch(input, { ...init, headers });
    await maybeResetOnCsrfInvalid(response);
    return response;
  };
}

/** Test-only: undo installation so unit tests get a clean window.fetch. */
export function __resetCsrfFetchInterceptorForTests(): void {
  installed = false;
  cachedToken = null;
  pendingFetch = null;
}
