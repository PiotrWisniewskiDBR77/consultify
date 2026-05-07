/**
 * subscriberDashboardClient
 *
 * Browser-side client for the read-only Subscriber Dashboard surface
 * exposed by the Sprint 13 backend (`presentationSubscriberDashboardService`).
 *
 * Three responsibilities:
 *
 *   1. `fetchSubscriberDashboard` — GET
 *      `/api/presentations/governance/subscriber/dashboard` with a Bearer
 *      token. Never throws. Always resolves with a closed-enum `status`
 *      so the UI can branch honestly on `unauthorized | forbidden |
 *      rate_limited | storage_unavailable | network_error | ok`.
 *      Validates the response payload before returning.
 *
 *   2. `sessionTokenStore` — sessionStorage-only (NEVER localStorage)
 *      bag for the raw 64-hex Bearer token. The token is held only in
 *      this tab and is wiped on tab close. SSR-safe (`typeof window`
 *      guard) so server-side renders/snapshots never touch storage.
 *
 *   3. `extractTokenFromHash` / `scrubTokenFromHash` — entry-point
 *      helpers. Subscribers receive a deep link like
 *      `https://…/subscriber/dashboard#token=<64hex>`; we parse the
 *      hash, save the token, and immediately scrub the URL so the
 *      token does not linger in browser history or screenshots.
 *
 * Privacy & threat model:
 *   - Raw token NEVER persisted to localStorage, cookies, or any
 *     long-lived store. sessionStorage only.
 *   - URL hash scrubbed via `history.replaceState` immediately after
 *     capture.
 *   - Token format is enforced (64 lowercase hex) at the storage gate
 *     so a paste of "Bearer xxx" / surrounding whitespace / random
 *     gibberish is rejected without ever being persisted.
 *   - The fetch path is fixed; no other network call leaks the token.
 */

// ============================================================================
// TYPES (mirror SubscriberDashboardSnapshot from the backend service)
// ============================================================================

export type SubscriberFetchStatus =
  | 'ok'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'storage_unavailable'
  | 'network_error';

export type SubscriberHealthOverall = 'healthy' | 'degraded' | 'unhealthy';
export type SubscriberDispatchStatus = 'sent' | 'failed' | 'suppressed' | 'dry_run';

export interface ClientSubscriberSnapshot {
  subscription: {
    id: string;
    channel: string;
    /** Already masked server-side (e.g. `https://hooks.sl****abcd`). */
    target: string;
    minSeverity: string;
    active: boolean;
    secretRotatedAt: string | null;
  };
  signature: {
    algorithm: 'HMAC-SHA256';
    secretLastRotatedAt: string | null;
    daysSinceRotation: number | null;
    rotationDueWithinDays: number | null;
  };
  delivery: {
    last7Days: { sent: number; failed: number; suppressed: number; dryRun: number };
    last30Days: { sent: number; failed: number; suppressed: number; dryRun: number };
    lastDispatchAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
  };
  recentDispatches: Array<{
    id: string;
    dispatchedAt: string;
    status: SubscriberDispatchStatus;
    httpStatus: number | null;
    toVerdict: string;
    deckIdMasked: string;
    signaturePresent: boolean;
    signatureAlgorithm: string | null;
  }>;
  health: {
    overall: SubscriberHealthOverall;
    reasons: string[];
  };
  warnings: string[];
}

export interface FetchOptions {
  token: string;
  /** Optional override for white-label / embeddable hosts. Defaults to '' (same-origin). */
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface FetchResult {
  status: SubscriberFetchStatus;
  data?: ClientSubscriberSnapshot;
  reason?: string;
}

export interface SessionTokenStore {
  getToken(): string | null;
  saveToken(rawToken: string): void;
  clearToken(): void;
  hasToken(): boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUBSCRIBER_TOKEN_REGEX = /^[a-f0-9]{64}$/;
export const SUBSCRIBER_TOKEN_STORAGE_KEY = 'consultify_subscriber_token';
export const SUBSCRIBER_DASHBOARD_PATH =
  '/api/presentations/governance/subscriber/dashboard';

const ALLOWED_DISPATCH_STATUSES: ReadonlySet<SubscriberDispatchStatus> = new Set<
  SubscriberDispatchStatus
>(['sent', 'failed', 'suppressed', 'dry_run']);

const ALLOWED_HEALTH_OVERALL: ReadonlySet<SubscriberHealthOverall> = new Set<
  SubscriberHealthOverall
>(['healthy', 'degraded', 'unhealthy']);

// ============================================================================
// PURE HELPERS
// ============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// ============================================================================
// PAYLOAD VALIDATION
// ============================================================================

interface AggregateShape {
  sent: number;
  failed: number;
  suppressed: number;
  dryRun: number;
}

function normalizeAggregate(raw: unknown): AggregateShape {
  const r = isRecord(raw) ? raw : {};
  return {
    sent: asNumber(r.sent),
    failed: asNumber(r.failed),
    suppressed: asNumber(r.suppressed),
    dryRun: asNumber(r.dryRun),
  };
}

function normalizeDispatch(
  raw: unknown
): ClientSubscriberSnapshot['recentDispatches'][number] | null {
  if (!isRecord(raw)) return null;
  const status =
    typeof raw.status === 'string' &&
    ALLOWED_DISPATCH_STATUSES.has(raw.status as SubscriberDispatchStatus)
      ? (raw.status as SubscriberDispatchStatus)
      : null;
  if (!status) return null;
  const dispatchedAt = asString(raw.dispatchedAt, '');
  if (!dispatchedAt) return null;
  return {
    id: asString(raw.id, ''),
    dispatchedAt,
    status,
    httpStatus: asNumberOrNull(raw.httpStatus),
    toVerdict: asString(raw.toVerdict, ''),
    deckIdMasked: asString(raw.deckIdMasked, '****'),
    signaturePresent: raw.signaturePresent === true,
    signatureAlgorithm: asStringOrNull(raw.signatureAlgorithm),
  };
}

/**
 * Strict shape validator. Returns the normalized snapshot or null if
 * any required field is the wrong type. Coerces optional/nullable
 * fields to safe defaults so the UI never has to guard against
 * `undefined`.
 */
export function validateSnapshot(raw: unknown): ClientSubscriberSnapshot | null {
  if (!isRecord(raw)) return null;

  const subscription = isRecord(raw.subscription) ? raw.subscription : null;
  const signature = isRecord(raw.signature) ? raw.signature : null;
  const delivery = isRecord(raw.delivery) ? raw.delivery : null;
  const health = isRecord(raw.health) ? raw.health : null;
  if (!subscription || !signature || !delivery || !health) return null;

  if (typeof subscription.id !== 'string' || subscription.id.length === 0) {
    return null;
  }

  const overall = asString(health.overall, '');
  if (!ALLOWED_HEALTH_OVERALL.has(overall as SubscriberHealthOverall)) {
    return null;
  }

  const recentDispatchesRaw = Array.isArray(raw.recentDispatches)
    ? raw.recentDispatches
    : [];
  const recentDispatches = recentDispatchesRaw
    .map((d) => normalizeDispatch(d))
    .filter(
      (d): d is ClientSubscriberSnapshot['recentDispatches'][number] => d !== null
    );

  const reasonsRaw = Array.isArray(health.reasons) ? health.reasons : [];
  const reasons = reasonsRaw
    .map((r) => (typeof r === 'string' ? r : null))
    .filter((r): r is string => r !== null);

  const warningsRaw = Array.isArray(raw.warnings) ? raw.warnings : [];
  const warnings = warningsRaw
    .map((w) => (typeof w === 'string' ? w : null))
    .filter((w): w is string => w !== null);

  return {
    subscription: {
      id: subscription.id,
      channel: asString(subscription.channel, ''),
      target: asString(subscription.target, ''),
      minSeverity: asString(subscription.minSeverity, ''),
      active: subscription.active === true,
      secretRotatedAt: asStringOrNull(subscription.secretRotatedAt),
    },
    signature: {
      algorithm: 'HMAC-SHA256',
      secretLastRotatedAt: asStringOrNull(signature.secretLastRotatedAt),
      daysSinceRotation: asNumberOrNull(signature.daysSinceRotation),
      rotationDueWithinDays: asNumberOrNull(signature.rotationDueWithinDays),
    },
    delivery: {
      last7Days: normalizeAggregate(delivery.last7Days),
      last30Days: normalizeAggregate(delivery.last30Days),
      lastDispatchAt: asStringOrNull(delivery.lastDispatchAt),
      lastFailureAt: asStringOrNull(delivery.lastFailureAt),
      consecutiveFailures: asNumber(delivery.consecutiveFailures),
    },
    recentDispatches,
    health: {
      overall: overall as SubscriberHealthOverall,
      reasons,
    },
    warnings,
  };
}

// ============================================================================
// FETCH
// ============================================================================

function statusFromHttp(code: number): SubscriberFetchStatus {
  if (code === 401) return 'unauthorized';
  if (code === 403) return 'forbidden';
  if (code === 429) return 'rate_limited';
  if (code === 503) return 'storage_unavailable';
  return 'network_error';
}

/**
 * Fetch the subscriber dashboard snapshot. Never throws. The Bearer
 * token is sent in the `Authorization` header; we never set cookies
 * or include credentials so a leaked browser session cannot be used
 * to escalate privileges against an arbitrary platform user.
 */
export async function fetchSubscriberDashboard(
  opts: FetchOptions
): Promise<FetchResult> {
  const token = typeof opts.token === 'string' ? opts.token.trim() : '';
  if (!SUBSCRIBER_TOKEN_REGEX.test(token)) {
    return { status: 'unauthorized', reason: 'invalid_token_format' };
  }

  const baseUrl = typeof opts.baseUrl === 'string' ? opts.baseUrl : '';
  const url = `${baseUrl}${SUBSCRIBER_DASHBOARD_PATH}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      // Explicitly omit cookies so this surface stays Bearer-only.
      credentials: 'omit',
      signal: opts.signal,
    });
  } catch (err) {
    const reason = isRecord(err) && typeof err.message === 'string' ? err.message : 'network_error';
    return { status: 'network_error', reason };
  }

  if (!response.ok) {
    const status = statusFromHttp(response.status);
    let reason: string | undefined;
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.reason === 'string') {
        reason = body.reason;
      }
    } catch {
      // Body might not be JSON (e.g. HTML 503 page). Swallow — the
      // status code already tells the UI what to render.
    }
    return reason !== undefined ? { status, reason } : { status };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'network_error', reason: 'invalid_json' };
  }

  // Backend wraps the snapshot as `{ success: true, data: <snapshot> }`.
  // Be tolerant of the bare shape too in case the route layer changes.
  const inner =
    isRecord(payload) && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;

  const data = validateSnapshot(inner);
  if (!data) {
    return { status: 'network_error', reason: 'invalid_payload' };
  }

  return { status: 'ok', data };
}

// ============================================================================
// SESSION TOKEN STORE
// ============================================================================

/**
 * sessionStorage-backed token store. The key is held only for the
 * lifetime of the tab — closing the tab wipes the token. Any attempt
 * to write a value that is not a 64-char lowercase hex string is a
 * silent no-op, so a malformed paste cannot end up persisted.
 */
export const sessionTokenStore: SessionTokenStore = {
  getToken(): string | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.sessionStorage.getItem(SUBSCRIBER_TOKEN_STORAGE_KEY);
      if (typeof raw !== 'string') return null;
      return SUBSCRIBER_TOKEN_REGEX.test(raw) ? raw : null;
    } catch {
      return null;
    }
  },
  saveToken(rawToken: string): void {
    if (!isBrowser()) return;
    if (typeof rawToken !== 'string') return;
    if (!SUBSCRIBER_TOKEN_REGEX.test(rawToken)) return;
    try {
      window.sessionStorage.setItem(SUBSCRIBER_TOKEN_STORAGE_KEY, rawToken);
    } catch {
      // sessionStorage can throw in private browsing on some Safari
      // builds. The caller will discover the failure on the next
      // `getToken()` and fall back to the paste-in form.
    }
  },
  clearToken(): void {
    if (!isBrowser()) return;
    try {
      window.sessionStorage.removeItem(SUBSCRIBER_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore — see saveToken note above.
    }
  },
  hasToken(): boolean {
    return this.getToken() !== null;
  },
};

// ============================================================================
// HASH FRAGMENT HELPERS
// ============================================================================

/**
 * Parse a URL hash fragment of the shape `#token=<value>[&other=...]`
 * and return the value if it matches the 64-hex token regex. Returns
 * null for any malformed input.
 */
export function extractTokenFromHash(rawHash: string): string | null {
  if (typeof rawHash !== 'string' || rawHash.length === 0) return null;
  const trimmed = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (trimmed.length === 0) return null;

  const params = new URLSearchParams(trimmed);
  const value = params.get('token');
  if (typeof value !== 'string') return null;
  return SUBSCRIBER_TOKEN_REGEX.test(value) ? value : null;
}

/**
 * Replace the current URL hash with `#` (effectively empty) so the
 * raw token is no longer visible in the address bar, browser
 * history, or screen-recording / screenshot artefacts. SSR-safe.
 */
export function scrubTokenFromHash(): void {
  if (!isBrowser()) return;
  if (typeof window.history === 'undefined') return;
  try {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}`);
  } catch {
    // Some browsers throw on file:// URLs or with strict CSP
    // sandboxes. The token is also wiped from sessionStorage on
    // sign-out, so a failed scrub is a soft, non-fatal degradation.
  }
}
