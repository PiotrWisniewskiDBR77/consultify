/**
 * Lifetime and tenancy guard for PUBLIC demo principals (OPS-DEMO-002).
 *
 * A public `Try demo` account is an ephemeral credential: it exists to walk one
 * seeded workspace for the session TTL, and nothing more. Three things have to be
 * true for that to hold, and none of them were true before this guard:
 *
 *  1. when the demo session expires, the account stops working — not just its
 *     `X-Demo-Session-Org` header. Previously an expired principal simply
 *     degraded to the shared curated org and kept browsing indefinitely,
 *     `GET /api/demo/status` happily minted a fresh 24h session on the way, and
 *     the 7-day refresh token outlived the demo by six days;
 *  2. the effective organization is derived on the SERVER from the active
 *     session, never from a client header. A missing header must not silently
 *     re-seat the caller in the base org, and a foreign header must not degrade —
 *     it must be refused;
 *  3. expiry is enforced lazily on the request path, because nothing sweeps
 *     `demo_sessions` on a schedule: the only callers of
 *     `cleanupExpiredDemoSessions` are the demo routes themselves, which an
 *     expired client has no reason to call.
 *
 * Scope: this guard applies ONLY to principals minted by the public entry
 * (marked with `demo:entry_source = register_demo` at signup). A normal customer
 * who flips "show demo data" in their profile menu is untouched — their account
 * is not ephemeral and must keep working when the demo overlay lapses.
 */
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  DEMO_ENTRY_SOURCE_PREF_KEY,
  PUBLIC_DEMO_ENTRY_SOURCE,
} from './demoSignupProvisioning.js';

// NOTE: RefreshTokenService is imported dynamically inside
// `retireExpiredDemoPrincipal`, never at module scope. RefreshTokenService has to
// import THIS module to gate refresh on an active demo session, and a static
// import in both directions is a cycle.

/** `users.status` for a public demo principal whose session has lapsed. */
export const DEMO_EXPIRED_USER_STATUS = 'demo_expired';

export const DEMO_SESSION_EXPIRED_CODE = 'DEMO_SESSION_EXPIRED';
export const DEMO_SESSION_INVALID_CODE = 'DEMO_SESSION_INVALID';

export interface ActiveDemoSession {
  id: string;
  sessionOrgId: string;
  expiresAt: string;
}

export interface PublicDemoPrincipalState {
  isPublicDemoPrincipal: boolean;
  session: ActiveDemoSession | null;
}

// The marker is written once at signup and never changes, so it is safe to cache.
// Session presence is deliberately NOT cached — that is the value the TTL turns on.
const MARKER_CACHE_TTL_MS = 5 * 60_000;
const MARKER_CACHE_MAX = 5_000;
const markerCache = new Map<string, { isPublic: boolean; expiresAt: number }>();

function readMarkerCache(userId: string): boolean | null {
  const hit = markerCache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    markerCache.delete(userId);
    return null;
  }
  return hit.isPublic;
}

function writeMarkerCache(userId: string, isPublic: boolean): void {
  if (markerCache.size >= MARKER_CACHE_MAX) markerCache.clear();
  markerCache.set(userId, { isPublic, expiresAt: Date.now() + MARKER_CACHE_TTL_MS });
}

/** Test seam — the cache is process-wide and would otherwise leak between cases. */
export function __resetDemoPrincipalCache(): void {
  markerCache.clear();
}

export async function isPublicDemoPrincipal(userId: string): Promise<boolean> {
  if (!userId) return false;
  const cached = readMarkerCache(userId);
  if (cached !== null) return cached;

  let isPublic = false;
  try {
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, DEMO_ENTRY_SOURCE_PREF_KEY],
      { fallback: false }
    );
    isPublic = String(row?.value || '').trim() === PUBLIC_DEMO_ENTRY_SOURCE;
  } catch {
    // Fail OPEN on a storage fault. This guard restricts an ephemeral account;
    // making a database blip lock out every customer would be a far worse
    // outcome than letting one demo session run a little long.
    return false;
  }

  writeMarkerCache(userId, isPublic);
  return isPublic;
}

async function readActiveSession(userId: string): Promise<ActiveDemoSession | null> {
  const row = await dbGet<{ id: string; session_org_id: string; expires_at: string }>(
    `SELECT id, session_org_id, expires_at
       FROM demo_sessions
      WHERE user_id = ? AND status = 'active' AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, new Date().toISOString()],
    { fallback: false }
  );
  if (!row?.session_org_id) return null;
  return { id: row.id, sessionOrgId: row.session_org_id, expiresAt: row.expires_at };
}

/**
 * Resolve whether this principal is a public demo account and, if so, its single
 * active session. A `null` session for a public demo principal means the demo is
 * over — the caller must refuse the request.
 */
export async function resolvePublicDemoPrincipal(
  userId: string
): Promise<PublicDemoPrincipalState> {
  if (!(await isPublicDemoPrincipal(userId))) {
    return { isPublicDemoPrincipal: false, session: null };
  }
  try {
    return { isPublicDemoPrincipal: true, session: await readActiveSession(userId) };
  } catch (error: unknown) {
    logger.warn('[DemoPrincipalGuard] session lookup failed', {
      error: (error as Error)?.message || String(error),
    });
    // Fail CLOSED here: we already know this is an ephemeral public credential,
    // so refusing is the safe direction when its lifetime cannot be established.
    return { isPublicDemoPrincipal: true, session: null };
  }
}

/**
 * Retire a lapsed public demo principal.
 *
 * Called on the request path the first time an expired principal shows up,
 * because there is no scheduler for this. Closes all three continuation vectors:
 * the account status blocks a fresh login, the revocation kills the 7-day
 * refresh family, and the caller refuses the current access token.
 *
 * Idempotent and best-effort: a failure here must not turn into a 500 for a
 * request that is going to be refused anyway.
 */
export async function retireExpiredDemoPrincipal(userId: string): Promise<void> {
  try {
    await dbRun(
      `UPDATE users SET status = ? WHERE id = ? AND status = 'active'`,
      [DEMO_EXPIRED_USER_STATUS, userId],
      { fallback: true }
    );
  } catch (error: unknown) {
    logger.warn('[DemoPrincipalGuard] failed to mark demo principal expired', {
      userId,
      error: (error as Error)?.message || String(error),
    });
  }

  try {
    const { default: refreshTokenService } = await import('../RefreshTokenService.js');
    await refreshTokenService.revokeAllUserTokens(userId, 'demo_session_expired');
  } catch (error: unknown) {
    logger.warn('[DemoPrincipalGuard] failed to revoke demo refresh tokens', {
      userId,
      error: (error as Error)?.message || String(error),
    });
  }
}

/**
 * The single question login and refresh both have to ask BEFORE minting anything:
 * may this principal still be issued credentials?
 *
 * Deliberately independent of `users.status`. Retirement is best-effort and runs
 * lazily on the request path, so an account can be past its TTL while its status
 * still reads `active` — a credential path that trusted the status flag would
 * happily mint a fresh token in exactly that window. This reads the session
 * directly, and retires the principal itself when it finds none.
 */
export async function assertDemoPrincipalMayReceiveCredentials(
  userId: string
): Promise<{ allowed: boolean }> {
  const state = await resolvePublicDemoPrincipal(userId);
  if (!state.isPublicDemoPrincipal) return { allowed: true };
  if (state.session) return { allowed: true };

  await retireExpiredDemoPrincipal(userId);
  return { allowed: false };
}

/**
 * Normalize a request path for exact allowlist matching.
 *
 * Returns `null` for anything it cannot reduce to a plain, unambiguous path —
 * and a `null` is a DENY, never a pass. Undecodable escapes and traversal
 * segments are exactly how a prefix check gets talked into matching something it
 * did not mean to.
 *
 * Lower-cased because Express routes case-insensitively by default: `/API/Auth/…`
 * reaches the same handler, so the allowlist has to see the same thing the router
 * does. This cannot widen the allowlist — only exact members are ever allowed.
 */
export function normalizeGuardPath(rawPath: string): string | null {
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

function isLeavingDemo(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const enabled = (body as { enabled?: unknown }).enabled;
  // Mirror of the toggle route's own truthiness test, inverted and made explicit.
  // Anything ambiguous — missing, null, a string the route would read as true —
  // is a DENY, because "enter demo" is a provisioning operation.
  return enabled === false || enabled === 'false' || enabled === 0 || enabled === '0';
}

/**
 * The complete set of writes a public demo principal may perform.
 *
 * Exact method + normalized path. There is deliberately no prefix rule: an
 * `/api/auth/*` exception also hands a public demo account `switch-organization`,
 * `change-password`, `register`, `register-demo`, `revoke-all`, `reset-password`
 * and the whole `mfa/*` group, and an `/api/demo/*` exception hands it
 * `toggle {enabled: true}` — a provisioning operation. None of those are needed to
 * walk a read-only demo.
 *
 * What remains is only what lets a session wind itself down or report on itself.
 *
 * NO "logout-all" ENTRY, deliberately. `POST /api/auth/revoke-all` was allowlisted
 * here as the equivalent and that was wrong twice over:
 *   1. the handler refuses anyone who is not ADMIN/SUPERADMIN, so a demo principal
 *      (CONSULTANT) gets 403 regardless — the entry granted nothing;
 *   2. it only writes a marker row into `revoked_tokens`. `RefreshTokenService`
 *      never reads that table, so a refresh token still rotates into a working
 *      access token afterwards. The route does not end sessions at all.
 * Allowlisting it therefore documented a capability the system does not provide.
 * The underlying defect is tracked in SEC-AUTH-001 and is deliberately NOT fixed
 * here; nothing in the demo path depends on it, because plain `logout` is the
 * wind-down operation.
 */
export const PUBLIC_DEMO_WRITE_ALLOWLIST: ReadonlyArray<{
  method: string;
  path: string;
  /** Extra condition on the body; absent means the path alone is sufficient. */
  guard?: (body: unknown) => boolean;
  why: string;
}> = [
  { method: 'POST', path: '/api/auth/logout', why: 'end the session' },
  {
    method: 'POST',
    path: '/api/auth/refresh',
    why: 'rotates within the demo window; carries its own TTL gate that refuses a lapsed principal',
  },
  {
    method: 'POST',
    path: '/api/demo/toggle',
    guard: isLeavingDemo,
    why: 'leave demo mode — LEAVING ONLY; enabled:true would provision',
  },
  {
    method: 'POST',
    path: '/api/demo/record-event',
    why: 'telemetry beacon; the route derives organizationId server-side and ignores the body',
  },
];

/**
 * Writes a public demo principal may still perform. Everything else is refused,
 * whatever headers the caller sends.
 */
export function isWriteAllowedForPublicDemo(
  method: string,
  pathname: string,
  body?: unknown
): boolean {
  const normalizedMethod = String(method || '').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) return true;

  const normalizedPath = normalizeGuardPath(pathname);
  if (!normalizedPath) return false;

  const entry = PUBLIC_DEMO_WRITE_ALLOWLIST.find(
    (candidate) => candidate.method === normalizedMethod && candidate.path === normalizedPath
  );
  if (!entry) return false;
  return entry.guard ? entry.guard(body) : true;
}

/**
 * Paths a LAPSED demo principal may still reach, so the client can discard its
 * credentials instead of being trapped with a token it can neither use nor drop.
 *
 * Strictly smaller than the live-session allowlist: no refresh (there is nothing
 * left to refresh into), no demo routes (the session is over), and no
 * `revoke-all` — see the note on the write allowlist for why that route cannot
 * serve as a logout-all. Exact match on the normalized path, same rules as
 * everywhere else.
 */
const EXPIRED_DEMO_ALLOWED_PATHS = ['/api/auth/logout'];

export function isPathAllowedForExpiredDemo(pathname: string): boolean {
  const normalized = normalizeGuardPath(pathname);
  if (!normalized) return false;
  return EXPIRED_DEMO_ALLOWED_PATHS.includes(normalized);
}
