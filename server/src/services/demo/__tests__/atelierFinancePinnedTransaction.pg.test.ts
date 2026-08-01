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
 */

import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import logger from '../../../utils/Logger.js';
import {
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';
import {
  probePinnedTransactionSupport,
  runPinnedPromotionTransaction,
  type PinnedWrite,
} from '../atelierFinancePromotionTransaction.js';

// The schema is already migrated in the target database; re-running `initDb()`
// on every worker is slow and pointless here.
process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Reachability is decided once, before the suite is declared. */
const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;

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

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 pinned-transaction suite SKIPPED] needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const ORG_ID = 'fin005-pinned-tx-org';
const IDS = getAtelierFinanceCanonicalIds(ORG_ID);
const [STMT_1, STMT_2, STMT_3] = IDS.statementIds;

/**
 * The same file serves both provisioned databases. Point `DATABASE_URL` at the
 * DRIFTED one (no `financial_statements.readiness_status` / `readiness_score`)
 * and the file runs the drift gate instead of the fault matrix — the fault
 * matrix is meaningless on a schema the seed must refuse outright.
 */
const DRIFTED = REACHABLE ? await isDrifted(CONNECTION_STRING) : false;

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

/** Out-of-band pool: assertions, fixture reset and fault control. Never the seed's. */
let control: Pool;

const suite = REACHABLE && !DRIFTED ? describe : describe.skip;
const driftSuite = REACHABLE && DRIFTED ? describe : describe.skip;

driftSuite('FIN-005 — schema drift gate on a real, drifted PostgreSQL', () => {
  let driftPool: Pool;

  beforeAll(async () => {
    driftPool = new Pool({ connectionString: CONNECTION_STRING, max: 4 });
    await driftPool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'FIN-005 pinned transaction fixture']
    );
  }, 60_000);

  afterAll(async () => {
    if (!driftPool) return;
    await deleteFixture(driftPool).catch(() => undefined);
    await driftPool.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]).catch(() => undefined);
    await driftPool.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it('refuses the fixture and produces ZERO false READY', async () => {
    const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID });

    expect(result.status).toBe('incomplete');
    expect(result.missing ?? []).toContain('financial_statements.readiness_status');
    expect(result.statementIds).toEqual([]);

    // Nothing was promoted — and, on this schema, nothing could even be written.
    const packs = await driftPool.query(
      `SELECT pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [IDS.packId]
    );
    for (const row of packs.rows) expect(row.pack_readiness_status).not.toBe('ready');

    const analyses = await driftPool.query(
      `SELECT status FROM financial_analyses WHERE id = $1`,
      [IDS.analysisId]
    );
    for (const row of analyses.rows) expect(row.status).not.toBe('APPROVED');

    const statements = await driftPool.query(
      `SELECT status, validation_status FROM financial_statements WHERE id = ANY($1::text[])`,
      [IDS.statementIds]
    );
    for (const row of statements.rows) {
      expect(row.status).not.toBe('confirmed');
      expect(row.validation_status).not.toBe('pass');
    }
  }, 60_000);
});

suite('FIN-005 — pinned promotion transaction against a real PostgreSQL', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 6 });
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG_ID, 'FIN-005 pinned transaction fixture']
    );
    await installFaultTriggers(control);
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await removeFaultTriggers(control).catch(() => undefined);
    await deleteFixture(control).catch(() => undefined);
    await control
      .query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID])
      .catch(() => undefined);
    await control.end().catch(() => undefined);
    // Close the pool the seed opened, otherwise vitest hangs on open handles.
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  beforeEach(async () => {
    await clearFault(control);
    await deleteFixture(control);
  });

  afterEach(async () => {
    await clearFault(control);
  });

  // -------------------------------------------------------------------------
  // Baseline — the pinned path is the one actually taken here.
  // -------------------------------------------------------------------------

  it('uses the PINNED path (not the compensating fallback) on a real connection', async () => {
    const probe = await probePinnedTransactionSupport();
    expect(probe.supported, `probe said: ${probe.reason}`).toBe(true);
    expect(probe.database).toBeTruthy();
  });

  it('promotes all five rows and commits them ON THE PINNED PATH', async () => {
    // TEETH. Without this the whole suite would still pass if the seed silently
    // fell back to verify-then-promote — the compensating rollback also leaves
    // "zero partial READY" behind. The log line is the only place the two paths
    // are distinguishable from the outside.
    const info = vi.spyOn(logger, 'info');
    const warn = vi.spyOn(logger, 'warn');
    try {
      const result = await seed();
      expect(result.status, result.reason ?? '').toBe('complete');
      await expectFixtureFullyReady();

      const lines = info.mock.calls.map((call) => String(call[0]));
      expect(lines.some((line) => line.includes('COMPLETE via the PINNED transaction path'))).toBe(
        true
      );
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
  }, 60_000);

  it(
    'is byte-identical on a second run: zero rows touched, zero timestamps moved',
    async () => {
      const first = await seed();
      expect(first.status, first.reason ?? '').toBe('complete');
      const before = await fixtureSnapshot();

      const second = await seed();
      expect(second.status, second.reason ?? '').toBe('complete');
      const after = await fixtureSnapshot();

      expect(after).toEqual(before);
      await expectFixtureFullyReady();
    },
    90_000
  );

  // -------------------------------------------------------------------------
  // Faults injected IN THE DATABASE, through the real seed.
  //
  // The trigger fires only on a PROMOTION write (the row being moved to
  // ready/APPROVED), so phase 0's heal, phase 1's upserts and the compensating
  // demotions are untouched — the fault lands exactly where the name says.
  // -------------------------------------------------------------------------

  const triggerFaults: Array<{ name: string; target: () => string }> = [
    { name: 'before the first UPDATE', target: () => STMT_1 },
    { name: 'after statement promotion 1', target: () => STMT_2 },
    { name: 'after statement promotion 2', target: () => STMT_3 },
    { name: 'after statement promotion 3', target: () => IDS.analysisId },
    { name: 'after the analysis promotion', target: () => IDS.packId },
  ];

  for (const fault of triggerFaults) {
    it(
      `leaves ZERO partial READY when the promotion fails ${fault.name}`,
      async () => {
        await setFault(control, fault.target());

        const startedAt = Date.now();
        const result = await seed();
        const elapsed = Date.now() - startedAt;

        expect(result.status).toBe('incomplete');
        // TEETH: this exact prefix is produced ONLY by the pinned path, so a
        // silent fall back to verify-then-promote reddens the test.
        expect(result.reason).toMatch(/^pinned promotion transaction rolled back: /);
        expect(result.reason).toMatch(/FIN005_INJECTED_FAULT/);
        expect(result.statementIds).toEqual([]);
        expect(elapsed, 'the faulted call must return in bounded time').toBeLessThan(30_000);

        await expectNoPartialReady();

        // The rollback is Postgres's, but the seed still verifies it rather
        // than asserting it.
        expect(result.promotion?.rowsStillClaimingReady ?? []).toEqual([]);

        // ...and the fixture recovers on the next run.
        await clearFault(control);
        const recovery = await seed();
        expect(recovery.status, recovery.reason ?? '').toBe('complete');
        await expectFixtureFullyReady();
      },
      90_000
    );
  }

  // -------------------------------------------------------------------------
  // Faults that need control INSIDE the transaction. Driven through the
  // adapter's own public callbacks — `plan` runs mid-transaction before any
  // write, `verify` runs after all five writes and before COMMIT — so no test
  // hook has to be added to production code.
  // -------------------------------------------------------------------------

  it(
    'leaves ZERO partial READY when the pre-COMMIT read-back refuses (after the pack promotion)',
    async () => {
      await seedThenDemote();

      const outcome = await runPinnedPromotionTransaction({
        lock: lockRequest(),
        plan: async () => ({ ok: true, writes: promotionWrites() }),
        verify: async () => ({ ok: false, reason: 'injected pre-COMMIT refusal' }),
      });

      expect(outcome.mode).toBe('pinned');
      expect(outcome).toMatchObject({ status: 'rolled-back' });
      if (outcome.mode === 'pinned' && outcome.status === 'rolled-back') {
        expect(outcome.applied).toHaveLength(5); // all five DID execute…
        expect(outcome.reason).toMatch(/injected pre-COMMIT refusal/);
      }
      await expectNoPartialReady(); // …and none of them survived.

      const recovery = await seed();
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady();
    },
    90_000
  );

  it(
    'leaves ZERO partial READY when the pinned backend is TERMINATED mid-transaction (before the writes)',
    async () => {
      await seedThenDemote();

      const startedAt = Date.now();
      const outcome = await runPinnedPromotionTransaction({
        lock: lockRequest(),
        plan: async (read) => {
          const pid = await backendPid(read);
          await terminateBackend(pid);
          // The next statement on a terminated backend fails; that is the fault.
          await read('SELECT 1');
          return { ok: true, writes: promotionWrites() };
        },
        verify: async () => ({ ok: true }),
      });
      const elapsed = Date.now() - startedAt;

      expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
      expect(elapsed, 'a terminated backend must not hang the call').toBeLessThan(30_000);
      await expectNoPartialReady();

      const recovery = await seed();
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady();
    },
    90_000
  );

  it(
    'leaves ZERO partial READY on a statement TIMEOUT mid-transaction',
    async () => {
      await seedThenDemote();

      const startedAt = Date.now();
      const outcome = await runPinnedPromotionTransaction({
        lock: lockRequest(),
        plan: async (read) => {
          await read(`SET LOCAL statement_timeout = 250`);
          await read(`SELECT pg_sleep(5)`); // exceeds the timeout -> 57014
          return { ok: true, writes: promotionWrites() };
        },
        verify: async () => ({ ok: true }),
        statementTimeoutMs: 5_000,
      });
      const elapsed = Date.now() - startedAt;

      expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
      if (outcome.mode === 'pinned' && outcome.status === 'rolled-back') {
        expect(outcome.reason).toMatch(/statement timeout|canceling statement/i);
        expect(outcome.applied).toEqual([]);
      }
      expect(elapsed, 'the timeout must bound the call').toBeLessThan(30_000);
      await expectNoPartialReady();

      const recovery = await seed();
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady();
    },
    90_000
  );

  it(
    'leaves ZERO partial READY on a SIGTERM-equivalent: backend killed after all five writes, before COMMIT',
    async () => {
      await seedThenDemote();

      let appliedInsideTx = 0;
      const startedAt = Date.now();
      const outcome = await runPinnedPromotionTransaction({
        lock: lockRequest(),
        plan: async () => ({ ok: true, writes: promotionWrites() }),
        verify: async (read) => {
          // All five promotion UPDATEs have executed and are visible INSIDE the
          // transaction at this point — prove it, then kill the backend without
          // any chance of a clean ROLLBACK.
          const rows = await read(
            `SELECT count(*)::int AS ready FROM financial_statements
              WHERE id = ANY($1::text[]) AND readiness_status = 'ready'`,
            [IDS.statementIds]
          );
          appliedInsideTx = Number(rows[0]?.ready ?? 0);
          await terminateBackend(await backendPid(read));
          return { ok: true }; // the COMMIT that follows can never succeed
        },
      });
      const elapsed = Date.now() - startedAt;

      expect(appliedInsideTx, 'the writes really were applied inside the transaction').toBe(3);
      expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
      expect(elapsed, 'a killed backend must not hang the call').toBeLessThan(30_000);

      // The whole point: uncommitted work dies with the connection.
      await expectNoPartialReady();

      const recovery = await seed();
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
      await expectFixtureFullyReady();
    },
    90_000
  );

  // -------------------------------------------------------------------------
  // The locks are real, not decorative.
  // -------------------------------------------------------------------------

  it(
    'holds a FOR UPDATE lock on the canonical rows for the life of the transaction',
    async () => {
      await seedThenDemote();

      let blockedWhileHeld: boolean | null = null;
      const outcome = await runPinnedPromotionTransaction({
        lock: lockRequest(),
        plan: async () => {
          blockedWhileHeld = await competingUpdateBlocks(IDS.packId);
          return { ok: false, reason: 'lock probe only' };
        },
        verify: async () => ({ ok: true }),
      });

      expect(blockedWhileHeld, 'a competing writer must block on the locked pack row').toBe(true);
      expect(outcome).toMatchObject({ mode: 'pinned', status: 'rolled-back' });
      await expectNoPartialReady();
    },
    90_000
  );

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function seed() {
    return upsertAtelierFinanceGoldenFlow({ organizationId: ORG_ID, createdBy: null });
  }

  /** A complete fixture, then demoted, so the promotion can be re-driven by hand. */
  async function seedThenDemote(): Promise<void> {
    const result = await seed();
    expect(result.status, result.reason ?? '').toBe('complete');
    await demoteFixture(control);
    await expectNoPartialReady();
  }

  function lockRequest() {
    return [
      { table: 'financial_statement_packs', ids: [IDS.packId] },
      { table: 'financial_statements', ids: IDS.statementIds },
      { table: 'financial_analyses', ids: [IDS.analysisId] },
    ];
  }

  /** The same five promotions the seed issues, expressed as plain SQL. */
  function promotionWrites(): PinnedWrite[] {
    return [
      ...IDS.statementIds.map((id) => ({
        label: id,
        sql: `UPDATE financial_statements
                 SET status = 'confirmed', validation_status = 'pass',
                     readiness_status = 'ready', readiness_score = 100
               WHERE id = $1`,
        params: [id],
      })),
      {
        label: IDS.analysisId,
        sql: `UPDATE financial_analyses SET status = 'APPROVED' WHERE id = $1`,
        params: [IDS.analysisId],
      },
      {
        label: IDS.packId,
        sql: `UPDATE financial_statement_packs
                 SET pack_status = 'confirmed', pack_readiness_status = 'ready',
                     pack_readiness_score = 100
               WHERE id = $1`,
        params: [IDS.packId],
      },
    ];
  }

  async function backendPid(read: (sql: string, params?: unknown[]) => Promise<
    Array<Record<string, unknown>>
  >): Promise<number> {
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
      return /lock timeout|canceling statement due to lock timeout/i.test(
        (error as Error).message
      );
    } finally {
      client?.release();
    }
  }

  /**
   * Everything a second run could disturb, including `updated_at` — the column
   * the FIN-005 no-op guard exists to protect.
   */
  async function fixtureSnapshot(): Promise<unknown> {
    const [packs, statements, values, analyses] = await Promise.all([
      control.query(
        `SELECT * FROM financial_statement_packs WHERE id = $1`,
        [IDS.packId]
      ),
      control.query(
        `SELECT * FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
        [IDS.statementIds]
      ),
      control.query(
        `SELECT * FROM financial_statement_values WHERE statement_id = ANY($1::text[]) ORDER BY id`,
        [IDS.statementIds]
      ),
      control.query(`SELECT * FROM financial_analyses WHERE id = $1`, [IDS.analysisId]),
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

  async function expectNoPartialReady(): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[])`,
      [IDS.statementIds]
    );
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).not.toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).not.toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).not.toBe('ready');
    }

    const analysis = await control.query(`SELECT status FROM financial_analyses WHERE id = $1`, [
      IDS.analysisId,
    ]);
    for (const row of analysis.rows) expect(row.status).not.toBe('APPROVED');

    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status FROM financial_statement_packs WHERE id = $1`,
      [IDS.packId]
    );
    for (const row of pack.rows) {
      expect(row.pack_status).not.toBe('confirmed');
      expect(row.pack_readiness_status).not.toBe('ready');
    }
  }

  async function expectFixtureFullyReady(): Promise<void> {
    const statements = await control.query(
      `SELECT id, status, validation_status, readiness_status
         FROM financial_statements WHERE id = ANY($1::text[]) ORDER BY id`,
      [IDS.statementIds]
    );
    expect(statements.rows).toHaveLength(IDS.statementIds.length);
    for (const row of statements.rows) {
      expect(row.status, `${row.id} status`).toBe('confirmed');
      expect(row.validation_status, `${row.id} validation_status`).toBe('pass');
      expect(row.readiness_status, `${row.id} readiness_status`).toBe('ready');
    }

    const analysis = await control.query(
      `SELECT status, source_statement_pack_id FROM financial_analyses WHERE id = $1`,
      [IDS.analysisId]
    );
    expect(analysis.rows).toHaveLength(1);
    expect(analysis.rows[0].status).toBe('APPROVED');
    expect(analysis.rows[0].source_statement_pack_id).toBe(IDS.packId);

    const pack = await control.query(
      `SELECT pack_status, pack_readiness_status, currency FROM financial_statement_packs WHERE id = $1`,
      [IDS.packId]
    );
    expect(pack.rows).toHaveLength(1);
    expect(pack.rows[0].pack_status).toBe('confirmed');
    expect(pack.rows[0].pack_readiness_status).toBe('ready');

    // Coherence: every canonical value is present and mapped, one currency.
    const values = await control.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE canonical_line_id IS NULL)::int AS unmapped
         FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [IDS.statementIds]
    );
    expect(values.rows[0].total).toBe(IDS.statementValueIds.length);
    expect(values.rows[0].unmapped).toBe(0);

    const currencies = await control.query(
      `SELECT DISTINCT currency FROM financial_statements WHERE id = ANY($1::text[])`,
      [IDS.statementIds]
    );
    expect(currencies.rows.map((row) => row.currency)).toEqual([pack.rows[0].currency]);
  }
});

// ---------------------------------------------------------------------------
// Fixture and fault plumbing (module scope so `beforeAll` can reach it)
// ---------------------------------------------------------------------------

async function deleteFixture(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`, [
    IDS.statementIds,
  ]);
  await pool.query(`DELETE FROM financial_analyses WHERE organization_id = $1`, [ORG_ID]);
  await pool.query(`DELETE FROM financial_statements WHERE organization_id = $1`, [ORG_ID]);
  await pool.query(`DELETE FROM financial_statement_packs WHERE organization_id = $1`, [ORG_ID]);
}

/** Put a complete fixture back into its phase-1 (not-ready) state. */
async function demoteFixture(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE financial_statements
        SET status = 'imported', validation_status = 'pending',
            readiness_status = 'pending', readiness_score = 0
      WHERE id = ANY($1::text[])`,
    [IDS.statementIds]
  );
  await pool.query(`UPDATE financial_analyses SET status = 'DRAFT' WHERE id = $1`, [
    IDS.analysisId,
  ]);
  await pool.query(
    `UPDATE financial_statement_packs
        SET pack_status = 'draft', pack_readiness_status = 'pending', pack_readiness_score = 0
      WHERE id = $1`,
    [IDS.packId]
  );
}

const FAULT_TABLE = 'fin005_pinned_fault_control';

/**
 * One BEFORE UPDATE trigger per table, raising on the promotion of one named
 * row.
 *
 * It fires ONLY when the incoming row is being moved into a READY-flavoured
 * state, so phase 0's heal, phase 1's upserts and the compensating demotions
 * pass through untouched — the fault lands on the promotion write and nowhere
 * else.
 *
 * ONE FUNCTION PER TABLE, not a shared one branching on `TG_TABLE_NAME`: a
 * plpgsql boolean expression is evaluated as a whole, so
 * `TG_TABLE_NAME = 'financial_statements' AND NEW.readiness_status = 'ready'`
 * still resolves `NEW.readiness_status` when the trigger fires on
 * `financial_analyses` and dies with `record "new" has no field …`. That
 * masqueraded as an injected fault in the first run of this suite.
 */
const FAULT_TRIGGERS: Array<{ table: string; predicate: string; label: string }> = [
  { table: 'financial_statements', predicate: `NEW.readiness_status = 'ready'`, label: 'statement' },
  { table: 'financial_analyses', predicate: `NEW.status = 'APPROVED'`, label: 'analysis' },
  {
    table: 'financial_statement_packs',
    predicate: `NEW.pack_readiness_status = 'ready'`,
    label: 'pack',
  },
];

const faultFunctionName = (table: string): string => `fin005_pinned_fault_${table}`;

async function installFaultTriggers(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS ${FAULT_TABLE} (id int PRIMARY KEY, target_id text)`);
  await pool.query(
    `INSERT INTO ${FAULT_TABLE} (id, target_id) VALUES (1, NULL) ON CONFLICT (id) DO NOTHING`
  );

  for (const trigger of FAULT_TRIGGERS) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION ${faultFunctionName(trigger.table)}() RETURNS trigger AS $fn$
      DECLARE target text;
      BEGIN
        SELECT target_id INTO target FROM ${FAULT_TABLE} WHERE id = 1;
        IF target IS NOT NULL AND NEW.id = target AND ${trigger.predicate} THEN
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

async function setFault(pool: Pool, targetId: string): Promise<void> {
  await pool.query(`UPDATE ${FAULT_TABLE} SET target_id = $1 WHERE id = 1`, [targetId]);
}

async function clearFault(pool: Pool): Promise<void> {
  await pool.query(`UPDATE ${FAULT_TABLE} SET target_id = NULL WHERE id = 1`).catch(() => undefined);
}
