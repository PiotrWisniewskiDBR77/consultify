import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import pg from 'pg';

export type ExecutionPersona = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  role: 'ADMIN';
};
export type ExecutionSeed = {
  projectId: string;
  initiativeId: string;
  caseId: string;
  artifactLinkId: string;
};

/**
 * The five Menu-2 tabs `ExecutionHub.renderContent()` actually resolves. Each of
 * these has an unconditional early `return` at the TOP of `renderContent`
 * (`src/components/Execution/ExecutionHub.tsx:5506` list, `:5514` work, `:5521`
 * resources, `:5528` control, `:5545` reports), so every later branch in that
 * same function — including the legacy `activeTab === 'list'` block at `:5679`
 * that mounts `ExecutionIntelligencePanel` / `ExecutionChangeSignalsPanel` /
 * `ExecutionWhatIfSandbox`, the `'summary'` branch at `:5613` and the
 * `'people_change'` branch at `:5634` — is shadowed and unreachable.
 */
export const REACHABLE_EXECUTION_TABS = [
  'list',
  'work',
  'resources',
  'control',
  'reports',
] as const;

/**
 * The nine `runtime_state='IMPLEMENTED'` rows of `execution_action_registry`.
 * Asserted against the LIVE registry (never hardcoded as the only source) so a
 * registry change fails this suite instead of silently invalidating it.
 */
export const GOVERNED_ACTION_IDS = [
  'case.artifact.unlink',
  'case.cancel',
  'case.close',
  'case.proposal.decide',
  'case.proposal.execute',
  'case.proposal.revoke',
  'case.run.cancel',
  'case.wait.cancel',
  'execution.budget.delete',
] as const;

export const HIDDEN_ACTION_IDS = [
  'execution.initiative.archive',
  'execution.initiative.delete',
  'execution.report.archive',
  'execution.report.edit',
] as const;

/**
 * Request-URL shapes that can only be produced by invoking one of the nine
 * governed writers. Derived from the route definitions, NOT from the client:
 *   DELETE /artifact-links/:linkId                      case.artifact.unlink
 *   POST   /cases/:caseId/{status,cancel,closure}       case.cancel / case.close
 *   POST   /proposals/:id/{decision,revoke,
 *                          transition-to-executing}     case.proposal.*
 *   POST   /runs/:runId/cancel                          case.run.cancel
 *   POST   /waits/:waitId/cancel                        case.wait.cancel
 *   DELETE /execution-control/budget/entries/:entryId   execution.budget.delete
 */
export const GOVERNED_ROUTE_PATTERNS: ReadonlyArray<{ actionId: string; test: RegExp }> = [
  { actionId: 'case.artifact.unlink', test: /\/artifact-links\/[^/?#]+(?:[?#].*)?$/ },
  { actionId: 'case.cancel', test: /\/cases\/[^/]+\/(?:cancel|status)(?:[?#].*)?$/ },
  { actionId: 'case.close', test: /\/cases\/[^/]+\/closure(?:[?#].*)?$/ },
  { actionId: 'case.proposal.decide', test: /\/proposals\/[^/]+\/decision(?:[?#].*)?$/ },
  {
    actionId: 'case.proposal.execute',
    test: /\/proposals\/[^/]+\/transition-to-executing(?:[?#].*)?$/,
  },
  { actionId: 'case.proposal.revoke', test: /\/proposals\/[^/]+\/revoke(?:[?#].*)?$/ },
  { actionId: 'case.run.cancel', test: /\/runs\/[^/]+\/cancel(?:[?#].*)?$/ },
  { actionId: 'case.wait.cancel', test: /\/waits\/[^/]+\/cancel(?:[?#].*)?$/ },
  { actionId: 'execution.budget.delete', test: /\/execution-control\/budget\/entries\/[^/?#]+/ },
];

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const APP = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const CLEANUP_OPT_IN = 'EXE_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP';
const DB_PREFIX_ENV = 'EXE_UI_TEST_DB_PREFIX';
const RECEIPT_TRIGGER = 'trg_rvn_execution_signal_receipts_immutable';
const supportHeaders = { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' };
export const authHeaders = (p: ExecutionPersona) => ({
  Authorization: `Bearer ${p.token}`,
  'content-type': 'application/json',
});

async function checked(response: Awaited<ReturnType<APIRequestContext['post']>>, label: string) {
  if (!response.ok()) throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  return response.json();
}

export async function bootstrap(
  request: APIRequestContext,
  runId: string
): Promise<ExecutionPersona> {
  const response = await request.post(`${API}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role: 'ADMIN' },
  });
  return { ...(await checked(response, 'bootstrap')), role: 'ADMIN' };
}

export async function addAdmin(
  request: APIRequestContext,
  tenant: ExecutionPersona
): Promise<ExecutionPersona> {
  const response = await request.post(`${API}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId: tenant.runId, role: 'ADMIN' },
  });
  return { ...(await checked(response, 'add admin')), role: 'ADMIN' };
}

export async function seedExecution(persona: ExecutionPersona): Promise<ExecutionSeed> {
  const suffix = persona.runId.replace(/[^a-zA-Z0-9-]/g, '').slice(-32);
  const seed = {
    projectId: `exe-ui-project-${suffix}`,
    initiativeId: `exe-ui-initiative-${suffix}`,
    caseId: `exe-ui-case-${suffix}`,
    artifactLinkId: `exe-ui-artifact-${suffix}`,
  };
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      seed.projectId,
      persona.organizationId,
    ]);
    await db.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status) VALUES($1,$2,$3,$1,'EXECUTING')`,
      [seed.initiativeId, persona.organizationId, seed.projectId]
    );
    await db.query(
      `INSERT INTO case_core(case_id,organization_id,project_id,contracted_closure_type,created_by_actor_id,case_name) VALUES($1,$2,$3,'DELIVERY_COMPLETED',$4,$1)`,
      [seed.caseId, persona.organizationId, seed.projectId, persona.userId]
    );
    await db.query(
      `INSERT INTO case_workspace_artifact_links(link_id,organization_id,project_id,case_id,artifact_type,artifact_id,artifact_revision,relation,linked_by_actor_id,linked_at) VALUES($1,$2,$3,$4,'document',$5,'sha256:exe-ui-revision','DELIVERABLE',$6,now()::text)`,
      [
        seed.artifactLinkId,
        persona.organizationId,
        seed.projectId,
        seed.caseId,
        `document-${suffix}`,
        persona.userId,
      ]
    );
    return seed;
  } finally {
    await db.end();
  }
}

export async function signedContext(
  browser: Browser,
  persona: ExecutionPersona,
  /**
   * Extra localStorage entries seeded BEFORE first paint. Used only for the
   * product's own documented runtime feature flags (e.g. `ff.caseWorkspace`,
   * `src/components/CaseWorkspace/caseWorkspaceFlag.ts`), never for auth: the
   * token/user entries below are the sole session, and the backend still runs
   * the real verifyToken chain with E2E_MODE and ENABLE_TEST_AUTH_BYPASS unset.
   */
  extraLocalStorage: Readonly<Record<string, string>> = {}
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: APP,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(
    ({ p, origin, extra }) => {
      if (location.origin !== origin) return;
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(key, value);
      const user = {
        id: p.userId,
        email: 'execution@local.test',
        role: p.role,
        organizationId: p.organizationId,
        organizationName: 'Execution technical tenant',
        isAuthenticated: true,
        accessLevel: 'full',
        isDemo: false,
      };
      localStorage.setItem('token', p.token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(`consultify_onboarding_done:${p.userId}`, 'true');
      localStorage.setItem(
        'consultify-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            isDemoMode: false,
            isDemoSession: false,
            currentUser: user,
            currentOrganization: { id: p.organizationId, name: user.organizationName },
          },
          version: 0,
        })
      );
    },
    { p: persona, origin: new URL(APP).origin, extra: extraLocalStorage }
  );
  return context;
}

export type ConsoleWatch = {
  /** Every console message of type 'error', verbatim. */
  errors: string[];
  /** Non-2xx responses observed on this page, as `<status> <method> <url>`. */
  failedResponses: string[];
  /** Subset of failedResponses whose status is exactly 403. */
  forbidden403: string[];
};

/**
 * Attach a console/network watcher BEFORE navigating.
 *
 * The historical G4 for this task recorded 78 console errors, all of them 403s —
 * i.e. surfaces rendering against calls the signed identity was not entitled to
 * make. That is a product finding, not noise, so every journey here reports its
 * own counts instead of ignoring them.
 */
export function attachConsoleWatch(page: Page): ConsoleWatch {
  const watch: ConsoleWatch = { errors: [], failedResponses: [], forbidden403: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') watch.errors.push(message.text());
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const entry = `${status} ${response.request().method()} ${response.url()}`;
    watch.failedResponses.push(entry);
    if (status === 403) watch.forbidden403.push(entry);
  });
  return watch;
}

async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** Live `execution_action_registry` split by runtime_state — read from the real DB. */
export async function readActionRegistry(): Promise<{
  implemented: string[];
  hidden: string[];
}> {
  return withDb(async (db) => {
    const rows = await db.query<{ action_id: string; runtime_state: string }>(
      `SELECT action_id, runtime_state FROM execution_action_registry ORDER BY action_id`
    );
    return {
      implemented: rows.rows.filter((r) => r.runtime_state === 'IMPLEMENTED').map((r) => r.action_id),
      hidden: rows.rows.filter((r) => r.runtime_state === 'HIDDEN').map((r) => r.action_id),
    };
  });
}

/**
 * Governed-action audit rows for one tenant. `execution_action_audit` is
 * append-only (trg_execution_action_audit_immutable), so this only ever grows —
 * it is a durable, non-forgeable witness that a governed writer really ran.
 */
export async function countGovernedAudit(organizationId: string): Promise<number> {
  return withDb(async (db) => {
    const rows = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM execution_action_audit WHERE organization_id=$1`,
      [organizationId]
    );
    return Number(rows.rows[0]?.count ?? '0');
  });
}

/** Authoritative case lifecycle columns, read straight from Postgres. */
export async function readCaseState(
  caseId: string
): Promise<{ caseStatus: string | null; closureType: string | null }> {
  return withDb(async (db) => {
    const rows = await db.query<{ case_status: string | null; closure_type: string | null }>(
      `SELECT case_status, closure_type FROM case_core WHERE case_id=$1`,
      [caseId]
    );
    return {
      caseStatus: rows.rows[0]?.case_status ?? null,
      closureType: rows.rows[0]?.closure_type ?? null,
    };
  });
}

/** Revoke the persona's membership in place — used for fail-closed assertions. */
export async function revokeMembership(persona: ExecutionPersona): Promise<void> {
  await withDb(async (db) => {
    await db.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [persona.organizationId, persona.userId]
    );
  });
}

/**
 * Every table this fixture writes, in child-before-parent order. Cleanup deletes
 * from ALL of them and the post-COMMIT residue object enumerates ALL of them by
 * name — a spot check on two tables would hide residue in the other six.
 *
 * `execution_action_audit` is deliberately NOT in this list: it is append-only
 * behind trg_execution_action_audit_immutable and BOTH delete and update are
 * rejected, so it can never be cleaned. It is measured separately and reported
 * as permanent.
 */
export const FIXTURE_WRITTEN_TABLES = [
  'rvn_execution_signal_receipts',
  'execution_results_signal_outbox',
  'execution_delivery_evidence',
  'execution_case_links',
  'case_workspace_artifact_links',
  'case_core',
  'initiatives',
  'projects',
] as const;

/** Named triggers whose enabled state gates the validity of this whole suite. */
const GUARDED_TRIGGERS: ReadonlyArray<{ table: string; trigger: string }> = [
  { table: 'rvn_execution_signal_receipts', trigger: RECEIPT_TRIGGER },
  { table: 'execution_action_audit', trigger: 'trg_execution_action_audit_immutable' },
];

/**
 * Fixed, deterministic advisory-lock key. A random key would let two concurrent
 * cleanups interleave; a deterministic one serialises them. Session-scoped
 * (pg_advisory_lock, not _xact_) so it is RETAINED across the pinned
 * transaction and released explicitly in the nested finally.
 */
export const CLEANUP_ADVISORY_LOCK_KEY = 774812003;

export type ResidueReport = {
  perTable: Record<string, number>;
  /**
   * Advisory locks held on THIS harness's deterministic key. This is the
   * assertable number: it is exactly the lock cleanup takes and releases.
   */
  harnessAdvisoryLocksOnFixedKey: number;
  /**
   * ALL advisory locks in the database, including any the application backend
   * holds for its own reasons. Informational only — asserting on it would be
   * racy, because a lock the running app takes mid-measurement is not residue
   * this fixture created or can release.
   */
  advisoryLocksGlobal: number;
  appendOnlyExecutionActionAudit: number;
};

/**
 * Hard disposable-database namespace.
 *
 * A caller-chosen name is not a guard; it is a comment. ALL THREE of the
 * following must hold before any mutation, and any missing one fails closed:
 *   1. the database name matches /^cb_exe_/ ;
 *   2. DATABASE_URL's database component and current_database() are EXACTLY
 *      EQUAL — equality, never substring/contains, because a contains-check
 *      would accept a production database whose name merely embeds the prefix
 *      (e.g. `prod_cb_exe_live`);
 *   3. the host is local (127.0.0.1 / localhost / ::1).
 * The regex is the point: it is never relaxed to accommodate an existing
 * database that does not conform.
 */
const DISPOSABLE_DB_NAMESPACE = /^cb_exe_/;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function requireDisposableDatabaseName(): string {
  if (process.env[CLEANUP_OPT_IN] !== '1') {
    throw new Error(`${CLEANUP_OPT_IN}=1 is required for EXE UI fixture cleanup`);
  }
  const declared = process.env[DB_PREFIX_ENV]?.trim();
  if (!declared) throw new Error(`${DB_PREFIX_ENV} is required for EXE UI fixture cleanup`);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for EXE UI fixture cleanup');

  const url = new URL(connectionString);
  const callerDbName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  // (1) namespace
  if (!DISPOSABLE_DB_NAMESPACE.test(callerDbName)) {
    throw new Error(
      `refusing EXE UI cleanup: DATABASE_URL database "${callerDbName}" is outside the disposable namespace ${DISPOSABLE_DB_NAMESPACE}`
    );
  }
  if (!DISPOSABLE_DB_NAMESPACE.test(declared)) {
    throw new Error(
      `refusing EXE UI cleanup: ${DB_PREFIX_ENV}="${declared}" is outside the disposable namespace ${DISPOSABLE_DB_NAMESPACE}`
    );
  }
  // (2) exact equality between the declared name and the caller's URL
  if (callerDbName !== declared) {
    throw new Error(
      `refusing EXE UI cleanup: DATABASE_URL database "${callerDbName}" !== declared disposable "${declared}"`
    );
  }
  // (3) local host only
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`refusing EXE UI cleanup: host ${url.hostname} is not local`);
  }
  return declared;
}

/**
 * Assert the EXACT single trigger row by name — not a count, not "at least
 * one". A restoration that re-enabled some other trigger must not be able to
 * pass this check.
 */
async function assertExactTriggerEnabled(
  db: pg.Client,
  table: string,
  trigger: string,
  phase: string
): Promise<void> {
  const rows = await db.query<{ tgenabled: string }>(
    `SELECT t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      WHERE c.oid=$1::regclass AND t.tgname=$2`,
    [table, trigger]
  );
  if (rows.rowCount !== 1) {
    throw new Error(
      `${trigger} on ${table}: expected exactly 1 trigger row at ${phase}, found ${rows.rowCount}`
    );
  }
  if (rows.rows[0].tgenabled !== 'O') {
    throw new Error(
      `${trigger} on ${table} is tgenabled='${rows.rows[0].tgenabled}' at ${phase} (expected 'O')`
    );
  }
}

async function assertGuardedTriggersEnabled(db: pg.Client, phase: 'start' | 'end'): Promise<void> {
  for (const { table, trigger } of GUARDED_TRIGGERS) {
    await assertExactTriggerEnabled(db, table, trigger, phase);
  }
}

/**
 * Release the retained advisory lock WITH PROOF, before the client is released.
 * pg_advisory_unlock must return TRUE — merely calling it proves nothing — and
 * the same session must then hold zero advisory locks. A lock released only by
 * connection teardown is not a released lock anyone can claim.
 */
async function releaseAdvisoryLockWithProof(db: pg.Client): Promise<void> {
  const unlock = await db.query<{ released: boolean }>(
    'SELECT pg_advisory_unlock($1) AS released',
    [CLEANUP_ADVISORY_LOCK_KEY]
  );
  if (unlock.rows[0]?.released !== true) {
    throw new Error(
      `pg_advisory_unlock(${CLEANUP_ADVISORY_LOCK_KEY}) returned ${String(unlock.rows[0]?.released)} — the lock was not held by this session`
    );
  }
  const held = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM pg_locks
      WHERE locktype='advisory' AND pid=pg_backend_pid()`
  );
  if (Number(held.rows[0]?.count ?? '-1') !== 0) {
    throw new Error(
      `session still holds ${held.rows[0]?.count} advisory lock(s) after unlock`
    );
  }
}

/** Post-COMMIT residue across EVERY written table, plus the append-only witness. */
export async function measureResidue(organizationId: string): Promise<ResidueReport> {
  return withDb(async (db) => {
    const perTable: Record<string, number> = {};
    for (const table of FIXTURE_WRITTEN_TABLES) {
      const row = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${table} WHERE organization_id=$1`,
        [organizationId]
      );
      perTable[table] = Number(row.rows[0]?.count ?? '0');
    }
    // A bigint advisory key below 2^31 is stored as classid=0, objid=key,
    // objsubid=1 — so this counts exactly the lock this harness takes.
    const mine = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_locks
        WHERE locktype='advisory' AND classid=0 AND objid=$1 AND objsubid=1`,
      [CLEANUP_ADVISORY_LOCK_KEY]
    );
    const allLocks = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_locks WHERE locktype='advisory'`
    );
    const audit = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM execution_action_audit WHERE organization_id=$1`,
      [organizationId]
    );
    return {
      perTable,
      harnessAdvisoryLocksOnFixedKey: Number(mine.rows[0]?.count ?? '0'),
      advisoryLocksGlobal: Number(allLocks.rows[0]?.count ?? '0'),
      appendOnlyExecutionActionAudit: Number(audit.rows[0]?.count ?? '0'),
    };
  });
}

export type CleanupOptions = {
  /**
   * Test-only fault injection: abort the pinned transaction AFTER the first
   * delete. Used to prove the recovery path really recovers — a cleanup path
   * that has never failed is not a proven cleanup path.
   */
  failAfterFirstDelete?: boolean;
  /**
   * Test-only fault injection in the TRIGGER stage (frame 2), used to prove the
   * advisory-unlock proof in frame 3 still runs and still asserts when the
   * trigger fallback or its assertion fails.
   */
  failDuringTriggerRestore?: boolean;
};

/**
 * Reclaim one fixture tenant.
 *
 * Structure, in order: disposable-name guard -> connect -> assert guarded
 * triggers are 'O' AT THE START (a trigger disabled before we began would
 * invalidate every assertion this suite made) -> take the retained
 * deterministic advisory lock -> pinned transaction -> NESTED finally that
 * always re-enables the receipt trigger, re-asserts 'O', and releases the lock
 * even when the transaction threw -> unconditional db.end().
 */
export async function cleanup(
  request: APIRequestContext,
  persona: ExecutionPersona,
  options: CleanupOptions = {}
): Promise<void> {
  const declared = requireDisposableDatabaseName();
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let committed = false;
  try {
    // START-of-run invariant, not only end-of-run: a trigger already disabled
    // before we began would invalidate every assertion this suite made.
    await assertGuardedTriggersEnabled(db, 'start');

    // current_database() must EXACTLY equal the declared disposable name.
    const currentDb = await db.query<{ current_database: string }>('SELECT current_database()');
    const live = currentDb.rows[0]?.current_database;
    if (live !== declared) {
      throw new Error(
        `refusing EXE UI cleanup: current_database() "${live ?? '<unknown>'}" !== declared disposable "${declared}"`
      );
    }

    // Retained, deterministic, session-scoped lock.
    await db.query('SELECT pg_advisory_lock($1)', [CLEANUP_ADVISORY_LOCK_KEY]);
    // FRAME 3 (advisory-unlock proof). Its own finally, so that a failure in
    // the trigger stage below — the fallback ALTER or the tgenabled='O'
    // assertion — cannot skip proving the lock was actually released. A
    // guarantee only ever exercised on the happy path is not a guarantee.
    try {
      // FRAME 2 (trigger restoration + proof). Also its own frame, so that a
      // throw from the transaction cannot skip restoring the guard.
      try {
        await db.query('BEGIN');
        try {
          await db.query(
            `ALTER TABLE rvn_execution_signal_receipts DISABLE TRIGGER ${RECEIPT_TRIGGER}`
          );
          let deleted = 0;
          for (const table of FIXTURE_WRITTEN_TABLES) {
            await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [
              persona.organizationId,
            ]);
            deleted += 1;
            if (options.failAfterFirstDelete && deleted === 1) {
              throw new Error('INJECTED_CLEANUP_FAILURE_AFTER_FIRST_DELETE');
            }
          }

          // ---- PRIMARY restoration path: re-enable and PROVE the exact
          // trigger row is back to 'O' INSIDE the pinned transaction, BEFORE
          // COMMIT. Never commit while the guard is down: a commit with the
          // append-only trigger disabled opens a window in which the invariant
          // does not hold, and no later restoration makes that window not have
          // existed.
          await db.query(
            `ALTER TABLE rvn_execution_signal_receipts ENABLE TRIGGER ${RECEIPT_TRIGGER}`
          );
          await assertExactTriggerEnabled(
            db,
            'rvn_execution_signal_receipts',
            RECEIPT_TRIGGER,
            'pre-COMMIT (inside pinned transaction)'
          );

          await db.query('COMMIT');
          committed = true;
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      } finally {
        // FAILURE FALLBACK ONLY. On the happy path the trigger was already
        // restored and proven before COMMIT, so this does nothing. It exists so
        // a mid-transaction throw whose ROLLBACK did not restore the trigger
        // cannot leave the guard down.
        if (!committed) {
          await db
            .query(`ALTER TABLE rvn_execution_signal_receipts ENABLE TRIGGER ${RECEIPT_TRIGGER}`)
            .catch(() => undefined);
        }
        // Test-only fault injection targeting THIS stage specifically, to prove
        // the unlock proof in FRAME 3 still runs when the trigger stage fails.
        if (options.failDuringTriggerRestore) {
          throw new Error('INJECTED_TRIGGER_STAGE_FAILURE');
        }
        await assertGuardedTriggersEnabled(db, 'end');
      }
    } finally {
      // Proof-carrying release, BEFORE the client is released. Reached even
      // when FRAME 2 threw.
      await releaseAdvisoryLockWithProof(db);
    }
  } finally {
    // OUTERMOST: unconditional, so no path leaks a connection.
    await db.end();
  }

  const response = await request.post(`${API}/api/test-support/cleanup`, {
    headers: supportHeaders,
    data: { runId: persona.runId },
    // Generous on purpose: this suite drives many concurrent signed page loads
    // and the shared local backend can still be draining them at teardown. A
    // short timeout would report a resource stall as a fixture failure.
    timeout: 120_000,
  });
  if (!response.ok()) throw new Error(`cleanup: ${response.status()} ${await response.text()}`);
}

/**
 * Reclaim several tenants so that ONE failure cannot skip the others.
 * Sequential settle-then-aggregate: every persona is attempted, and only after
 * all attempts does the first failure surface.
 */
export async function cleanupAll(
  request: APIRequestContext,
  personas: ReadonlyArray<ExecutionPersona | null>
): Promise<void> {
  const failures: unknown[] = [];
  for (const persona of personas) {
    if (!persona) continue;
    try {
      await cleanup(request, persona);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
}
