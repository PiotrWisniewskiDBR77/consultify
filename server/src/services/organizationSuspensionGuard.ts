/**
 * Organization suspension guard — DEC-91 / TRI-MUST-12.
 *
 * ===========================================================================
 * WHAT THIS CLOSES
 * ===========================================================================
 * Suspending a tenant (`POST /api/superadmin/tenants/:id/suspend`, or
 * `PUT /api/superadmin/organizations/:id` with `status: 'suspended'`) already
 * wrote `organizations.status = 'suspended'` and emitted an audit event — but
 * NOTHING read that column on the way in. A member of a suspended tenant could
 * still log in and keep using every API surface. Day-15 acceptance (DEC-85)
 * recorded exactly that gap.
 *
 * This module is the single place that answers "is this tenant suspended?" for
 * both entry points:
 *   - login   → `AuthController.login` (403 before a token is ever minted)
 *   - API     → `attachUser` in `auth.middleware.ts` (403 on every request that
 *               carries an already-issued token)
 *
 * ===========================================================================
 * WHY A CACHE, AND WHAT ITS TTL MEANS
 * ===========================================================================
 * `attachUser` runs on EVERY authenticated request. An unconditional
 * `SELECT status FROM organizations` there would add a round trip to the whole
 * API surface. So the answer is memoised per organization for a short TTL
 * (default 30 s, `ORG_SUSPENSION_CACHE_TTL_MS`).
 *
 * The TTL is therefore also the enforcement SLA for tokens that were already in
 * the wild when the suspension landed: a live session of a suspended tenant
 * stops working at the latest TTL seconds after the suspension is written. When
 * the suspend/reactivate call is served by the SAME process, the cache is
 * invalidated inline and the effect is immediate; in a multi-process
 * deployment the other workers converge within the TTL.
 *
 * MULTI-REPLICA WINDOW — CONSCIOUSLY ACCEPTED
 * ---------------------------------------------------------------------------
 * The cache lives in PROCESS memory and the invalidation on suspend/reactivate
 * is in-process only. With more than one replica behind the load balancer, the
 * replicas that did not serve the status change keep answering from their own
 * memory for up to one TTL. So with N replicas the worst case is: suspension
 * takes effect immediately on the replica that served it and within
 * `ORG_SUSPENSION_CACHE_TTL_MS` (default 30 s) everywhere else.
 *
 * This is accepted on purpose, not overlooked. Lower the TTL to shrink the
 * window. A cross-process invalidation (pub/sub on the status writers) is the
 * real fix and is deferred until the staging replica count is settled — at one
 * replica it would be pure cost.
 *
 * ===========================================================================
 * FAIL-OPEN ON DATABASE ERRORS — DELIBERATE, AND IT MUST NOT STICK
 * ===========================================================================
 * If the status lookup throws, this module reports "not suspended" and caches
 * NOTHING. Fail-closed here would convert any transient database blip into a
 * platform-wide 403 storm, and a request whose org lookup fails is going to
 * fail downstream anyway. The suspension state itself is never inferred — only
 * an explicit `'suspended'` row value blocks.
 *
 * "Caches nothing" is the load-bearing half of that sentence, and it was FALSE
 * in the first revision — an adversarial audit caught it. `DbPromise.get`
 * defaults to `fallback: true`, which RESOLVES `null` on an error, a timeout or
 * a thrown exception instead of rejecting. The `catch` below was therefore dead
 * for every DbPromise-backed caller: an error arrived as "no row", was read as
 * "not suspended", and was written to the cache for a FULL TTL — refreshed by
 * each subsequent error. A suspended tenant regained every front door for as
 * long as the database misbehaved.
 *
 * Two independent defences now, because either alone can be re-broken:
 *   1. every DbPromise-backed call site passes `{ fallback: false }`, so a
 *      failure really rejects and really reaches the `catch`;
 *   2. a NEGATIVE answer is cached only when a row was actually seen. A missing
 *      row is never cached, so even a caller that forgets (1) can at most
 *      fail open for that one request instead of for the next 30 seconds.
 *
 * Defence 2 also bounds the cache against a caller that passes attacker-chosen
 * ids: absent rows leave no entry behind. See `MAX_CACHE_ENTRIES` for the hard
 * ceiling that backs it up.
 */

/** Machine-readable refusal code. The client maps it to a localized string. */
export const ORG_SUSPENDED_CODE = 'ORG_SUSPENDED';

/** i18n key for the refusal. The `error` string below is only a fallback. */
export const ORG_SUSPENDED_MESSAGE_KEY = 'errors.organizationSuspended';

/**
 * Organization statuses that hard-block access.
 *
 * Deliberately just `suspended`. `blocked` / `pending` are already refused at
 * login by their own pre-existing branches, and `cancelled` is intentionally
 * NOT added here — widening the block set is a separate product decision, not
 * part of DEC-91.
 */
const BLOCKING_ORG_STATUSES = new Set(['suspended']);

const DEFAULT_CACHE_TTL_MS = 30_000;
const MIN_CACHE_TTL_MS = 1_000;
const MAX_CACHE_TTL_MS = 300_000;

/**
 * Accepts both database handles the codebase actually has: `DbPromise.get`
 * (resolves `undefined` for no row) and `IDatabase.get` (resolves `null`).
 * Widening here beats casting at every call site.
 */
type DbGet = <T>(sql: string, params?: unknown[]) => Promise<T | undefined | null>;

interface CacheEntry {
  suspended: boolean;
  expiresAt: number;
}

/**
 * Hard ceiling on cache entries, as defence in depth behind "never cache a
 * missing row". Real tenants are bounded, so this can only bind if something
 * upstream starts feeding unverified ids — in which case a bounded, evicting
 * map is a bug and an unbounded one is a memory-exhaustion vector.
 *
 * Eviction is oldest-inserted-first, which for a Map is simply its first key.
 */
const MAX_CACHE_ENTRIES = 10_000;

const suspensionCache = new Map<string, CacheEntry>();

function rememberSuspensionAnswer(organizationId: string, entry: CacheEntry): void {
  // Re-inserting must refresh insertion order, or a hot tenant could be evicted
  // while cold ones survive.
  suspensionCache.delete(organizationId);
  suspensionCache.set(organizationId, entry);
  while (suspensionCache.size > MAX_CACHE_ENTRIES) {
    const oldest = suspensionCache.keys().next();
    if (oldest.done) break;
    suspensionCache.delete(oldest.value);
  }
}

/** Injectable clock so TTL expiry is testable without sleeping. */
let now: () => number = () => Date.now();

export function getOrgSuspensionCacheTtlMs(): number {
  const raw = process.env.ORG_SUSPENSION_CACHE_TTL_MS;
  if (raw === undefined) return DEFAULT_CACHE_TTL_MS;
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CACHE_TTL_MS;
  if (parsed < MIN_CACHE_TTL_MS) return MIN_CACHE_TTL_MS;
  if (parsed > MAX_CACHE_TTL_MS) return MAX_CACHE_TTL_MS;
  return parsed;
}

function normalizeOrganizationId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return '';
  return trimmed;
}

/**
 * Drop the memoised answer for one organization (or all of them).
 *
 * Called inline by the suspend / reactivate / update-status handlers so that a
 * reactivation performed in this process takes effect on the very next request
 * instead of after the TTL.
 */
export function invalidateOrganizationSuspensionCache(organizationId?: unknown): void {
  const normalized = normalizeOrganizationId(organizationId);
  if (!normalized) {
    suspensionCache.clear();
    return;
  }
  suspensionCache.delete(normalized);
}

/**
 * True when `organizations.status` for this tenant is a blocking status.
 *
 * Never throws: an unusable id or a failing lookup both resolve to `false`
 * (see "FAIL-OPEN" in the file header).
 */
export async function isOrganizationSuspended(
  organizationId: unknown,
  dbGet: DbGet
): Promise<boolean> {
  const normalized = normalizeOrganizationId(organizationId);
  if (!normalized) return false;
  if (typeof dbGet !== 'function') return false;

  const cached = suspensionCache.get(normalized);
  const currentTime = now();
  if (cached && cached.expiresAt > currentTime) {
    return cached.suspended;
  }

  let row: { status?: unknown } | undefined | null;
  try {
    row = await dbGet<{ status?: unknown }>('SELECT status FROM organizations WHERE id = ?', [
      normalized,
    ]);
  } catch {
    // Fail open, and cache nothing — the next request retries the lookup.
    return false;
  }

  // A missing organization row is not a suspension. Membership / org-context
  // checks elsewhere own that case; inventing a 403 here would change the
  // observable behaviour of unrelated surfaces.
  //
  // But it is NOT cached either, and that is the important part. A caller whose
  // database handle swallows errors into `null` (DbPromise's `fallback: true`
  // default) would otherwise turn every failed lookup into a 30-second
  // "not suspended" verdict for a tenant that IS suspended. Re-querying an
  // absent org is cheap; a sticky wrong answer is not. It also means an id the
  // caller never verified cannot leave a cache entry behind.
  const rawStatus = typeof row?.status === 'string' ? row.status : null;
  if (rawStatus === null) return false;

  const suspended = BLOCKING_ORG_STATUSES.has(rawStatus.trim().toLowerCase());

  rememberSuspensionAnswer(normalized, {
    suspended,
    expiresAt: currentTime + getOrgSuspensionCacheTtlMs(),
  });

  return suspended;
}

/**
 * Paths a member of a suspended tenant may still reach.
 *
 * Exactly three, per DEC-91:
 *   - `/api/superadmin/**` — the platform operator must be able to reactivate
 *     the tenant (and inspect it) while the suspension is in force. That router
 *     is itself behind `requireSuperAdmin`, so this is not a widening.
 *   - `/api/auth/logout`  — never trap a client with a token it can neither use
 *     nor drop (same reasoning as the lapsed-demo allowlist).
 *   - `/api/health/**`    — liveness/readiness probes must not flip red because
 *     one tenant got suspended.
 *
 * Nothing else. Matching is on the FULL request url (`originalUrl`), because
 * `verifyToken` is mounted inside routers (e.g. `/api/superadmin`), where
 * `req.path` is only the router-relative tail.
 */
const EXEMPT_PATH_PREFIXES = ['/api/superadmin', '/api/health'];
const EXEMPT_PATHS_EXACT = ['/api/auth/logout'];

function normalizeGuardPath(rawPath: unknown): string | null {
  let path = String(rawPath || '');
  path = path.split('?')[0] || '';
  path = path.split('#')[0] || '';
  if (!path) return null;

  if (path.includes('%')) {
    try {
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
  }

  if (path.includes('\\') || path.includes('..') || path.includes('\0')) return null;
  if (!path.startsWith('/')) return null;

  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path.toLowerCase();
}

export function isPathExemptFromOrgSuspension(rawPath: unknown): boolean {
  const normalized = normalizeGuardPath(rawPath);
  if (!normalized) return false;
  if (EXEMPT_PATHS_EXACT.includes(normalized)) return true;
  return EXEMPT_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/** The single refusal body, shared by the login path and the API middleware. */
export function buildOrgSuspendedResponseBody(): {
  error: string;
  code: string;
  messageKey: string;
  guidance: string;
} {
  return {
    error: 'Your organization has been suspended. Contact support to restore access.',
    code: ORG_SUSPENDED_CODE,
    messageKey: ORG_SUSPENDED_MESSAGE_KEY,
    guidance: 'A platform administrator must reactivate this organization.',
  };
}

/**
 * Minimal shape of the raw TCP socket handed to an HTTP `upgrade` listener.
 * Duck-typed on purpose: this module stays free of node `net`/`http` imports,
 * and the three collab gateways can pass their socket straight through.
 */
interface UpgradeSocketLike {
  write: (chunk: string) => unknown;
  destroy: () => unknown;
}

/**
 * Refuse a WebSocket UPGRADE that never completes the handshake.
 *
 * The three raw-`ws` collab gateways answer a rejected upgrade by writing a
 * bare HTTP status line onto the socket (`HTTP/1.1 403 Forbidden`) and
 * destroying it — there is no `ws` yet, so there is no close code to send. This
 * keeps that convention and adds the DEC-91 body, so a suspended tenant gets
 * the SAME machine-readable payload here as on the JWT, API-key and Socket.IO
 * paths instead of an unexplained socket teardown.
 *
 * Named rather than silent: every caller resolves the tenant server-side from
 * the authenticated principal, so it is the caller's OWN org and nothing about
 * any other tenant leaks.
 */
export function writeOrgSuspendedUpgradeRefusal(socket: UpgradeSocketLike): void {
  try {
    const body = JSON.stringify(buildOrgSuspendedResponseBody());
    socket.write(
      'HTTP/1.1 403 Forbidden\r\n' +
        'Content-Type: application/json\r\n' +
        `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n` +
        'Connection: close\r\n' +
        '\r\n' +
        body
    );
  } catch {
    /* the peer is already gone; the destroy below is still the right ending */
  }
  try {
    socket.destroy();
  } catch {
    /* already destroyed */
  }
}

/** Test-only seam: deterministic clock + cache reset. Never used in runtime code. */
export const __testing__ = {
  setNow(fn: (() => number) | null): void {
    now = fn ?? (() => Date.now());
  },
  reset(): void {
    suspensionCache.clear();
    now = () => Date.now();
  },
  cacheSize(): number {
    return suspensionCache.size;
  },
};
