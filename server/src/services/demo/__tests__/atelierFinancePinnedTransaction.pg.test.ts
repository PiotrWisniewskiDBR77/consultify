/**
 * FIN-005 — the pinned promotion transaction, proved on a REAL PostgreSQL.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS AND WHY IT CANNOT BE A MOCK
 * ===========================================================================
 * The seed's atomicity argument is a claim about what PostgreSQL does when a
 * transaction is interrupted. An in-memory fake cannot falsify that claim: it
 * shares the code's own assumptions about when a write "lands". The earlier
 * round of this packet learned that the hard way — both test layers modelled
 * only "rejected without applying", so the one dangerous case (applied, then
 * the client never sees the result) was invisible to them.
 *
 * So every fault here is injected in, or against, a live database:
 *   - `plpgsql` triggers that RAISE on a specific promotion write;
 *   - `pg_terminate_backend` fired from a SECOND connection at the pinned
 *     backend, mid-transaction;
 *   - `statement_timeout` on the pinned session;
 *   - a backend killed AFTER all five writes and BEFORE `COMMIT` (the
 *     SIGTERM-equivalent: no clean `ROLLBACK` is ever sent).
 *
 * ===========================================================================
 * WHAT EVERY FAULT MUST PRODUCE
 * ===========================================================================
 *   1. ZERO PARTIAL READY — read straight out of the database: no statement at
 *      `status='confirmed'` / `validation_status='pass'` / `readiness_status='ready'`,
 *      the analysis not `APPROVED`, the pack not `pack_readiness_status='ready'`.
 *   2. BOUNDED TIME — the call returns; the test fails rather than hangs.
 *   3. RECOVERABLE — a subsequent seed run succeeds and leaves the fixture
 *      complete and coherent.
 *
 * ===========================================================================
 * ISOLATION — read this before adding a test
 * ===========================================================================
 * The first version of this file shared ONE organization id across all tests
 * and reset the fixture in `beforeEach`. That was non-deterministic, and the
 * failures looked like adapter bugs while being pure harness interference: a
 * reset racing an in-flight seed produced foreign-key violations on rows that
 * had just been deleted underneath it, and a fault left behind by a timed-out
 * hook fired inside a later test that injects no fault at all.
 *
 * The rules that replaced it, all load-bearing:
 *   - EVERY TEST OWNS AN ORGANIZATION (`orgFor('<key>')`). No test can observe,
 *     reset or delete another test's rows, so nothing a hook does can race a
 *     seed that is still running.
 *   - THE FIXTURE RESET LIVES IN THE TEST BODY, not in a hook, so it is
 *     governed by that test's own timeout and can never overlap its neighbour.
 *   - FAULTS ARE ROW-SCOPED (a set of target ids) and every fault is installed
 *     and removed in a `try/finally`; faults are ALSO cleared in `beforeEach`
 *     and `afterEach`. Because targets are ids and ids are per-organization, a
 *     leaked fault cannot fire in another test even if all of that failed.
 *   - THE FILE IS SEQUENTIAL. `describe.sequential` plus per-org data means
 *     this file MUST NOT be run concurrently against one database.
 *
 * ===========================================================================
 * HOW TO RUN
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_pin \
 *   npx vitest run server/src/services/demo/__tests__/atelierFinancePinnedTransaction.pg.test.ts
 *
 * `NODE_ENV=test` ALONE IS A TRAP: `Database.ts` then hands back an in-memory
 * MOCK and every write becomes a no-op, so the suite would pass while touching
 * nothing. `RUN_DB_TESTS=1` and `MOCK_DB=false` are what force the real driver.
 * Without a reachable database the whole file SKIPS (it must never fail a
 * developer machine that has no local Postgres) — and the skip is loud.
 *
 * Point `DATABASE_URL` at the DRIFTED database instead and the file runs the
 * schema-drift gate rather than the fault matrix.
 *
 * RUN THE `atelierFinance*.pg.test.ts` FILES SEQUENTIALLY
 * (`npx vitest run --retry=0 --fileParallelism=false ...`). They share one
 * database AND install triggers on `financial_statements` for the whole of it;
 * per-organization tenancy isolates the DATA, not the schema objects. Run in
 * parallel they interleave, and the failures look like adapter bugs while being
 * pure harness interference.
 */

import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import logger from '../../../utils/Logger.js';
import {
  identifyNonPostgresSeam,
  type PinnedReader,
  type PinnedReconciliation,
  type PinnedWrite,
  probePinnedTransactionSupport,
  runPinnedPromotionTransaction,
} from '../atelierFinancePromotionTransaction.js';
import {
  type AtelierCanonicalIds,
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

// The schema is already migrated in the target database; re-running `initDb()`
// on every worker is slow and pointless here.
process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability and drift are decided once, before the suites are declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const DRIFTED = REACHABLE ? await isDrifted(CONNECTION_STRING) : false;

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function isDrifted(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_statements'
          AND column_name IN ('readiness_status', 'readiness_score')`
    );
    return Number(result.rows[0]?.present ?? 0) < 2;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 pinned-transaction suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

// ---------------------------------------------------------------------------
// Per-test tenancy
// ---------------------------------------------------------------------------

const ORG_PREFIX = 'fin005-pinned-tx';

/** Every organization this file owns — created once, dropped once. */
const ORG_KEYS = [
  'probe',
  'happy',
  'second-run',
  'fault-before-first',
  'fault-after-stmt-1',
  'fault-after-stmt-2',
  'fault-after-stmt-3',
  'fault-after-analysis',
  'fault-pre-commit',
  'fault-terminate',
  'fault-timeout',
  'fault-sigterm',
  'lock-probe',
  'commit-ack-committed',
  'commit-ack-mixed',
  'commit-ack-unreadable',
  'timeout-scope',
  'idle-budget',
  'drift',
] as const;

type OrgKey = (typeof ORG_KEYS)[number];

const orgFor = (key: OrgKey): string => `${ORG_PREFIX}-${key}`;
const idsFor = (key: OrgKey): AtelierCanonicalIds => getAtelierFinanceCanonicalIds(orgFor(key));

/** Out-of-band pool: assertions, fixture reset and fault control. Never the seed's. */
let control: Pool;

const suite = REACHABLE && !DRIFTED ? describe.sequential : describe.skip;
const driftSuite = REACHABLE && DRIFTED ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// The fault matrix
// ---------------------------------------------------------------------------

suite('FIN-005 — pinned promotion transaction against a real PostgreSQL', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    await createOrganizations(control);
    await installFaultTriggers(control);
    await clearAllFaults(control);
  }, 120_000);

  afterAll(async () => {
    if (!control) return;
    await clearAllFaults(control).catch(() => undefined);
    await removeFaultTriggers(control).catch(() => undefined);
    await dropOrganizations(control).catch(() => undefined);
    await control.end().catch(() => undefined);
    // Close the pool the seed opened, otherwise vitest hangs on open handles.
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  // Belt and braces. Faults are already row-scoped per organization AND removed
  // in a `finally`; these two hooks mean even a test killed by its own timeout
  // cannot leave one armed.
  beforeEach(async () => {
    await clearAllFaults(control);
  }, 60_000);

  afterEach(async () => {
    await clearAllFaults(control);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Baseline — the pinned path is the one actually taken here.
  // -------------------------------------------------------------------------

  it('uses the PINNED path (not the compensating fallback) on a real connection', async () => {
    const probe = await probePinnedTransactionSupport();
    expect(probe.supported, `probe said: ${probe.reason}`).toBe(true);
    expect(probe.database).toBeTruthy();
  }, 60_000);

  it('does NOT recognise a non-PostgreSQL seam here — so the fallback is unreachable (FIN-005 P1-1)', async () => {
    // NODE_ENV is 'test' in this very process. If that were evidence of a mock
    // the seam would be "recognised" and the non-atomic path would open on a
    // REAL database. It is not evidence, and this is where that is proved.
    expect(process.env.NODE_ENV).toBe('test');
    const seam = await identifyNonPostgresSeam();
    expect(seam.recognised, `seam said: ${seam.signal}`).toBe(false);
    expect(seam.signal).toMatch(/DbPromise get\/all\/run are real functions/);
  }, 60_000);

  it('promotes all five rows and commits them ON THE PINNED PATH', async () => {
    const ids = idsFor('happy');
    await resetFixture(ids);

    // TEETH. Without this the whole suite would still pass if the seed
    // silently fell back to verify-then-promote — the compensating rollback
    // also leaves "zero partial READY" behind. The log line is the only place
    // the two paths are distinguishable from the outside.
    const info = vi.spyOn(logger, 'info');
    const warn = vi.spyOn(logger, 'warn');
    try {
      const result = await seed('happy');
      expect(result.status, result.reason ?? '').toBe('complete');
      await expectFixtureFullyReady(ids);

      expect(
        info.mock.calls
          .map((call) => String(call[0]))
          .some((line) => line.includes('COMPLETE via the PINNED transaction path'))
      ).toBe(true);
      expect(
        warn.mock.calls
          .map((call) => String(call[0]))
          .some((line) => line.includes('WITHOUT a pinned transaction')),
        'the seed must NOT have used the compensating fallback here'
      ).toBe(false);
    } finally {
      info.mockRestore();
      warn.mockRestore();
    }
  }, 120_000);

  it('is byte-identical on a second run: zero rows touched, zero timestamps moved', async () => {
    const ids = idsFor('second-run');
    await resetFixture(ids);

    const first = await seed('second-run');
    expect(first.status, first.reason ?? '').toBe('complete');
    const before = await fixtureSnapshot(ids);

    const second = await seed('second-run');
    expect(second.status, second.reason ?? '').toBe('complete');
    const after = await fixtureSnapshot(ids);

    expect(after).toEqual(before);
    await expectFixtureFullyReady(ids);
  }, 120_000);

  // -------------------------------------------------------------------------
  // Faults injected IN THE DATABASE, through the real seed.
  //
  // The trigger fires only on a PROMOTION write (the row being moved to
  // ready/APPROVED), so phase 0's heal, phase 1's upserts and the compensating
  // demotions are untouched — the fault lands exactly where the name says.
  // -------------------------------------------------------------------------

  const triggerFaults: Array<{
    name: string;
    key: OrgKey;
    target: (ids: AtelierCanonicalIds) => string;
  }> = [
    {
      name: 'before the first UPDATE',
      key: 'fault-before-first',
      target: (ids) => ids.statementIds[0],
    },
    {
      name: 'after statement promotion 1',
      key: 'fault-after-stmt-1',
      target: (ids) => ids.statementIds[1],
    },
    {
      name: 'after statement promotion 2',
      key: 'fault-after-stmt-2',
      target: (ids) => ids.statementIds[2],
    },
    {
      name: 'after statement promotion 3',
      key: 'fault-after-stmt-3',
      target: (ids) => ids.analysisId,
    },
    {
      name: 'after the analysis promotion',
      key: 'fault-after-analysis',
      target: (ids) => ids.packId,
    },
  ];

  for (const fault of triggerFaults) {
    it(`leaves ZERO partial READY when the promotion fails ${fault.name}`, async () => {
      const ids = idsFor(fault.key);
      await resetFixture(ids);

      let result: Awaited<ReturnType<typeof seed>>;
      const startedAt = Date.now();
      try {
        await armFault(control, fault.target(ids));
        result = await seed(fault.key);
      } finally {
        await disarmFault(control, fault.target(ids));
      }
      const elapsed = Date.now() - startedAt;

      expect(result.status).toBe('incomplete');
      // TEETH: this exact prefix is produced ONLY by the pinned path, so a
      // silent fall back to verify-then-promote reddens the test.
      expect(result.reason).toMatch(/^pinned promotion transaction rolled back: /);
      expect(result.reason).toMatch(/FIN005_INJECTED_FAULT/);
      expect(result.statementIds).toEqual([]);
      expect(elapsed, 'the faulted call must return in bounded time').toBeLessThan(60_000);

      await expectNoPartialReady(ids);

      // The rollback is Postgres's, but the seed still verifies it rather
      // than asserting it.
      expect(result.promotion?.rowsStillClaimingReady ?? []).toEqual([]);

      // ...and the fixture recovers on the next run.
      const recovery = await seed(fault.key);
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady(ids);
    }, 180_000);
  }

  // -------------------------------------------------------------------------
  // Faults that need control INSIDE the transaction. Driven through the
  // adapter's own public callbacks — `plan` runs mid-transaction before any
  // write, `verify` runs after all five writes and before COMMIT — so no test
  // hook has to be added to production code.
  // -------------------------------------------------------------------------

  it('leaves ZERO partial READY when the pre-COMMIT read-back refuses (after the pack promotion)', async () => {
    const ids = await seedThenDemote('fault-pre-commit');

    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async () => ({ ok: true, writes: promotionWrites(ids) }),
      verify: async () => ({ ok: false, reason: 'injected pre-COMMIT refusal' }),
      reconcile: reconcileFor(ids),
    });

    expect(outcome.mode).toBe('pinned');
    expect(outcome).toMatchObject({ status: 'rolled-back' });
    if (outcome.mode === 'pinned' && outcome.status === 'rolled-back') {
      expect(outcome.applied).toHaveLength(5); // all five DID execute…
      expect(outcome.reason).toMatch(/injected pre-COMMIT refusal/);
    }
    await expectNoPartialReady(ids); // …and none of them survived.

    const recovery = await seed('fault-pre-commit');
    expect(recovery.status, recovery.reason ?? '').toBe('complete');
    await expectFixtureFullyReady(ids);
  }, 180_000);

  it('leaves ZERO partial READY when the pinned backend is TERMINATED mid-transaction (before the writes)', async () => {
    const ids = await seedThenDemote('fault-terminate');

    const startedAt = Date.now();
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        await terminateBackend(await backendPid(read));
        // The next statement on a terminated backend fails; that is the fault.
        await read('SELECT 1');
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async () => ({ ok: true }),
      reconcile: reconcileFor(ids),
    });
    const elapsed = Date.now() - startedAt;

    expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
    expect(elapsed, 'a terminated backend must not hang the call').toBeLessThan(60_000);
    await expectNoPartialReady(ids);

    const recovery = await seed('fault-terminate');
    expect(recovery.status, recovery.reason ?? '').toBe('complete');
    await expectFixtureFullyReady(ids);
  }, 180_000);

  it('leaves ZERO partial READY on a statement TIMEOUT mid-transaction', async () => {
    const ids = await seedThenDemote('fault-timeout');

    const startedAt = Date.now();
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        await read(`SET LOCAL statement_timeout = 250`);
        await read(`SELECT pg_sleep(5)`); // exceeds the timeout -> 57014
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async () => ({ ok: true }),
      reconcile: reconcileFor(ids),
      statementTimeoutMs: 5_000,
    });
    const elapsed = Date.now() - startedAt;

    expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
    if (outcome.mode === 'pinned' && outcome.status === 'rolled-back') {
      expect(outcome.reason).toMatch(/statement timeout|canceling statement/i);
      expect(outcome.applied).toEqual([]);
    }
    expect(elapsed, 'the timeout must bound the call').toBeLessThan(60_000);
    await expectNoPartialReady(ids);

    const recovery = await seed('fault-timeout');
    expect(recovery.status, recovery.reason ?? '').toBe('complete');
    await expectFixtureFullyReady(ids);
  }, 180_000);

  it('leaves ZERO partial READY on a SIGTERM-equivalent: backend killed after all five writes, before COMMIT', async () => {
    const ids = await seedThenDemote('fault-sigterm');

    let appliedInsideTx = 0;
    const startedAt = Date.now();
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async () => ({ ok: true, writes: promotionWrites(ids) }),
      verify: async (read) => {
        // All five promotion UPDATEs have executed and are visible INSIDE the
        // transaction at this point — prove it, then kill the backend without
        // any chance of a clean ROLLBACK.
        const rows = await read(
          `SELECT count(*)::int AS ready FROM financial_statements
              WHERE id = ANY($1::text[]) AND readiness_status = 'ready'`,
          [ids.statementIds]
        );
        appliedInsideTx = Number(rows[0]?.ready ?? 0);
        await terminateBackend(await backendPid(read));
        return { ok: true }; // the COMMIT that follows can never succeed
      },
      reconcile: reconcileFor(ids),
    });
    const elapsed = Date.now() - startedAt;

    expect(appliedInsideTx, 'the writes really were applied inside the transaction').toBe(3);
    expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
    expect(elapsed, 'a killed backend must not hang the call').toBeLessThan(60_000);

    // FIN-005 P1-3: "rolled back" here is not a guess. The COMMIT threw, so
    // the adapter opened a FRESH connection, read the five records and only
    // then said so.
    if (outcome.mode === 'pinned' && outcome.status === 'rolled-back') {
      expect(outcome.rollbackIssued, 'no ROLLBACK could be sent on a dead socket').toBe(false);
      expect(outcome.reconciliation?.verdict).toBe('not-committed');
      expect(outcome.reason).toMatch(/reconciliation proved it did NOT/);
    }

    // The whole point: uncommitted work dies with the connection.
    await expectNoPartialReady(ids);

    const recovery = await seed('fault-sigterm');
    expect(recovery.status, recovery.reason ?? '').toBe('complete');
    await expectFixtureFullyReady(ids);
  }, 180_000);

  // -------------------------------------------------------------------------
  // The locks are real, not decorative.
  // -------------------------------------------------------------------------

  it('holds a FOR UPDATE lock on the canonical rows for the life of the transaction', async () => {
    const ids = await seedThenDemote('lock-probe');

    let blockedWhileHeld: boolean | null = null;
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async () => {
        blockedWhileHeld = await competingUpdateBlocks(ids.packId);
        return { ok: false, reason: 'lock probe only' };
      },
      verify: async () => ({ ok: true }),
      reconcile: reconcileFor(ids),
    });

    expect(blockedWhileHeld, 'a competing writer must block on the locked pack row').toBe(true);
    expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
    await expectNoPartialReady(ids);
  }, 180_000);

  // -------------------------------------------------------------------------
  // A LOST COMMIT ACK — FIN-005 P1-3.
  //
  // Staged for real: `verify` issues the COMMIT itself and then has the backend
  // terminated from a second connection. The data IS committed; the adapter's
  // own `COMMIT` then fails on a dead socket, so the answer is genuinely lost.
  // Nothing about that is simulated — it is the exact in-doubt case.
  // -------------------------------------------------------------------------

  it('a lost COMMIT ACK over a transaction that DID commit is reported COMMITTED, on evidence', async () => {
    const ids = await seedThenDemote('commit-ack-committed');

    let pinnedPid = 0;
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        pinnedPid = await backendPid(read);
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async (read) => {
        await read('COMMIT'); // the transaction really lands…
        await terminateBackend(pinnedPid); // …and the answer never gets home
        return { ok: true };
      },
      reconcile: reconcileFor(ids),
    });

    expect(outcome).toMatchObject({
      mode: 'pinned',
      status: 'committed',
      commitAck: 'lost-then-confirmed',
    });
    if (outcome.mode === 'pinned' && outcome.status === 'committed') {
      expect(outcome.reconciliation?.verdict).toBe('committed');
    }
    // The evidence has to match the database, not just the verdict.
    await expectFixtureFullyReady(ids);
  }, 180_000);

  it('a lost COMMIT ACK over a MIXED result is INDETERMINATE / NEEDS_OPERATOR — never rolled back, never complete', async () => {
    const ids = await seedThenDemote('commit-ack-mixed');

    let pinnedPid = 0;
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        pinnedPid = await backendPid(read);
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async (read) => {
        // Commit a deliberately incoherent result: four records promoted, one
        // left behind. Exactly the state nobody may classify.
        await read(
          `UPDATE financial_statements
                SET status = 'imported', validation_status = 'pending', readiness_status = 'pending'
              WHERE id = $1`,
          [ids.statementIds[0]]
        );
        await read('COMMIT');
        await terminateBackend(pinnedPid);
        return { ok: true };
      },
      reconcile: reconcileFor(ids),
    });

    expect(outcome).toMatchObject({
      mode: 'pinned',
      status: 'commit-indeterminate',
      operatorAction: 'NEEDS_OPERATOR',
    });
    if (outcome.mode === 'pinned' && outcome.status === 'commit-indeterminate') {
      expect(outcome.reconciliation.verdict).toBe('indeterminate');
      expect(outcome.reconciliation.detail).toMatch(/MIXED: 4\/5/);
    }

    // The next run heals the residue rather than inheriting it.
    const recovery = await seed('commit-ack-mixed');
    expect(recovery.status, recovery.reason ?? '').toBe('complete');
    await expectFixtureFullyReady(ids);
  }, 180_000);

  it('a lost COMMIT ACK whose reconciliation READ fails is INDETERMINATE, not rolled back', async () => {
    const ids = await seedThenDemote('commit-ack-unreadable');

    let pinnedPid = 0;
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        pinnedPid = await backendPid(read);
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async (read) => {
        await read('COMMIT');
        await terminateBackend(pinnedPid);
        return { ok: true };
      },
      reconcile: async () => {
        throw new Error('injected reconciliation read failure');
      },
    });

    expect(outcome).toMatchObject({
      mode: 'pinned',
      status: 'commit-indeterminate',
      operatorAction: 'NEEDS_OPERATOR',
    });
    if (outcome.mode === 'pinned' && outcome.status === 'commit-indeterminate') {
      expect(outcome.reconciliation.detail).toMatch(
        /the reconciliation read itself failed: injected reconciliation read failure/
      );
    }
    // The commit really did land; the adapter simply refused to claim it.
    await expectFixtureFullyReady(ids);
  }, 180_000);

  // -------------------------------------------------------------------------
  // SESSION STATE MUST NOT ESCAPE ONTO A POOLED CONNECTION.
  //
  // The reconciliation used to run `SET statement_timeout = …` — no LOCAL — on
  // a freshly checked-out client and then release it HEALTHY. `pg` does not
  // reset session state on release, so that value rode the connection into
  // whatever the application did next. It now runs inside its own
  // `BEGIN READ ONLY` with `SET LOCAL`, which dies with the transaction.
  // -------------------------------------------------------------------------

  it('the reconciliation bounds itself with SET LOCAL inside a READ ONLY transaction, and leaks nothing to the pool', async () => {
    const ids = await seedThenDemote('timeout-scope');

    const { getPoolClientForPinnedTransaction } =
      await import('../../../database/PostgresDatabase.js');

    // What a clean pooled connection looks like, measured rather than assumed.
    const baselineClient = await getPoolClientForPinnedTransaction();
    const baseline = String(
      (await baselineClient.query('SHOW statement_timeout')).rows[0].statement_timeout
    );
    baselineClient.release();

    const DISTINCTIVE_MS = 7_777;
    let insideReadOnly = '';
    let insideTimeout = '';
    let reconcilePid = 0;

    let pinnedPid = 0;
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        pinnedPid = await backendPid(read);
        return { ok: true, writes: promotionWrites(ids) };
      },
      verify: async (read) => {
        await read('COMMIT');
        await terminateBackend(pinnedPid);
        return { ok: true };
      },
      reconcile: async (read) => {
        insideReadOnly = String(
          (await read('SHOW transaction_read_only'))[0].transaction_read_only
        );
        insideTimeout = String((await read('SHOW statement_timeout'))[0].statement_timeout);
        reconcilePid = await backendPid(read);
        return { verdict: 'committed', detail: 'scope probe' };
      },
      statementTimeoutMs: DISTINCTIVE_MS,
    });

    expect(outcome).toMatchObject({ mode: 'pinned', status: 'committed' });
    // The bound really was applied, and it was applied inside a READ ONLY
    // transaction — which is what makes `SET LOCAL` the correct form.
    expect(insideReadOnly, 'the reconciliation must run READ ONLY').toBe('on');
    expect(insideTimeout).toBe(`${DISTINCTIVE_MS}ms`);

    // Now take connections back out of the pool and prove none of them
    // inherited it. `pg` hands back the most recently released client first,
    // so the very first checkout is normally the one the reconciliation used;
    // the loop covers the pool regardless of which one that is.
    const seen: string[] = [];
    const held: Array<{ release: () => void }> = [];
    let sawReconcileBackend = false;
    try {
      for (let i = 0; i < 5; i++) {
        const client = await getPoolClientForPinnedTransaction();
        held.push(client);
        const pid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
        if (pid === reconcilePid) sawReconcileBackend = true;
        seen.push(String((await client.query('SHOW statement_timeout')).rows[0].statement_timeout));
      }
    } finally {
      for (const client of held) client.release();
    }

    expect(
      sawReconcileBackend,
      'the reconciliation backend must be back in the pool to be checked'
    ).toBe(true);
    expect(
      seen.every((value) => value === baseline),
      `a pooled connection inherited the reconciliation's statement_timeout: ${JSON.stringify(seen)} (baseline ${baseline})`
    ).toBe(true);
  }, 180_000);

  it('idle_in_transaction_session_timeout gets its OWN budget, not a share of statement_timeout', async () => {
    const ids = await seedThenDemote('idle-budget');

    let statementTimeout = '';
    let idleTimeout = '';
    const outcome = await runPinnedPromotionTransaction({
      lock: lockRequest(ids),
      plan: async (read) => {
        statementTimeout = String((await read('SHOW statement_timeout'))[0].statement_timeout);
        idleTimeout = String(
          (await read('SHOW idle_in_transaction_session_timeout'))[0]
            .idle_in_transaction_session_timeout
        );
        return { ok: false, reason: 'timeout budget probe only' };
      },
      verify: async () => ({ ok: true }),
      reconcile: reconcileFor(ids),
      statementTimeoutMs: 3_000,
      idleInTransactionTimeoutMs: 41_000,
    });

    expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
    expect(statementTimeout).toBe('3s');
    // The defect this replaces: both were set from `statementTimeoutMs`, so a
    // JS pause between two queries killed the backend on the per-query budget
    // and a slow-but-legitimate run became a spurious `incomplete`.
    expect(idleTimeout).toBe('41s');
    expect(idleTimeout).not.toBe(statementTimeout);
  }, 180_000);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function seed(key: OrgKey) {
    return upsertAtelierFinanceGoldenFlow({ organizationId: orgFor(key), createdBy: null });
  }

  /**
   * Wipe this organization's fixture. Deliberately called from the TEST BODY,
   * never from a hook: a reset that runs on a hook's clock can overlap the
   * neighbouring test's seed and delete rows out from under it (observed as
   * foreign-key violations before the per-test tenancy above).
   */
  async function resetFixture(ids: AtelierCanonicalIds): Promise<void> {
    await deleteFixture(control, ids);
  }

  /** A complete fixture, then demoted, so the promotion can be re-driven by hand. */
  async function seedThenDemote(key: OrgKey): Promise<AtelierCanonicalIds> {
    const ids = idsFor(key);
    await resetFixture(ids);
    const result = await seed(key);
    expect(result.status, result.reason ?? '').toBe('complete');
    await demoteFixture(control, ids);
    await expectNoPartialReady(ids);
    return ids;
  }

  /**
   * The post-COMMIT reconciliation the adapter runs on a FRESH connection when
   * a COMMIT answer is lost (FIN-005 P1-3). Same three-way classification the
   * seed uses: all five READY = it committed, all five pre-state = it did not,
   * anything else = INDETERMINATE.
   */
  function reconcileFor(ids: AtelierCanonicalIds) {
    return async (read: PinnedReader): Promise<PinnedReconciliation> => {
      const rows = await read(
        `SELECT id, 'statement' AS kind,
                (status = 'confirmed' OR validation_status = 'pass' OR readiness_status = 'ready') AS ready
           FROM financial_statements WHERE id = ANY($1::text[])
          UNION ALL
         SELECT id, 'analysis', (status = 'APPROVED') FROM financial_analyses WHERE id = $2
          UNION ALL
         SELECT id, 'pack', (pack_status = 'confirmed' OR pack_readiness_status = 'ready')
           FROM financial_statement_packs WHERE id = $3`,
        [ids.statementIds, ids.analysisId, ids.packId]
      );
      const expected = ids.statementIds.length + 2;
      if (rows.length !== expected) {
        return { verdict: 'indeterminate', detail: `read ${rows.length}/${expected} records back` };
      }
      const ready = rows.filter((row) => row.ready === true).map((row) => String(row.id));
      if (ready.length === expected) {
        return { verdict: 'committed', detail: `all ${expected} records read back READY` };
      }
      if (ready.length === 0) {
        return { verdict: 'not-committed', detail: `all ${expected} records read back pre-state` };
      }
      return {
        verdict: 'indeterminate',
        detail: `MIXED: ${ready.length}/${expected} claim READY (${ready.join(', ')})`,
      };
    };
  }

  function lockRequest(ids: AtelierCanonicalIds) {
    return [
      { table: 'financial_statement_packs', ids: [ids.packId] },
      { table: 'financial_statements', ids: ids.statementIds },
      { table: 'financial_analyses', ids: [ids.analysisId] },
    ];
  }

  /** The same five promotions the seed issues, expressed as plain SQL. */
  function promotionWrites(ids: AtelierCanonicalIds): PinnedWrite[] {
    return [
      ...ids.statementIds.map((id) => ({
        label: id,
        sql: `UPDATE financial_statements
                 SET status = 'confirmed', validation_status = 'pass',
                     readiness_status = 'ready', readiness_score = 100
               WHERE id = $1`,
        params: [id],
      })),
      {
        label: ids.analysisId,
        sql: `UPDATE financial_analyses SET status = 'APPROVED' WHERE id = $1`,
        params: [ids.analysisId],
      },
      {
        label: ids.packId,
        sql: `UPDATE financial_statement_packs
                 SET pack_status = 'confirmed', pack_readiness_status = 'ready',
                     pack_readiness_score = 100
               WHERE id = $1`,
        params: [ids.packId],
      },
    ];
  }

  async function backendPid(
    read: (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>
  ): Promise<number> {
    const rows = await read('SELECT pg_backend_pid() AS pid');
    const pid = Number(rows[0]?.pid ?? 0);
    expect(pid, 'could not read the pinned backend pid').toBeGreaterThan(0);
    return pid;
  }

  /** Kill a backend from a DIFFERENT connection — the real-world failure. */
  async function terminateBackend(pid: number): Promise<void> {
    await control.query('SELECT pg_terminate_backend($1)', [pid]);
  }

  /**
   * Does an UPDATE of the pack row from another connection block? Measured with
   * a short `lock_timeout`: a timeout means "blocked" (the lock is held), a
   * successful update means the lock was not there.
   */
  async function competingUpdateBlocks(packId: string): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
      client = await control.connect();
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = 750`);
      await client.query(
        `UPDATE financial_statement_packs SET pack_quality_summary = 'competing writer' WHERE id = $1`,
        [packId]
      );
      await client.query('ROLLBACK');
      return false;
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => undefined);
      return /lock timeout|canceling statement due to lock timeout/i.test((error as Error).message);
    } finally {
      client?.release();
    }
  }

  /**
   * Everything a second run could disturb, including `updated_at` — the column
   * the FIN-005 no-op guard exists to protect.
   */
  async function fixtureSnapshot(ids: AtelierCanonicalIds): Promise<unknown> {
    const [packs, statements, values, analyses] = await Promise.all([
      control.query(`SELECT * FROM financial_statement_packs WHERE id = $1`, [ids.packId]),
      control.query(`SELECT * FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`, [
        ids.statementIds,
      ]),
      control.query(
        `SELECT * FROM financial_statement_values WHERE statement_id = ANY($1::text[]) ORDER BY id`,
        [ids.statementIds]
      ),
      control.query(`SELECT * FROM financial_analyses WHERE id = $1`, [ids.analysisId]),
    ]);
    return JSON.parse(
      JSON.stringify({
        packs: packs.rows,
        statements: statements.rows,
        values: values.rows,
        analyses: analyses.rows,
      })
    );
  }

  async function expectNoPartialReady(ids: AtelierCanonicalIds): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).not.toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).not.toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).not.toBe('ready');
    }

    const analysis = await control.query(`SELECT status FROM financial_analyses WHERE id = $1`, [
      ids.analysisId,
    ]);
    for (const row of analysis.rows) expect(row.status).not.toBe('APPROVED');

    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    for (const row of pack.rows) {
      expect(row.pack_status).not.toBe('confirmed');
      expect(row.pack_readiness_status).not.toBe('ready');
    }
  }

  async function expectFixtureFullyReady(ids: AtelierCanonicalIds): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids.statementIds]
    );
    expect(statements.rows).toHaveLength(ids.statementIds.length);
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).toBe('ready');
    }

    const analysis = await control.query(
      `SELECT status, source_statement_pack_id FROM financial_analyses WHERE id = $1`,
      [ids.analysisId]
    );
    expect(analysis.rows).toHaveLength(1);
    expect(analysis.rows[0].status).toBe('APPROVED');
    expect(analysis.rows[0].source_statement_pack_id).toBe(ids.packId);

    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status, currency FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    expect(pack.rows).toHaveLength(1);
    expect(pack.rows[0].pack_status).toBe('confirmed');
    expect(pack.rows[0].pack_readiness_status).toBe('ready');

    // Coherence: every canonical value is present and mapped, one currency.
    const values = await control.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE canonical_line_id IS NULL)::int AS unmapped
         FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    expect(values.rows[0].total).toBe(ids.statementValueIds.length);
    expect(values.rows[0].unmapped).toBe(0);

    const currencies = await control.query(
      `SELECT DISTINCT currency FROM financial_statements WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    expect(currencies.rows.map((row) => row.currency)).toEqual([pack.rows[0].currency]);
  }
});

// ---------------------------------------------------------------------------
// The schema-drift gate, on its own database
// ---------------------------------------------------------------------------

driftSuite('FIN-005 — schema drift gate on a real, drifted PostgreSQL', () => {
  let driftPool: Pool;
  const ids = idsFor('drift');

  beforeAll(async () => {
    driftPool = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
    await createOrganizations(driftPool);
  }, 120_000);

  afterAll(async () => {
    if (!driftPool) return;
    await deleteFixture(driftPool, ids).catch(() => undefined);
    await dropOrganizations(driftPool).catch(() => undefined);
    await driftPool.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  it('refuses the fixture and produces ZERO false READY', async () => {
    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: orgFor('drift') });

    expect(result.status).toBe('incomplete');
    expect(result.missing ?? []).toContain('financial_statements.readiness_status');
    expect(result.statementIds).toEqual([]);

    // Nothing was promoted — and, on this schema, nothing could even be written.
    const packs = await driftPool.query(
      `SELECT pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [ids.packId]
    );
    for (const row of packs.rows) expect(row.pack_readiness_status).not.toBe('ready');

    const analyses = await driftPool.query(`SELECT status FROM financial_analyses WHERE id = $1`, [
      ids.analysisId,
    ]);
    for (const row of analyses.rows) expect(row.status).not.toBe('APPROVED');

    const statements = await driftPool.query(
      `SELECT status, validation_status FROM financial_statements WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    for (const row of statements.rows) {
      expect(row.status).not.toBe('confirmed');
      expect(row.validation_status).not.toBe('pass');
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// Fixture and fault plumbing (module scope so the hooks can reach it)
// ---------------------------------------------------------------------------

async function createOrganizations(pool: Pool): Promise<void> {
  for (const key of ORG_KEYS) {
    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgFor(key), `FIN-005 pinned transaction fixture (${key})`]
    );
  }
}

async function dropOrganizations(pool: Pool): Promise<void> {
  for (const key of ORG_KEYS) {
    await deleteFixture(pool, idsFor(key)).catch(() => undefined);
    await pool
      .query(`DELETE FROM organizations WHERE id = $1`, [orgFor(key)])
      .catch(() => undefined);
  }
}

async function deleteFixture(pool: Pool, ids: AtelierCanonicalIds): Promise<void> {
  await pool.query(`DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`, [
    ids.statementIds,
  ]);
  await pool.query(`DELETE FROM financial_analyses WHERE id = $1`, [ids.analysisId]);
  await pool.query(`DELETE FROM financial_statements WHERE id = ANY($1::text[])`, [
    ids.statementIds,
  ]);
  await pool.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [ids.packId]);
}

/** Put a complete fixture back into its phase-1 (not-ready) state. */
async function demoteFixture(pool: Pool, ids: AtelierCanonicalIds): Promise<void> {
  await pool.query(
    `UPDATE financial_statements
        SET status = 'imported', validation_status = 'pending',
            readiness_status = 'pending', readiness_score = 0
      WHERE id = ANY($1::text[])`,
    [ids.statementIds]
  );
  await pool.query(`UPDATE financial_analyses SET status = 'DRAFT' WHERE id = $1`, [
    ids.analysisId,
  ]);
  await pool.query(
    `UPDATE financial_statement_packs
        SET pack_status = 'draft', pack_readiness_status = 'pending', pack_readiness_score = 0
      WHERE id = $1`,
    [ids.packId]
  );
}

const FAULT_TABLE = 'fin005_pinned_fault_control';

/**
 * One BEFORE UPDATE trigger per table, raising on the promotion of any row
 * whose id is currently ARMED in `fin005_pinned_fault_control`.
 *
 * A SET OF ARMED IDS, not a single slot: with one shared slot, arming a fault
 * is a global mutation and a test that fails to disarm poisons its neighbours.
 * Ids are per-organization, so an armed id can only ever affect the test that
 * owns it.
 *
 * The trigger fires ONLY when the incoming row is being moved into a
 * READY-flavoured state, so phase 0's heal, phase 1's upserts and the
 * compensating demotions pass through untouched.
 *
 * ONE FUNCTION PER TABLE, not a shared one branching on `TG_TABLE_NAME`: a
 * plpgsql boolean expression is evaluated as a whole, so
 * `TG_TABLE_NAME = 'financial_statements' AND NEW.readiness_status = 'ready'`
 * still resolves `NEW.readiness_status` when the trigger fires on
 * `financial_analyses` and dies with `record "new" has no field …`. That
 * masqueraded as an injected fault in the first run of this suite.
 */
const FAULT_TRIGGERS: Array<{ table: string; predicate: string; label: string }> = [
  {
    table: 'financial_statements',
    predicate: `NEW.readiness_status = 'ready'`,
    label: 'statement',
  },
  { table: 'financial_analyses', predicate: `NEW.status = 'APPROVED'`, label: 'analysis' },
  {
    table: 'financial_statement_packs',
    predicate: `NEW.pack_readiness_status = 'ready'`,
    label: 'pack',
  },
];

const faultFunctionName = (table: string): string => `fin005_pinned_fault_${table}`;

async function installFaultTriggers(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS ${FAULT_TABLE} (target_id text PRIMARY KEY)`);
  // Migrate away from the earlier single-slot shape if it is still around.
  const shape = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [FAULT_TABLE]
  );
  if (shape.rows.some((row) => String(row.column_name) === 'id')) {
    await pool.query(`DROP TABLE IF EXISTS ${FAULT_TABLE}`);
    await pool.query(`CREATE TABLE ${FAULT_TABLE} (target_id text PRIMARY KEY)`);
  }

  for (const trigger of FAULT_TRIGGERS) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION ${faultFunctionName(trigger.table)}() RETURNS trigger AS $fn$
      BEGIN
        IF ${trigger.predicate}
           AND EXISTS (SELECT 1 FROM ${FAULT_TABLE} WHERE target_id = NEW.id) THEN
          RAISE EXCEPTION 'FIN005_INJECTED_FAULT ${trigger.label} %', NEW.id;
        END IF;
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;
    `);
    await pool.query(`DROP TRIGGER IF EXISTS fin005_pinned_fault_trg ON ${trigger.table}`);
    await pool.query(
      `CREATE TRIGGER fin005_pinned_fault_trg BEFORE UPDATE ON ${trigger.table}
         FOR EACH ROW EXECUTE FUNCTION ${faultFunctionName(trigger.table)}()`
    );
  }
}

async function removeFaultTriggers(pool: Pool): Promise<void> {
  for (const trigger of FAULT_TRIGGERS) {
    await pool.query(`DROP TRIGGER IF EXISTS fin005_pinned_fault_trg ON ${trigger.table}`);
    await pool.query(`DROP FUNCTION IF EXISTS ${faultFunctionName(trigger.table)}()`);
  }
  await pool.query(`DROP TABLE IF EXISTS ${FAULT_TABLE}`);
}

async function armFault(pool: Pool, targetId: string): Promise<void> {
  await pool.query(
    `INSERT INTO ${FAULT_TABLE} (target_id) VALUES ($1) ON CONFLICT (target_id) DO NOTHING`,
    [targetId]
  );
}

async function disarmFault(pool: Pool, targetId: string): Promise<void> {
  await pool.query(`DELETE FROM ${FAULT_TABLE} WHERE target_id = $1`, [targetId]);
}

async function clearAllFaults(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM ${FAULT_TABLE}`);
}
