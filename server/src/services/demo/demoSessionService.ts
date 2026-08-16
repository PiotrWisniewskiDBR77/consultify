import { DEMO_ORG_ID } from '../../middleware/demoGuard.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { type DemoLocale, normalizeDemoLocale } from './demoLocale.js';
import {
  deleteDemoDatasetForOrganization,
  getDemoDatasetStats,
  seedAtelierToysDemoDataset,
  type SeedDemoDatasetStageFailure,
} from './demoSeedService.js';

const DEMO_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const DEMO_PREF_SESSION_ID = 'demo:session_id';
const DEMO_PREF_SESSION_ORG_ID = 'demo:session_org_id';
const DEMO_PREF_SESSION_EXPIRES_AT = 'demo:session_expires_at';
const DEMO_PREF_SESSION_ANCHOR = 'demo:session_anchor';
const DEMO_PREF_SESSION_LOCALE = 'demo:session_locale';
/**
 * Last seed OUTCOME for the user's current session, as JSON
 * (`DemoDatasetOutcomeRecord`). Written only by the call that actually ran the
 * seed; read by every call that only RESUMES a session, so a resume can report
 * what really happened instead of assuming it went well.
 *
 * `user_preferences` is used (not a new `demo_sessions` column) because this
 * module may not migrate: `ensureDemoSessionTables` only creates tables, and the
 * preference table is already the store for demo session state.
 */
const DEMO_PREF_SESSION_DATASET = 'demo:session_dataset_outcome';

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

/**
 * Why a resume cannot answer `true`.
 *
 * `datasetComplete` is a claim about a SEED, and only the call that ran the seed
 * has first-hand knowledge of it. A call that merely resumes an existing session
 * ran no seed, so it must either quote a RECORDED outcome or admit it does not
 * know. `null` is that admission, and `datasetStatusReason` says which case it is.
 */
export type DemoDatasetStatusReason =
  /** This call ran the seed and it finished every required stage. */
  | 'seeded_in_this_call'
  /** Resume: quoting the outcome the seeding call recorded for THIS session. */
  | 'resumed_session_recorded_outcome'
  /** Resume: no outcome on record for this session id — genuinely unknown. */
  | 'resumed_session_no_seed_record'
  /** DEMO_USE_BASE_ORG: the curated org is seeded out of band, not by this call. */
  | 'base_org_not_seeded_by_this_call';

/**
 * ★ A demo session must not advertise a dataset the seed could not finish.
 *
 * `stats` counts rows that ARE there; it can say nothing about rows that were
 * supposed to be there and are not — a stage that failed silently looks exactly
 * like a stage that had nothing to write. `datasetComplete` / `datasetFailures`
 * carry that signal out of `seedAtelierToysDemoDataset` to whoever decides the
 * presenter may start.
 *
 * ADDITIVE by construction: existing callers destructure `stats` and the
 * `DemoSessionRecord` fields, so nothing they read changes shape.
 */
export type DemoSessionWithDataset = DemoSessionRecord & {
  stats: Awaited<ReturnType<typeof getDemoDatasetStats>>;
  /**
   * `true` only when a seed is KNOWN to have finished every required stage —
   * either in this call, or per the outcome recorded for this session.
   * `null` when no seed ran here and nothing is on record. NEVER invented.
   * (`false` never reaches a success path: an incomplete seed is rolled back and
   * `startDemoSession` throws `DemoDatasetIncompleteError` instead of returning.)
   */
  datasetComplete: boolean | null;
  datasetFailures: SeedDemoDatasetStageFailure[];
  /** Which of the cases above produced `datasetComplete`. */
  datasetStatusReason: DemoDatasetStatusReason;
};

/** Persisted shape behind `DEMO_PREF_SESSION_DATASET`. */
interface DemoDatasetOutcomeRecord {
  sessionId: string;
  complete: boolean;
  failures: SeedDemoDatasetStageFailure[];
  seededAt: string;
}

/**
 * Thrown when a REQUIRED seed stage failed. Carries the failures so the HTTP
 * layer can name them instead of returning a generic outage.
 *
 * Every entry in `SeedDemoDatasetResult.failures` is a required-stage failure by
 * construction — the seed logs non-required conditions (e.g. a deck `skipped`
 * because a human owns its content) as warnings and never puts them in
 * `failures`, so `complete === false` means exactly "a required part is missing".
 */
export class DemoDatasetIncompleteError extends Error {
  readonly code = 'DEMO_DATASET_INCOMPLETE';
  readonly organizationId: string;
  readonly failures: SeedDemoDatasetStageFailure[];
  /** False when the rollback of the half-provisioned tenant ITSELF failed. */
  readonly cleanedUp: boolean;

  constructor(params: {
    organizationId: string;
    failures: SeedDemoDatasetStageFailure[];
    cleanedUp: boolean;
  }) {
    super(
      `Demo dataset incomplete for ${params.organizationId}: ` +
        params.failures.map((f) => `${f.stage} (${f.detail})`).join('; ')
    );
    this.name = 'DemoDatasetIncompleteError';
    this.organizationId = params.organizationId;
    this.failures = params.failures;
    this.cleanedUp = params.cleanedUp;
  }
}

/**
 * Structural check — `instanceof` is unreliable once a module is loaded twice
 * (dynamic import in routes, vi.mock in tests), and this decides an HTTP code.
 */
export function isDemoDatasetIncompleteError(error: unknown): error is DemoDatasetIncompleteError {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'DEMO_DATASET_INCOMPLETE'
  );
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
    // The outcome describes a session that no longer exists — leaving it behind
    // would let the NEXT session quote a stale `complete` as if it were its own.
    clearPreference(userId, DEMO_PREF_SESSION_DATASET),
  ]);
}

async function recordDatasetOutcome(
  userId: string,
  record: DemoDatasetOutcomeRecord
): Promise<void> {
  try {
    await upsertPreference(userId, DEMO_PREF_SESSION_DATASET, JSON.stringify(record));
  } catch (error: unknown) {
    // Losing the record is not a reason to fail the session — it only means the
    // next resume answers `null` (unknown) instead of quoting this run.
    logger.warn(
      `[demoSessionService] could not record dataset outcome for ${userId}: ` +
        (error instanceof Error ? error.message : String(error))
    );
  }
}

async function readDatasetOutcome(userId: string): Promise<DemoDatasetOutcomeRecord | null> {
  try {
    await requireUserPreferencesTable();
    const row = await dbGet<{ value: string }>(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, DEMO_PREF_SESSION_DATASET],
      { fallback: true }
    );
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as Partial<DemoDatasetOutcomeRecord>;
    if (typeof parsed?.sessionId !== 'string' || typeof parsed?.complete !== 'boolean') {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      complete: parsed.complete,
      failures: Array.isArray(parsed.failures) ? parsed.failures : [],
      seededAt: typeof parsed.seededAt === 'string' ? parsed.seededAt : '',
    };
  } catch {
    // Unreadable record === no record. Never upgrade "cannot tell" to "fine".
    return null;
  }
}

/**
 * The recorded seed outcome for `sessionId`, or an explicit unknown. Exposed so
 * read-only routes (e.g. GET /api/demo/organization) can report the same signal
 * without re-running or faking a seed.
 */
export async function getRecordedDatasetOutcome(
  userId: string,
  sessionId: string | null | undefined
): Promise<{
  datasetComplete: boolean | null;
  datasetFailures: SeedDemoDatasetStageFailure[];
  datasetStatusReason: DemoDatasetStatusReason;
}> {
  if (!userId || !sessionId) {
    return {
      datasetComplete: null,
      datasetFailures: [],
      datasetStatusReason: 'resumed_session_no_seed_record',
    };
  }
  const record = await readDatasetOutcome(userId);
  if (!record || record.sessionId !== sessionId) {
    return {
      datasetComplete: null,
      datasetFailures: [],
      datasetStatusReason: 'resumed_session_no_seed_record',
    };
  }
  return {
    datasetComplete: record.complete,
    datasetFailures: record.failures,
    datasetStatusReason: 'resumed_session_recorded_outcome',
  };
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
  sessionOrgId?: string
): Promise<DemoSessionWithDataset> {
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

  const seed = await seedAtelierToysDemoDataset({
    organizationId: session.session_org_id,
    anchorDate: session.anchor_date,
    source: 'session',
    viewerUserId: userId,
    locale: session.locale,
  });

  // ★ PROVISIONING SAGA (MAT-006B). The seed is the FIRST step of provisioning a
  // per-user demo tenant; the `demo_sessions` / `demo_session_tenants` rows and
  // the preferences come after. If a required stage failed we must not walk on:
  // committing the session rows here is exactly what leaves a half-provisioned
  // tenant that looks live and is missing content. Compensating action: delete
  // the partial dataset (children-first purge, org row last) and abort.
  //
  // Safe by construction: `session_org_id` is minted in THIS call
  // (`makeSessionOrgId` embeds Date.now()), so nothing pre-existing can share it,
  // and the DEMO_ORG_ID guard mirrors expireDemoSession — the curated base org is
  // never deletable here.
  if (!seed.complete) {
    let cleanedUp = false;
    try {
      if (session.session_org_id && session.session_org_id !== DEMO_ORG_ID) {
        await deleteDemoDatasetForOrganization(session.session_org_id);
      }
      cleanedUp = true;
    } catch (cleanupError: unknown) {
      logger.error(
        `[demoSessionService] rollback of half-provisioned demo tenant ${session.session_org_id} FAILED: ` +
          (cleanupError instanceof Error ? cleanupError.message : String(cleanupError))
      );
    }
    logger.error(
      `[demoSessionService] demo session aborted for ${userId}: ${seed.failures.length} required stage failure(s), ` +
        `tenant ${session.session_org_id} ${cleanedUp ? 'rolled back' : 'LEFT BEHIND (cleanup failed)'}`
    );
    throw new DemoDatasetIncompleteError({
      organizationId: session.session_org_id,
      failures: seed.failures,
      cleanedUp,
    });
  }

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
  // Record the outcome so a LATER resume can quote it instead of assuming.
  await recordDatasetOutcome(userId, {
    sessionId: session.id,
    complete: seed.complete,
    failures: seed.failures,
    seededAt: nowIso(),
  });
  const stats = await getDemoDatasetStats(session.session_org_id);

  return {
    ...session,
    stats,
    // The ONLY place in this module that has first-hand knowledge of the seed.
    datasetComplete: seed.complete,
    datasetFailures: seed.failures,
    datasetStatusReason: 'seeded_in_this_call',
  };
}

export async function resolveOrCreateDemoSession(
  userId: string,
  source = 'demo_toggle',
  requestedLocale: DemoLocale | string = 'en',
  options: { restartOnLocaleMismatch?: boolean; sessionOrgId?: string } = {}
): Promise<DemoSessionWithDataset> {
  const locale = normalizeDemoLocale(requestedLocale);
  // ★ Branches below that RESUME a session (or serve the curated base org) run no
  // seed at all. They used to inherit `datasetComplete: true`, which was a
  // FABRICATION: "no seed ran in this call" is not evidence that the dataset is
  // whole — it is the absence of evidence. A resume now quotes the recorded
  // outcome for its own session id, or reports `null` (unknown) with a reason.
  const baseOrgNoSeed = {
    datasetComplete: null,
    datasetFailures: [] as SeedDemoDatasetStageFailure[],
    datasetStatusReason: 'base_org_not_seeded_by_this_call' as const,
  };

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
        ...baseOrgNoSeed,
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
      ...baseOrgNoSeed,
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
      // Real value when the seeding call left a record for THIS session id,
      // `null` otherwise. Never `true` by default.
      ...(await getRecordedDatasetOutcome(userId, active.id)),
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
