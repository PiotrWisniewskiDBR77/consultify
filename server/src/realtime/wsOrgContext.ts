/**
 * wsOrgContext — demo-aware organization-context resolution for realtime
 * (WebSocket / Socket.IO) connections.
 *
 * Why this exists (#101 Grupa 0 / P0 — WS-leak):
 * HTTP requests pass through `demoContextMiddleware`, which switches the
 * effective org to the demo org while a demo session / demo preference is
 * active. WS gateways used to read `organizationId` straight from the JWT, so
 * a user inside demo mode kept a realtime channel bound to their REAL org —
 * collab writes (graph_patch, collab_sessions, …) landed on real data.
 *
 * This module is the single source of truth for "which org is this user's
 * realtime connection allowed to touch right now". Resolution is DB-driven
 * (the client cannot claim a context it is not entitled to):
 *
 *   1. active `demo_sessions` row (Tryb B interactive session tenant)
 *        → org = session_org_id; writes only when DEMO_WRITES_ENABLED=true
 *          (exact parity with demoWriteProtection on HTTP).
 *   2. `demo:enabled` user preference (shared canonical demo org,
 *      "Open Sample Workspace")
 *        → org = DEMO_ORG_ID; read-only (HTTP blocks all demo-org writes).
 *   3. otherwise → org from the JWT; writes allowed unless the JWT org IS the
 *      demo org (defense in depth, mirrors the `isDemoOrg` branch on HTTP).
 *
 * Failure policy: a missing demo table means demo was never provisioned →
 * safely fall through (no demo session can exist). Any OTHER db error is
 * rethrown so callers fail CLOSED (reject handshake / write), never open.
 *
 * NOTE: DEMO_ORG_ID / the `demo:enabled` key are intentionally read from env /
 * literal here rather than imported from demoGuard.middleware — that module
 * drags in DbPromise and the Express stack, which realtime gateways (and their
 * tests, which mock only `getDatabase`) must not depend on.
 */

export interface WsDbLike {
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null | undefined>;
}

export interface WsOrgContext {
  /** Effective org this connection may read/write. */
  organizationId: string;
  /** Org claimed by the JWT (kept for diagnostics). */
  jwtOrganizationId: string;
  /** True when a demo session / demo preference drove the resolution. */
  demoMode: boolean;
  /** True when the org is a validated per-user demo session tenant. */
  demoSessionValidated: boolean;
  /** False for read-only contexts (shared demo org, or writes-disabled session). */
  writeAllowed: boolean;
  /** Epoch ms of resolution — freshness gate for long-lived connections. */
  resolvedAt: number;
}

const DEMO_PREF_KEY = 'demo:enabled';
const DEFAULT_TTL_MS = 10_000;

export function getDemoOrgId(): string {
  return process.env.DEMO_ORG_ID || 'demo-org';
}

/** TTL after which a live connection must re-resolve its org context. */
export function getWsOrgContextTtlMs(): number {
  const raw = Number(process.env.WS_ORG_CONTEXT_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MS;
}

export function isWsOrgContextFresh(ctx: WsOrgContext, now = Date.now()): boolean {
  return now - ctx.resolvedAt <= getWsOrgContextTtlMs();
}

function isMissingTableError(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== 'string') return false;
  return (
    message.includes('no such table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('Database not initialized')
  );
}

function parseBoolPref(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === '"true"';
}

function demoWritesEnabled(): boolean {
  return String(process.env.DEMO_WRITES_ENABLED || '').toLowerCase() === 'true';
}

/**
 * Resolve the effective org context for a realtime connection.
 * Throws on unexpected DB errors — callers MUST treat a throw as "deny".
 */
export async function resolveWsOrgContext(
  db: WsDbLike,
  userId: string,
  jwtOrganizationId: string
): Promise<WsOrgContext> {
  const resolvedAt = Date.now();
  const jwtOrg = String(jwtOrganizationId || '').trim();
  const demoOrg = getDemoOrgId();

  // 1. Active per-user demo session tenant (Tryb B).
  let sessionOrgId = '';
  try {
    const row = await db.get<{ session_org_id?: unknown }>(
      `SELECT session_org_id
       FROM demo_sessions
       WHERE user_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, new Date().toISOString()]
    );
    sessionOrgId = typeof row?.session_org_id === 'string' ? row.session_org_id.trim() : '';
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  if (sessionOrgId && sessionOrgId !== demoOrg) {
    return {
      organizationId: sessionOrgId,
      jwtOrganizationId: jwtOrg,
      demoMode: true,
      demoSessionValidated: true,
      writeAllowed: demoWritesEnabled(),
      resolvedAt,
    };
  }

  // 2. Shared canonical demo org via the demo:enabled preference.
  let demoPref = false;
  try {
    const row = await db.get<{ value?: unknown }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, DEMO_PREF_KEY]
    );
    demoPref = parseBoolPref(row?.value);
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
  }
  if (demoPref || sessionOrgId === demoOrg) {
    return {
      organizationId: demoOrg,
      jwtOrganizationId: jwtOrg,
      demoMode: true,
      demoSessionValidated: false,
      writeAllowed: false,
      resolvedAt,
    };
  }

  // 3. Regular connection — JWT org. Defense in depth: the shared demo org is
  //    never writable over realtime, even when the JWT itself points at it.
  const isDemoOrg = jwtOrg === demoOrg;
  return {
    organizationId: jwtOrg,
    jwtOrganizationId: jwtOrg,
    demoMode: isDemoOrg,
    demoSessionValidated: false,
    writeAllowed: !isDemoOrg,
    resolvedAt,
  };
}
