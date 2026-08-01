import { DEMO_ORG_ID } from '../../middleware/demoGuard.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { type DemoLocale, normalizeDemoLocale } from './demoLocale.js';
import {
  deleteDemoDatasetForOrganization,
  getDemoDatasetStats,
  seedAtelierToysDemoDataset,
} from './demoSeedService.js';

const DEMO_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const DEMO_PREF_SESSION_ID = 'demo:session_id';
const DEMO_PREF_SESSION_ORG_ID = 'demo:session_org_id';
const DEMO_PREF_SESSION_EXPIRES_AT = 'demo:session_expires_at';
const DEMO_PREF_SESSION_ANCHOR = 'demo:session_anchor';
const DEMO_PREF_SESSION_LOCALE = 'demo:session_locale';

export interface DemoSessionRecord {
  id: string;
  user_id: string;
  base_org_id: string;
  session_org_id: string;
  locale: DemoLocale;
  source: string;
  status: 'active' | 'ended' | 'expired';
  anchor_date: string;
  expires_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeSessionId(userId: string): string {
  return `demo-session-${userId}-${Date.now().toString(36)}`;
}

function makeSessionOrgId(userId: string): string {
  const normalizedUser = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'user';
  return `${DEMO_ORG_ID}-session-${normalizedUser}-${Date.now().toString(36)}`;
}

async function requireUserPreferencesTable(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS user_preferences (
       user_id TEXT NOT NULL,
       key TEXT NOT NULL,
       value TEXT NOT NULL,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, key)
     )`,
    [],
    { fallback: false }
  );
  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_user_key ON user_preferences(user_id, key)`,
    [],
    { fallback: true }
  );
}

async function upsertPreference(userId: string, key: string, value: string): Promise<void> {
  await requireUserPreferencesTable();
  await dbRun(`DELETE FROM user_preferences WHERE user_id = ? AND key = ?`, [userId, key], {
    fallback: true,
  });
  await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)`,
    [userId, key, value, nowIso()],
    { fallback: false }
  );
}

async function clearPreference(userId: string, key: string): Promise<void> {
  await requireUserPreferencesTable();
  await dbRun(`DELETE FROM user_preferences WHERE user_id = ? AND key = ?`, [userId, key], {
    fallback: false,
  });
}

export async function ensureDemoSessionTables(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS demo_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      base_org_id TEXT NOT NULL,
      session_org_id TEXT NOT NULL,
      locale TEXT DEFAULT 'en',
      source TEXT DEFAULT 'demo_toggle',
      status TEXT DEFAULT 'active',
      anchor_date TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT
    )`,
    [],
    { fallback: false }
  );
  await dbRun(
    `DO $$ BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'demo_sessions' AND column_name = 'locale'
       ) THEN
         ALTER TABLE demo_sessions ADD COLUMN locale TEXT DEFAULT 'en';
       END IF;
     END $$`,
    [],
    { fallback: true }
  );

  await dbRun(
    `CREATE TABLE IF NOT EXISTS demo_session_tenants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tenant_org_id TEXT NOT NULL,
      base_org_id TEXT NOT NULL,
      ttl_expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: false }
  );
}

export async function getActiveDemoSession(userId: string): Promise<DemoSessionRecord | null> {
  await ensureDemoSessionTables();
  const session = await dbGet<DemoSessionRecord>(
    `SELECT id, user_id, base_org_id, session_org_id, COALESCE(locale, 'en') as locale, source, status, anchor_date, expires_at
     FROM demo_sessions
     WHERE user_id = ? AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
    { fallback: false }
  );

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await expireDemoSession(session);
    return null;
  }
  return session;
}

async function expireDemoSession(session: DemoSessionRecord): Promise<void> {
  // NEVER delete the curated base org: in DEMO_USE_BASE_ORG mode the session
  // row points at DEMO_ORG_ID itself, and expiry must not wipe the hand-seeded
  // dataset. Per-user copy orgs (the only thing safe to delete) always have a
  // derived session org id distinct from DEMO_ORG_ID.
  if (session.session_org_id && session.session_org_id !== DEMO_ORG_ID) {
    await deleteDemoDatasetForOrganization(session.session_org_id);
  }
  await dbRun(
    `UPDATE demo_sessions SET status = 'expired', ended_at = ? WHERE id = ?`,
    [nowIso(), session.id],
    { fallback: false }
  );
  await dbRun(`DELETE FROM demo_session_tenants WHERE session_id = ?`, [session.id], {
    fallback: false,
  });
}

async function persistSessionPreferences(session: DemoSessionRecord): Promise<void> {
  await Promise.all([
    upsertPreference(session.user_id, DEMO_PREF_SESSION_ID, session.id),
    upsertPreference(session.user_id, DEMO_PREF_SESSION_ORG_ID, session.session_org_id),
    upsertPreference(session.user_id, DEMO_PREF_SESSION_EXPIRES_AT, session.expires_at),
    upsertPreference(session.user_id, DEMO_PREF_SESSION_ANCHOR, session.anchor_date),
    upsertPreference(session.user_id, DEMO_PREF_SESSION_LOCALE, session.locale),
  ]);
}

async function clearSessionPreferences(userId: string): Promise<void> {
  await Promise.all([
    clearPreference(userId, DEMO_PREF_SESSION_ID),
    clearPreference(userId, DEMO_PREF_SESSION_ORG_ID),
    clearPreference(userId, DEMO_PREF_SESSION_EXPIRES_AT),
    clearPreference(userId, DEMO_PREF_SESSION_ANCHOR),
    clearPreference(userId, DEMO_PREF_SESSION_LOCALE),
  ]);
}

export async function cleanupExpiredDemoSessions(): Promise<number> {
  await ensureDemoSessionTables();
  const expiredSessions = await dbAll<DemoSessionRecord>(
    `SELECT id, user_id, base_org_id, session_org_id, COALESCE(locale, 'en') as locale, source, status, anchor_date, expires_at
     FROM demo_sessions
     WHERE status = 'active' AND expires_at <= ?`,
    [nowIso()],
    { fallback: false }
  );

  for (const session of expiredSessions) {
    await expireDemoSession(session);
    await clearSessionPreferences(session.user_id);
  }

  return expiredSessions.length;
}

export async function startDemoSession(
  userId: string,
  source = 'demo_toggle',
  requestedLocale: DemoLocale | string = 'en',
  /**
   * Caller-supplied tenant org id. Additive and optional: every existing caller
   * omits it and keeps the derived `makeSessionOrgId` value.
   *
   * The public-signup saga supplies one because it has to be able to reclaim the
   * tenant after a failure that happens BETWEEN the seed below and the
   * `demo_sessions` INSERT — a window in which the generated id exists only
   * inside this function, so the saga could previously only sweep for it by a
   * truncated `LIKE` prefix that also matched other users' live tenants.
   */
  sessionOrgId?: string
): Promise<DemoSessionRecord & { stats: Awaited<ReturnType<typeof getDemoDatasetStats>> }> {
  await ensureDemoSessionTables();
  await cleanupExpiredDemoSessions();
  await endDemoSession(userId);
  const locale = normalizeDemoLocale(requestedLocale);

  const session: DemoSessionRecord = {
    id: makeSessionId(userId),
    user_id: userId,
    base_org_id: DEMO_ORG_ID,
    session_org_id: sessionOrgId || makeSessionOrgId(userId),
    locale,
    source,
    status: 'active',
    anchor_date: nowIso(),
    expires_at: new Date(Date.now() + DEMO_SESSION_DURATION_MS).toISOString(),
  };

  await seedAtelierToysDemoDataset({
    organizationId: session.session_org_id,
    anchorDate: session.anchor_date,
    source: 'session',
    viewerUserId: userId,
    locale: session.locale,
  });

  await dbRun(
    `INSERT INTO demo_sessions (
      id, user_id, base_org_id, session_org_id, locale, source, status, anchor_date, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.user_id,
      session.base_org_id,
      session.session_org_id,
      session.locale,
      session.source,
      session.status,
      session.anchor_date,
      session.expires_at,
      nowIso(),
    ],
    { fallback: false }
  );

  await dbRun(
    `INSERT INTO demo_session_tenants (id, session_id, tenant_org_id, base_org_id, ttl_expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      `${session.id}-tenant`,
      session.id,
      session.session_org_id,
      session.base_org_id,
      session.expires_at,
      nowIso(),
    ],
    { fallback: false }
  );

  await persistSessionPreferences(session);
  const stats = await getDemoDatasetStats(session.session_org_id);

  return {
    ...session,
    stats,
  };
}

export async function resolveOrCreateDemoSession(
  userId: string,
  source = 'demo_toggle',
  requestedLocale: DemoLocale | string = 'en',
  options: { restartOnLocaleMismatch?: boolean; sessionOrgId?: string } = {}
): Promise<DemoSessionRecord & { stats: Awaited<ReturnType<typeof getDemoDatasetStats>> }> {
  const locale = normalizeDemoLocale(requestedLocale);

  // Curated read-only demo: serve the fully-seeded base org directly instead of
  // provisioning a thin per-user copy. The base org (DEMO_ORG_ID) is the rich,
  // hand-verified dataset (tools, insights, results KPIs, deliverables); a fresh
  // template copy is missing those modules. Writes stay blocked because the org
  // equals DEMO_ORG_ID (demoWriteProtection). Gated by env so only the demo env
  // opts in. Only the SEEDING is skipped — the demo_sessions row is still
  // persisted, because it carries the original entry `source`: /status derives
  // workspace_demo vs sales_demo from it, and a per-call source ('status_refresh')
  // would misclassify a presenter's session as a sales funnel on every reload.
  if (String(process.env.DEMO_USE_BASE_ORG || '').toLowerCase() === 'true') {
    await ensureDemoSessionTables();
    const activeBase = await getActiveDemoSession(userId);
    if (activeBase) {
      return {
        ...activeBase,
        session_org_id: DEMO_ORG_ID,
        stats: await getDemoDatasetStats(DEMO_ORG_ID),
      };
    }

    const session: DemoSessionRecord = {
      id: makeSessionId(userId),
      user_id: userId,
      base_org_id: DEMO_ORG_ID,
      session_org_id: DEMO_ORG_ID,
      locale,
      source,
      status: 'active',
      anchor_date: nowIso(),
      expires_at: new Date(Date.now() + DEMO_SESSION_DURATION_MS).toISOString(),
    };
    await dbRun(
      `INSERT INTO demo_sessions (
        id, user_id, base_org_id, session_org_id, locale, source, status, anchor_date, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.user_id,
        session.base_org_id,
        session.session_org_id,
        session.locale,
        session.source,
        session.status,
        session.anchor_date,
        session.expires_at,
        nowIso(),
      ],
      { fallback: false }
    );
    await persistSessionPreferences(session);
    return {
      ...session,
      stats: await getDemoDatasetStats(DEMO_ORG_ID),
    };
  }

  const active = await getActiveDemoSession(userId);
  if (active) {
    if (options.restartOnLocaleMismatch && active.locale !== locale) {
      return startDemoSession(userId, source, locale, options.sessionOrgId);
    }
    return {
      ...active,
      stats: await getDemoDatasetStats(active.session_org_id),
    };
  }

  return startDemoSession(userId, source, locale, options.sessionOrgId);
}

export async function endDemoSession(userId: string): Promise<void> {
  await ensureDemoSessionTables();
  const sessions = await dbAll<DemoSessionRecord>(
    `SELECT id, user_id, base_org_id, session_org_id, COALESCE(locale, 'en') as locale, source, status, anchor_date, expires_at
     FROM demo_sessions
     WHERE user_id = ? AND status = 'active'`,
    [userId],
    { fallback: false }
  );

  for (const session of sessions) {
    // Same guard as expireDemoSession: session rows in DEMO_USE_BASE_ORG mode
    // point at the curated base org itself — exiting the demo must never wipe
    // the hand-seeded dataset. Only derived per-user copy orgs are deletable.
    if (session.session_org_id && session.session_org_id !== DEMO_ORG_ID) {
      await deleteDemoDatasetForOrganization(session.session_org_id);
    }
    await dbRun(
      `UPDATE demo_sessions SET status = 'ended', ended_at = ? WHERE id = ?`,
      [nowIso(), session.id],
      { fallback: false }
    );
    await dbRun(`DELETE FROM demo_session_tenants WHERE session_id = ?`, [session.id], {
      fallback: false,
    });
  }

  await clearSessionPreferences(userId);
}

export async function getDemoSessionOrganization(userId: string): Promise<string | null> {
  const active = await getActiveDemoSession(userId);
  return active?.session_org_id || null;
}
