/**
 * @vitest-environment node
 *
 * ADM-OPS-ALERT — admin IAM queue alert evaluator, real PostgreSQL only.
 *
 * PROVES (see docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md, "Queue alert
 * conditions", for the authoritative predicates this suite pins to):
 *
 *  1. ADMIN_IAM_JOB_STALE fires deterministically when a `running` job's
 *     lease has expired (`lease_expires_at < now()`), driven by an explicit
 *     `now` — never a sleep.
 *  2. ADMIN_IAM_JOB_FAILED fires once a job exhausts retries into terminal
 *     `failed`.
 *  3. Evaluating the SAME condition at the SAME `now` twice is idempotent:
 *     exactly one DETECTED row lands in operational_alert_delivery_outbox
 *     for that org+kind, and `version` does not advance on replay.
 *  4. The outbox payload's `runbookId` is exactly the exported
 *     ADMIN_IAM_ALERT_RUNBOOK_ID constant, and that id's anchor is a real
 *     heading that exists in docs/runbooks/ADMIN_IAM_OPERATIONS_RUNBOOK.md
 *     on disk — a link to nowhere fails this test.
 *  5. The alert payload never carries the job's own payload, its last_error
 *     text, or its lease token, and contains no secret-shaped key/value.
 *  6. Both kinds RECOVER once their underlying condition clears, and the
 *     durable transition sequence recorded in the outbox is exactly
 *     ['DETECTED','RECOVERED'].
 *  7. Tenant isolation holds in both directions: a condition seeded only
 *     under one org never activates another org's state, and firing is
 *     verified independently on the org where the condition WAS seeded.
 *  8. A fully healthy tenant (claimed and completed, nothing stale, nothing
 *     failed) produces no ACTIVE state for either kind.
 *  9. This suite's own writes leave zero orphaned admin_iam_job_events rows,
 *     and the pre-existing append-only trigger on operational_alert_signals
 *     still rejects a raw UPDATE — this evaluator does not touch that table
 *     (per the binding contract: it writes directly to
 *     operational_alert_tenant_states and operational_alert_delivery_outbox,
 *     no migration, no operational_alert_signals), and this test proves that
 *     boundary was not blurred and the existing guard was not weakened.
 *
 * Two deliberate design notes, spelled out because the contract does not
 * fix them and a reviewer should not have to reverse-engineer this suite:
 *
 *  - Recovering ADMIN_IAM_JOB_STALE: the runbook is explicit that a stale
 *    `running` lease "will not self-heal" — `claimAdminIamJob` only reclaims
 *    rows still `queued`. The one legitimate service-level way to take the
 *    job out of `running` is `completeAdminIamJob` under its ORIGINAL lease
 *    token; that function checks `status='running' AND lease_token=?`, not
 *    lease expiry, so completing under the still-known token is a real
 *    lifecycle transition, not a backdoor. This test seeds its OWN stale job
 *    (see org `orgStaleRecovery` below) rather than reusing the job the
 *    ADMIN_IAM_JOB_STALE-firing test created, so the two tests do not depend
 *    on execution order.
 *  - Recovering ADMIN_IAM_JOB_FAILED: the runbook's detection predicate is
 *    literally "admin_iam_jobs rows with status='failed'", with no window
 *    and no job_type/idempotency scoping. `adminIamOperationsService.ts`
 *    exposes no function that ever moves a job OUT of terminal `failed`
 *    (enqueue/claim/complete/fail all require a prior status that `failed`
 *    does not satisfy), and the runbook forbids ever flipping it to
 *    `succeeded` by hand. NO SUPPORTED REMEDIATION PATH HAS BEEN PROVEN for
 *    taking a job out of terminal `failed`. So the only way the evaluator's
 *    own query can see the failed count return to zero is for the terminal
 *    row to actually leave `admin_iam_jobs`. This suite (a) performs the
 *    real remediation — enqueues a NEW job under a NEW idempotency key and
 *    lets it succeed — and (b) separately, as a CONTROLLED TEST-ONLY
 *    ARCHIVAL/REMOVAL (not a remediation path, and not evidence one exists),
 *    deletes the old terminal row directly via SQL, the same
 *    disable/delete/enable-trigger-shaped direct SQL the sibling OPS-OBS
 *    suite already uses for its own out-of-band cleanup (no trigger to
 *    disable here; the two admin-iam tables carry no append-only guard).
 *    This never touches `status`; it stands in for an archival capability
 *    this service does not yet expose as a function, so the evaluator's next
 *    run observes the state honestly rather than being told a lie. See the
 *    reworded test title and inline comment on that `it` block below for the
 *    exact, undressed statement of what is and is not proven. Like the
 *    stale-recovery test above, this test seeds its OWN failed job (org
 *    `orgFailedRecovery`, its own idempotency keys) rather than reusing the
 *    job the ADMIN_IAM_JOB_FAILED-firing test created, so neither recovery
 *    test depends on its corresponding firing test — or on each other —
 *    having run first. Both recovery pairs in this suite are order-
 *    independent of every other `it` block.
 *
 * REQUIRES A REAL DATABASE. When one is not configured this file collects
 * and SKIPS the whole suite (describe.skipIf) — it makes zero assertions in
 * that case and is not a substitute for actually running it.
 *
 * DATABASE SAFETY HARNESS — eight properties this file enforces, independent
 * of what any individual `it` proves about the evaluator:
 *
 *  H1. EXPLICIT DISPOSABLE DATABASE GUARD. Gated at module load by two
 *      opt-in env vars (below) in addition to RUN_DB_TESTS/MOCK_DB, AND
 *      re-verified live via `assertDisposableDatabase()` — a
 *      `SELECT current_database()` compared against the declared prefix,
 *      PLUS the database name embedded in DATABASE_URL itself compared
 *      against what the live connection reports — before anything else
 *      runs, and again immediately before the destructive cleanup in
 *      afterAll. The env var is never trusted alone. Same shape as
 *      tests/integration/partners/partner-economics-telemetry.realdb.test.ts's
 *      assertDisposableDatabase.
 *  H2. RETAINED SESSION ADVISORY LOCK. `pg_advisory_lock` is taken on a
 *      dedicated PoolClient (`lockClient`, checked out from a dedicated
 *      Pool) and held for the whole suite, so two concurrent runs against
 *      the same disposable database cannot interleave. Lock namespace
 *      `adm-iam-alert-pgtest-harness-lock` is disjoint from the evaluator's
 *      own `adm-iam-alert-eval:*` and the sibling ops evaluator's
 *      `ops-eval:*`. Released explicitly in afterAll.
 *  H3. PINNED TRANSACTIONAL CLEANUP. All teardown DELETEs run inside one
 *      explicit BEGIN...COMMIT on that SAME retained `lockClient` — never
 *      on `db` or on an ad hoc pool connection.
 *  H4. EXACT NAMED TRIGGER HANDLING. The append-only guard on
 *      operational_alert_signals is disabled and re-enabled BY ITS EXACT
 *      NAME (`trg_operational_alert_signals_immutable`) — never a blanket
 *      DISABLE TRIGGER ALL — and `tgenabled='O'` is asserted INSIDE the
 *      transaction, before COMMIT, so a failure to restore the guard aborts
 *      the whole cleanup transaction instead of ever being committed.
 *  H5. FAILURE PATHS. The disable/delete/re-enable/assert sequence runs in
 *      a try/catch that ROLLBACKs on any error (Postgres DDL is
 *      transactional, so ROLLBACK genuinely restores the trigger too — a
 *      mid-cleanup failure cannot leave it disabled). A nested `finally`
 *      unconditionally unlocks the advisory lock, releases `lockClient`,
 *      and ends both the guard Pool and `db`, so a mid-test failure never
 *      leaves a disabled trigger, a held lock, or a leaked connection.
 *  H6. POSTCOMMIT VERIFICATION. After COMMIT, zero residue is asserted
 *      across every table this suite owns or writes — admin_iam_jobs,
 *      admin_iam_job_events, operational_alert_tenant_states,
 *      operational_alert_delivery_outbox, and this suite's own probe row in
 *      operational_alert_signals — and zero advisory locks are asserted
 *      held by this backend after the explicit unlock.
 *  H7. PREFLIGHT TRIGGER ASSERTION. Before this suite performs its first
 *      write, beforeAll asserts — right after the disposable-database guard,
 *      before any BEGIN or mutation — that exactly ONE non-internal trigger
 *      exists on operational_alert_signals and that its tgenabled = 'O'. If
 *      the guard were already disabled (or duplicated, or missing) when the
 *      suite starts, every append-only assertion made afterwards would be
 *      worthless; this preflight makes that condition fail loudly, naming
 *      the actual count and state, instead of going unnoticed.
 *  H8. PRE-COMMIT (IN-TRANSACTION) RESIDUE ASSERTION. In addition to H6's
 *      postcommit check, the SAME scoped residue assertion — RESIDUE_TABLES
 *      plus operational_alert_signals scoped to orgGuardProbe — runs INSIDE
 *      the cleanup transaction, after the DELETEs and before COMMIT. H6
 *      proves the COMMIT persisted; H8 proves the DELETEs actually matched.
 *      Both are needed and they prove different things.
 *
 * Run (now requires two additional opt-in env vars beyond RUN_DB_TESTS,
 * MOCK_DB, DATABASE_URL — see H1 above):
 *
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://user:pass@host:port/db \
 *     ADMIN_IAM_ALERT_PGTEST_ALLOW_DESTRUCTIVE_FIXTURE=1 \
 *     ADMIN_IAM_ALERT_PGTEST_DISPOSABLE_DB_PREFIX=<prefix-of-the-db-name-above> \
 *     npx vitest run server/src/services/__tests__/adminIamAlertEvaluator.pg.test.ts
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Client, Pool } from 'pg';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  claimAdminIamJob,
  completeAdminIamJob,
  enqueueAdminIamJob,
  failAdminIamJob,
} from '../adminIamOperationsService.js';
import {
  ADMIN_IAM_ALERT_RUNBOOK_ID,
  ADMIN_IAM_ALERT_THRESHOLDS,
  evaluateAdminIamQueueAlerts,
} from '../adminIamAlertEvaluator.js';

const DATABASE_URL = process.env.DATABASE_URL || '';

/* ==========================================================================
 * H1 — explicit disposable-database guard. Opt-in env vars are the
 * module-load-time half of the gate (cheap, no connection needed yet); the
 * live half (`assertDisposableDatabase`) runs in beforeAll and again
 * immediately before the destructive cleanup in afterAll, and never trusts
 * the env var alone.
 * ========================================================================== */

const DISPOSABLE_DB_ENABLE_ENV = 'ADMIN_IAM_ALERT_PGTEST_ALLOW_DESTRUCTIVE_FIXTURE';
const DISPOSABLE_DB_PREFIX_ENV = 'ADMIN_IAM_ALERT_PGTEST_DISPOSABLE_DB_PREFIX';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres') &&
  process.env[DISPOSABLE_DB_ENABLE_ENV] === '1' &&
  Boolean(String(process.env[DISPOSABLE_DB_PREFIX_ENV] ?? '').trim());

// Same reasoning as adminIamBvp.pg.test.ts: adminIamOperationsService.ts
// goes through the DbPromise abstraction, which reads DB_TYPE lazily on
// first real call — set it before any test body runs, not inside a hook.
if (REAL_PG) process.env.DB_TYPE = 'postgres';

class UnsafeCleanupTargetError extends Error {}

function parseDatabaseNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return '';
  }
}

/**
 * H1. Never trusts DISPOSABLE_DB_ENABLE_ENV / DISPOSABLE_DB_PREFIX_ENV alone.
 * Confirms, with a LIVE `SELECT current_database()` on the actual connection
 * passed in, that the database really is prefixed as declared, AND that the
 * database name embedded in DATABASE_URL (the "caller URL") matches what the
 * server reports for that same connection — guarding against DB_TYPE/
 * DbPromise's lazy connection-string resolution silently landing on a
 * different database than the one this file thinks it opened.
 */
async function assertDisposableDatabase(client: Client | PoolClient): Promise<string> {
  if (process.env[DISPOSABLE_DB_ENABLE_ENV] !== '1') {
    throw new UnsafeCleanupTargetError(`${DISPOSABLE_DB_ENABLE_ENV}=1 is required before this suite may run`);
  }
  const prefix = String(process.env[DISPOSABLE_DB_PREFIX_ENV] ?? '').trim();
  if (!prefix) {
    throw new UnsafeCleanupTargetError(`${DISPOSABLE_DB_PREFIX_ENV} is required (disposable database name prefix)`);
  }
  const result = await client.query<{ db: string }>('SELECT current_database() AS db');
  const liveDatabase = String(result.rows[0]?.db ?? '');
  if (!liveDatabase.startsWith(prefix)) {
    throw new UnsafeCleanupTargetError(
      `Refusing to run: live current_database() "${liveDatabase}" does not start with declared disposable prefix "${prefix}" (${DISPOSABLE_DB_PREFIX_ENV})`
    );
  }
  const urlDatabase = parseDatabaseNameFromUrl(DATABASE_URL);
  if (urlDatabase !== liveDatabase) {
    throw new UnsafeCleanupTargetError(
      `Refusing to run: DATABASE_URL names database "${urlDatabase}" but the live connection reports current_database() "${liveDatabase}" — caller URL and server disagree`
    );
  }
  return liveDatabase;
}

/* ==========================================================================
 * H2 — lock namespace, disjoint from adm-iam-alert-eval:* (the evaluator
 * under test) and ops-eval:* (the sibling ops evaluator's own namespace).
 * H4 — exact trigger name, never DISABLE TRIGGER ALL.
 * ========================================================================== */

const ADM_IAM_ALERT_HARNESS_LOCK_KEY = 'adm-iam-alert-pgtest-harness-lock';
const OPERATIONAL_ALERT_SIGNALS_TRIGGER = 'trg_operational_alert_signals_immutable';

/** H6 — tables this suite owns/writes, verified to have zero residue after
 * the guarded cleanup commits. operational_alert_signals is checked
 * separately below (scoped to orgGuardProbe, not the ALL_ORGS list). */
const RESIDUE_TABLES: Array<[table: string, column: string]> = [
  ['admin_iam_jobs', 'organization_id'],
  ['admin_iam_job_events', 'organization_id'],
  ['operational_alert_tenant_states', 'organization_id'],
  ['operational_alert_delivery_outbox', 'organization_id'],
];

const SECRET_SHAPE = /(authorization|cookie|password|secret|token|api.?key)/i;

function slugifyHeading(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const prefix = `adm-iam-alert-${randomUUID().slice(0, 8)}`;
const actor = `${prefix}-actor`;
const evaluatorId = `${prefix}-evaluator`;

const orgStale = `${prefix}-org-stale`;
const orgStaleRecovery = `${prefix}-org-stale-recovery`;
const orgReplay = `${prefix}-org-replay`;
const orgFailed = `${prefix}-org-failed`;
const orgFailedRecovery = `${prefix}-org-failed-recovery`;
const orgLeakCheck = `${prefix}-org-leak-check`;
const orgIsoA = `${prefix}-org-iso-a`;
const orgIsoB = `${prefix}-org-iso-b`;
const orgHealthy = `${prefix}-org-healthy`;
const orgGuardProbe = `${prefix}-org-guard-probe`;
const ALL_ORGS = [
  orgStale,
  orgStaleRecovery,
  orgReplay,
  orgFailed,
  orgFailedRecovery,
  orgLeakCheck,
  orgIsoA,
  orgIsoB,
  orgHealthy,
  orgGuardProbe,
];

// Explicit, fixed instants. Nothing in this suite ever sleeps or reads the
// wall clock — every evaluator call is driven by one of these.
const T_DETECT = '2026-08-18T06:00:00.000Z';
const T_PAST_LEASE = '2026-08-18T05:00:00.000Z'; // before T_DETECT
const T_RECOVER = '2026-08-19T06:00:00.000Z'; // after T_DETECT

describe.skipIf(!REAL_PG)('ADM-OPS-ALERT admin IAM queue alert evaluator (real PostgreSQL)', () => {
  let db: Client;
  let guardPool: Pool;
  let lockClient: PoolClient;

  beforeAll(async () => {
    // H2: dedicated Pool + PoolClient, checked out once and retained for the
    // whole suite — this is the client the session-level advisory lock and
    // the pinned transactional cleanup both use.
    guardPool = new Pool({ connectionString: DATABASE_URL });
    lockClient = await guardPool.connect();

    // H1, live half: confirm the gate is REAL — not just env-flag trust —
    // before taking the lock or touching any table.
    await assertDisposableDatabase(lockClient);

    // H2: session-level advisory lock, held for the whole suite so a
    // concurrent run against the same disposable database cannot interleave
    // with this one's writes/cleanup.
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [ADM_IAM_ALERT_HARNESS_LOCK_KEY]);

    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    // Re-confirm on this second connection too — never assume two
    // connections opened from the same DATABASE_URL landed on the same
    // database.
    await assertDisposableDatabase(db);

    // H7 — PREFLIGHT TRIGGER ASSERTION, before any BEGIN or mutation. If the
    // append-only guard on operational_alert_signals is already disabled (or
    // duplicated, or absent) when this suite starts, every append-only
    // assertion this file makes afterwards is worthless — nothing today
    // would notice that until cleanup. Fail loudly here instead, naming the
    // actual count and state.
    const preflightTrigger = await db.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled::text AS tgenabled FROM pg_trigger WHERE tgrelid = 'operational_alert_signals'::regclass AND NOT tgisinternal`
    );
    expect(
      preflightTrigger.rows.length,
      `preflight: expected exactly 1 non-internal trigger on operational_alert_signals before any mutation, found ${preflightTrigger.rows.length} (${
        preflightTrigger.rows.map((row) => row.tgname).join(', ') || '<none>'
      })`
    ).toBe(1);
    expect(
      preflightTrigger.rows[0]?.tgenabled,
      `preflight: trigger ${preflightTrigger.rows[0]?.tgname ?? '<missing>'} on operational_alert_signals must be enabled (tgenabled='O') before any mutation, found tgenabled=${
        preflightTrigger.rows[0]?.tgenabled ?? '<missing>'
      }`
    ).toBe('O');
  });

  afterAll(async () => {
    let lockReleased = false;
    try {
      // H1: re-verified immediately before any destructive statement, not
      // just once at suite start.
      await assertDisposableDatabase(lockClient);

      // H3: pinned transactional cleanup — everything below runs inside one
      // explicit BEGIN...COMMIT on the SAME retained lockClient.
      await lockClient.query('BEGIN');
      try {
        await lockClient.query(`DELETE FROM admin_iam_job_events WHERE organization_id = ANY($1)`, [ALL_ORGS]);
        await lockClient.query(`DELETE FROM admin_iam_jobs WHERE organization_id = ANY($1)`, [ALL_ORGS]);
        await lockClient.query(`DELETE FROM operational_alert_delivery_outbox WHERE organization_id = ANY($1)`, [
          ALL_ORGS,
        ]);
        await lockClient.query(`DELETE FROM operational_alert_tenant_states WHERE organization_id = ANY($1)`, [
          ALL_ORGS,
        ]);

        // H4: exact named trigger, never DISABLE TRIGGER ALL. Test DB only:
        // disable the immutable guard solely to remove this suite's own
        // probe row from the append-only signals table (the guard itself is
        // exercised as still-intact in the last `it` below, before this
        // runs).
        await lockClient.query(
          `ALTER TABLE operational_alert_signals DISABLE TRIGGER ${OPERATIONAL_ALERT_SIGNALS_TRIGGER}`
        );
        await lockClient.query(`DELETE FROM operational_alert_signals WHERE organization_id = $1`, [orgGuardProbe]);
        await lockClient.query(
          `ALTER TABLE operational_alert_signals ENABLE TRIGGER ${OPERATIONAL_ALERT_SIGNALS_TRIGGER}`
        );

        // H4: assert the guard is back INSIDE the transaction, before
        // COMMIT — a failure to restore it throws here, which the catch
        // below turns into a ROLLBACK instead of ever letting a disabled
        // guard reach COMMIT.
        const guardState = await lockClient.query<{ tgenabled: string }>(
          `SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'operational_alert_signals'::regclass AND tgname = $1`,
          [OPERATIONAL_ALERT_SIGNALS_TRIGGER]
        );
        if (guardState.rows[0]?.tgenabled !== 'O') {
          throw new Error(
            `refusing to commit cleanup: ${OPERATIONAL_ALERT_SIGNALS_TRIGGER} did not come back enabled (tgenabled=${
              guardState.rows[0]?.tgenabled ?? '<missing>'
            })`
          );
        }

        // H8 — pre-COMMIT (in-transaction) residue assertion, on the SAME
        // retained lockClient, inside this SAME transaction, after the
        // DELETEs above and before COMMIT. This is an addition alongside
        // H6's postcommit verification below (retained unchanged), not a
        // replacement: this proves the DELETEs actually matched every row
        // this suite wrote; H6 separately proves the COMMIT persisted that.
        // Both are needed and they prove different things. Same
        // RESIDUE_TABLES list plus operational_alert_signals scoped to its
        // probe org.
        for (const [table, column] of RESIDUE_TABLES) {
          const inTxnResidue = await lockClient.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = ANY($1)`,
            [ALL_ORGS]
          );
          expect(Number(inTxnResidue.rows[0].count), `in-transaction (pre-COMMIT) residue in ${table}`).toBe(0);
        }
        const inTxnSignalsResidue = await lockClient.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM operational_alert_signals WHERE organization_id = $1`,
          [orgGuardProbe]
        );
        expect(
          Number(inTxnSignalsResidue.rows[0].count),
          'in-transaction (pre-COMMIT) residue in operational_alert_signals'
        ).toBe(0);

        await lockClient.query('COMMIT');
      } catch (cleanupErr) {
        // H5: explicit ROLLBACK on error. Postgres DDL (the ALTER TABLE
        // DISABLE/ENABLE TRIGGER statements above) is transactional, so this
        // genuinely restores the trigger to its pre-cleanup state too — a
        // mid-cleanup failure cannot leave it disabled.
        await lockClient.query('ROLLBACK').catch(() => undefined);
        throw cleanupErr;
      }

      // H6: postcommit verification — zero residue across every table this
      // suite owns or writes.
      for (const [table, column] of RESIDUE_TABLES) {
        const residue = await lockClient.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = ANY($1)`,
          [ALL_ORGS]
        );
        expect(Number(residue.rows[0].count), `postcommit residue in ${table}`).toBe(0);
      }
      const signalsResidue = await lockClient.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM operational_alert_signals WHERE organization_id = $1`,
        [orgGuardProbe]
      );
      expect(Number(signalsResidue.rows[0].count), 'postcommit residue in operational_alert_signals').toBe(0);

      // H2: explicit release, then H6 proves zero advisory locks remain
      // held by this backend.
      await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [ADM_IAM_ALERT_HARNESS_LOCK_KEY]);
      lockReleased = true;

      const locks = await lockClient.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
      );
      expect(Number(locks.rows[0].count), 'advisory locks held by this backend after release').toBe(0);
    } finally {
      // H5: nested finally — ALWAYS unlock, release, close, no matter what
      // failed above. pg_advisory_unlock on an already-released (or
      // never-acquired) lock returns false, not an error, so this is a safe
      // no-op when the explicit unlock above already ran.
      if (!lockReleased) {
        await lockClient
          .query('SELECT pg_advisory_unlock(hashtext($1))', [ADM_IAM_ALERT_HARNESS_LOCK_KEY])
          .catch(() => undefined);
      }
      lockClient.release();
      await guardPool.end().catch(() => undefined);
      await db.end().catch(() => undefined);
    }
  });

  it('fires ADMIN_IAM_JOB_STALE once a running job outlives its lease, driven by an explicit now', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgStale,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-stale-job`,
      payload: { source: 'scim' },
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgStale, workerId: `${prefix}-worker-stale` });
    expect(claimed?.id).toBe(job.id);

    // The claim query only reclaims rows still 'queued' — a stale 'running'
    // lease will not self-heal (runbook). Backdate directly; never sleep.
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, job.id]);

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgStale, evaluatorId, now: T_DETECT });
    const stale = evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(stale).toBeTruthy();
    expect(stale?.status).toBe('ACTIVE');
    expect(stale?.latestValue).toBeGreaterThanOrEqual(1);
    expect(stale?.threshold).toBe(ADMIN_IAM_ALERT_THRESHOLDS.ADMIN_IAM_JOB_STALE);
  });

  it('is idempotent on replay: same condition, same now, twice — one DETECTED row, version unchanged', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgReplay,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-replay-job`,
      payload: { source: 'scim' },
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgReplay, workerId: `${prefix}-worker-replay` });
    expect(claimed?.id).toBe(job.id);
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, job.id]);

    const first = await evaluateAdminIamQueueAlerts({ organizationId: orgReplay, evaluatorId, now: T_DETECT });
    const second = await evaluateAdminIamQueueAlerts({ organizationId: orgReplay, evaluatorId, now: T_DETECT });

    const firstStale = first.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    const secondStale = second.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(firstStale?.status).toBe('ACTIVE');
    expect(secondStale?.status).toBe('ACTIVE');
    expect(secondStale?.version).toBe(firstStale?.version);

    const detectedCount = await db.query(
      `SELECT COUNT(*)::int AS count FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED'`,
      [orgReplay, 'ADMIN_IAM_JOB_STALE']
    );
    expect(Number(detectedCount.rows[0].count)).toBe(1);
  });

  it('fires ADMIN_IAM_JOB_FAILED once a job exhausts retries into terminal failed, and the runbook link resolves to a real section', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgFailed,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-failed-job`,
      payload: { source: 'scim' },
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgFailed, workerId: `${prefix}-worker-failed` });
    expect(claimed?.id).toBe(job.id);
    const failed = await failAdminIamJob({
      organizationId: orgFailed,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-failed`,
      error: 'directory provider timeout',
    });
    expect(failed.status).toBe('failed');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgFailed, evaluatorId, now: T_DETECT });
    const failedState = evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED');
    expect(failedState?.status).toBe('ACTIVE');
    expect(failedState?.latestValue).toBeGreaterThanOrEqual(1);
    expect(failedState?.threshold).toBe(ADMIN_IAM_ALERT_THRESHOLDS.ADMIN_IAM_JOB_FAILED);

    // Runbook link: machine-checked, not asserted by convention.
    const [docId, anchor] = ADMIN_IAM_ALERT_RUNBOOK_ID.split('#');
    expect(docId).toBeTruthy();
    expect(anchor).toBeTruthy();

    const outboxRow = (
      await db.query(
        `SELECT payload_json FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED' ORDER BY state_version ASC LIMIT 1`,
        [orgFailed, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(outboxRow).toBeTruthy();
    expect(outboxRow.payload_json.runbookId).toBe(ADMIN_IAM_ALERT_RUNBOOK_ID);

    const runbookPath = path.resolve(process.cwd(), 'docs/runbooks', `${docId}.md`);
    const runbookText = fs.readFileSync(runbookPath, 'utf8');
    const headingSlugs = [...runbookText.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => slugifyHeading(heading));
    expect(headingSlugs).toContain(anchor);
  });

  it('never leaks the job payload, last_error, or lease token into the alert payload, and rejects generic secret-shaped keys', async () => {
    const PAYLOAD_MARKER = `PAYLOAD-MARKER-${prefix}`;
    const ERROR_MARKER = `ERROR-MARKER-${prefix}`;
    const job = await enqueueAdminIamJob({
      organizationId: orgLeakCheck,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-leak-job`,
      payload: { note: PAYLOAD_MARKER },
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgLeakCheck, workerId: `${prefix}-worker-leak` });
    expect(claimed?.id).toBe(job.id);
    const leaseTokenUsed = claimed!.leaseToken!;
    const failed = await failAdminIamJob({
      organizationId: orgLeakCheck,
      jobId: job.id,
      leaseToken: leaseTokenUsed,
      workerId: `${prefix}-worker-leak`,
      error: ERROR_MARKER,
    });
    expect(failed.status).toBe('failed');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgLeakCheck, evaluatorId, now: T_DETECT });
    expect(evaluated.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED')?.status).toBe('ACTIVE');

    const outboxRow = (
      await db.query(
        `SELECT payload_json FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 AND transition='DETECTED' ORDER BY state_version ASC LIMIT 1`,
        [orgLeakCheck, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(outboxRow).toBeTruthy();
    const serialized = JSON.stringify(outboxRow.payload_json);
    expect(serialized).not.toContain(PAYLOAD_MARKER);
    expect(serialized).not.toContain(ERROR_MARKER);
    expect(serialized).not.toContain(leaseTokenUsed);
    expect(SECRET_SHAPE.test(serialized)).toBe(false);
  });

  it('recovers ADMIN_IAM_JOB_STALE once the job is completed under its original lease token, transitions DETECTED,RECOVERED', async () => {
    // Self-seeded (org `orgStaleRecovery`, not `orgStale`) rather than
    // reusing the job the ADMIN_IAM_JOB_STALE-firing test created, so this
    // test does not depend on that other test having run first or having
    // passed — no cross-test state, no execution-order coupling.
    const job = await enqueueAdminIamJob({
      organizationId: orgStaleRecovery,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-stale-recovery-job`,
      payload: { source: 'scim' },
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({
      organizationId: orgStaleRecovery,
      workerId: `${prefix}-worker-stale-recovery-claim`,
    });
    expect(claimed?.id).toBe(job.id);
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, job.id]);

    const detected = await evaluateAdminIamQueueAlerts({
      organizationId: orgStaleRecovery,
      evaluatorId,
      now: T_DETECT,
    });
    expect(detected.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE')?.status).toBe('ACTIVE');

    // completeAdminIamJob checks status='running' AND lease_token=?, not
    // lease expiry — completing under the still-known token is a real
    // lifecycle transition (see file header for why re-claim cannot apply).
    const completed = await completeAdminIamJob({
      organizationId: orgStaleRecovery,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-stale-recovery`,
    });
    expect(completed.status).toBe('succeeded');

    const recovered = await evaluateAdminIamQueueAlerts({
      organizationId: orgStaleRecovery,
      evaluatorId,
      now: T_RECOVER,
    });
    const staleState = recovered.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE');
    expect(staleState?.status).toBe('RECOVERED');

    const stateRow = (
      await db.query(
        `SELECT recovered_at FROM operational_alert_tenant_states WHERE organization_id=$1 AND kind=$2`,
        [orgStaleRecovery, 'ADMIN_IAM_JOB_STALE']
      )
    ).rows[0];
    expect(stateRow?.recovered_at).toBeTruthy();

    const transitions = await db.query(
      `SELECT transition FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 ORDER BY state_version ASC`,
      [orgStaleRecovery, 'ADMIN_IAM_JOB_STALE']
    );
    expect(transitions.rows.map((row) => row.transition)).toEqual(['DETECTED', 'RECOVERED']);
  });

  it("recovers ADMIN_IAM_JOB_FAILED after CONTROLLED TEST-ONLY ARCHIVAL of the terminal row (no supported remediation path exists: the runbook forbids a manual succeeded flip, and no service function moves a job out of terminal failed), transitions DETECTED,RECOVERED", async () => {
    // Self-seeded (org `orgFailedRecovery`, not `orgFailed`) rather than
    // reusing the job the ADMIN_IAM_JOB_FAILED-firing test created, so this
    // test does not depend on that other test having run first or having
    // passed — no cross-test state, no execution-order coupling.
    const job = await enqueueAdminIamJob({
      organizationId: orgFailedRecovery,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-failed-recovery-job`,
      payload: { source: 'scim' },
      maxAttempts: 1,
    });
    const claimed = await claimAdminIamJob({
      organizationId: orgFailedRecovery,
      workerId: `${prefix}-worker-failed-recovery-claim`,
    });
    expect(claimed?.id).toBe(job.id);
    const failedJob = await failAdminIamJob({
      organizationId: orgFailedRecovery,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-failed-recovery-claim`,
      error: 'directory provider timeout',
    });
    expect(failedJob.status).toBe('failed');

    const detected = await evaluateAdminIamQueueAlerts({
      organizationId: orgFailedRecovery,
      evaluatorId,
      now: T_DETECT,
    });
    expect(detected.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED')?.status).toBe('ACTIVE');

    // Real remediation per the runbook: a NEW job, a NEW idempotency key,
    // and it succeeds normally.
    const remediation = await enqueueAdminIamJob({
      organizationId: orgFailedRecovery,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-failed-recovery-job-remediation`,
      payload: { source: 'scim', retry: true },
      maxAttempts: 3,
    });
    const remediationClaim = await claimAdminIamJob({
      organizationId: orgFailedRecovery,
      workerId: `${prefix}-worker-failed-recovery-remediation`,
    });
    expect(remediationClaim?.id).toBe(remediation.id);
    const remediationComplete = await completeAdminIamJob({
      organizationId: orgFailedRecovery,
      jobId: remediation.id,
      leaseToken: remediationClaim!.leaseToken!,
      workerId: `${prefix}-worker-failed-recovery-remediation`,
    });
    expect(remediationComplete.status).toBe('succeeded');

    // CONTROLLED TEST-ONLY ARCHIVAL/REMOVAL of the terminal row. This is NOT
    // a remediation path and must not be read as one. No supported
    // remediation path has been proven for taking a job out of terminal
    // 'failed': the runbook forbids ever flipping a job to 'succeeded' by
    // hand, and adminIamOperationsService.ts exposes no function that moves
    // a job out of terminal 'failed' (enqueue/claim/complete/fail all
    // require a prior status other than 'failed'). This direct-SQL DELETE
    // never touches `status`; it exists only so this evaluator's own next
    // query observes the honest, already-remediated-via-a-new-job state
    // instead of being permanently poisoned by a terminal row this service
    // has no supported way to move or clear.
    await db.query(`DELETE FROM admin_iam_job_events WHERE job_id = $1`, [job.id]);
    await db.query(`DELETE FROM admin_iam_jobs WHERE id = $1`, [job.id]);

    const recovered = await evaluateAdminIamQueueAlerts({
      organizationId: orgFailedRecovery,
      evaluatorId,
      now: T_RECOVER,
    });
    const failedState = recovered.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED');
    expect(failedState?.status).toBe('RECOVERED');

    const stateRow = (
      await db.query(
        `SELECT recovered_at FROM operational_alert_tenant_states WHERE organization_id=$1 AND kind=$2`,
        [orgFailedRecovery, 'ADMIN_IAM_JOB_FAILED']
      )
    ).rows[0];
    expect(stateRow?.recovered_at).toBeTruthy();

    const transitions = await db.query(
      `SELECT transition FROM operational_alert_delivery_outbox WHERE organization_id=$1 AND kind=$2 ORDER BY state_version ASC`,
      [orgFailedRecovery, 'ADMIN_IAM_JOB_FAILED']
    );
    expect(transitions.rows.map((row) => row.transition)).toEqual(['DETECTED', 'RECOVERED']);
  });

  it('isolates tenants in both directions: a condition seeded only under orgB never activates orgA, and orgB fires on its own evaluation', async () => {
    const staleJobB = await enqueueAdminIamJob({
      organizationId: orgIsoB,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-iso-b-stale`,
      payload: {},
      maxAttempts: 3,
    });
    const staleClaimB = await claimAdminIamJob({ organizationId: orgIsoB, workerId: `${prefix}-worker-iso-b-stale` });
    expect(staleClaimB?.id).toBe(staleJobB.id);
    await db.query(`UPDATE admin_iam_jobs SET lease_expires_at = $1 WHERE id = $2`, [T_PAST_LEASE, staleJobB.id]);

    const failedJobB = await enqueueAdminIamJob({
      organizationId: orgIsoB,
      actorId: actor,
      jobType: 'role_reconcile',
      idempotencyKey: `${prefix}-iso-b-failed`,
      payload: {},
      maxAttempts: 1,
    });
    const failedClaimB = await claimAdminIamJob({ organizationId: orgIsoB, workerId: `${prefix}-worker-iso-b-failed` });
    expect(failedClaimB?.id).toBe(failedJobB.id);
    await failAdminIamJob({
      organizationId: orgIsoB,
      jobId: failedJobB.id,
      leaseToken: failedClaimB!.leaseToken!,
      workerId: `${prefix}-worker-iso-b-failed`,
      error: 'isolation probe failure',
    });

    // Direction 1: orgA was never touched — must show nothing active.
    const evalA = await evaluateAdminIamQueueAlerts({ organizationId: orgIsoA, evaluatorId, now: T_DETECT });
    expect(evalA.filter((row) => row.status === 'ACTIVE')).toHaveLength(0);
    const activeStatesA = await db.query(
      `SELECT kind FROM operational_alert_tenant_states WHERE organization_id=$1 AND status='ACTIVE'`,
      [orgIsoA]
    );
    expect(activeStatesA.rows).toHaveLength(0);

    // Direction 2: orgB, evaluated on its own, must fire both kinds.
    const evalB = await evaluateAdminIamQueueAlerts({ organizationId: orgIsoB, evaluatorId, now: T_DETECT });
    expect(evalB.find((row) => row.kind === 'ADMIN_IAM_JOB_STALE')?.status).toBe('ACTIVE');
    expect(evalB.find((row) => row.kind === 'ADMIN_IAM_JOB_FAILED')?.status).toBe('ACTIVE');
  });

  it('produces no ACTIVE state for a fully healthy tenant: claimed and completed, nothing stale, nothing failed', async () => {
    const job = await enqueueAdminIamJob({
      organizationId: orgHealthy,
      actorId: actor,
      jobType: 'membership_sync',
      idempotencyKey: `${prefix}-healthy-job`,
      payload: {},
      maxAttempts: 3,
    });
    const claimed = await claimAdminIamJob({ organizationId: orgHealthy, workerId: `${prefix}-worker-healthy` });
    expect(claimed?.id).toBe(job.id);
    const completed = await completeAdminIamJob({
      organizationId: orgHealthy,
      jobId: job.id,
      leaseToken: claimed!.leaseToken!,
      workerId: `${prefix}-worker-healthy`,
    });
    expect(completed.status).toBe('succeeded');

    const evaluated = await evaluateAdminIamQueueAlerts({ organizationId: orgHealthy, evaluatorId, now: T_DETECT });
    expect(evaluated.filter((row) => row.status === 'ACTIVE')).toHaveLength(0);
  });

  it('leaves zero orphaned admin_iam_job_events for this suite, and the append-only guard on operational_alert_signals still rejects a raw UPDATE', async () => {
    const orphans = await db.query(
      `SELECT COUNT(*)::int AS count FROM admin_iam_job_events e LEFT JOIN admin_iam_jobs j ON j.id = e.job_id WHERE e.organization_id = ANY($1) AND j.id IS NULL`,
      [ALL_ORGS]
    );
    expect(Number(orphans.rows[0].count)).toBe(0);

    // This evaluator never touches operational_alert_signals (per the
    // binding contract). Prove the pre-existing append-only guard on that
    // table is still intact — a FOR EACH ROW trigger never fires against
    // zero matched rows, so insert one probe row first.
    await db.query(
      `INSERT INTO operational_alert_signals
         (organization_id, actor_id, correlation_id, source_type, source_id, kind, outcome, observed_value, occurred_at, idempotency_key, input_fingerprint)
       VALUES ($1,$2,$3,$4,$5,'WRITE_FAILURE_RATE','SUCCESS',1,$6,$7,'adm-iam-alert-guard-probe')`,
      [
        orgGuardProbe,
        actor,
        `${prefix}-guard-corr`,
        'adm-iam-alert-guard-probe',
        `${prefix}-guard-source`,
        T_DETECT,
        `${prefix}-guard-idem`,
      ]
    );
    await expect(
      db.query(`UPDATE operational_alert_signals SET observed_value = 2 WHERE organization_id = $1`, [orgGuardProbe])
    ).rejects.toThrow(/OPS_ALERT_APPEND_ONLY/);
  });
});
