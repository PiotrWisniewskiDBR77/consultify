/**
 * FIN-005 P1-2 — a late UPDATE after a JS timeout must not be able to
 * resurrect READY. Proved on a REAL PostgreSQL, in both directions.
 *
 * ===========================================================================
 * THE DEFECT, EXACTLY
 * ===========================================================================
 * `DbPromise.run`'s timeout settles the JS promise. It does NOT cancel the
 * query in the driver, and it does not roll anything back — the statement keeps
 * running on its backend and lands whenever it lands. On the compensating
 * fallback path that produces this sequence:
 *
 *     promotion UPDATE runs long
 *  -> the JS promise rejects
 *  -> the compensation demotes the rows and reports a clean failure
 *  -> the ORIGINAL UPDATE lands
 *  -> part of the fixture is READY again, AFTER the operation said it failed.
 *
 * There is a second tooth to it. The compensating demote is guarded by
 * `IS DISTINCT FROM`, and while the promotion is still in flight the row is
 * still visible in its phase-1 state — so the demote matches ZERO rows and
 * "succeeds" without writing anything. The seed then reads the rows back, sees
 * nothing promoted, and reports `every planned row was demoted and re-read as
 * not-ready`. The claim is true at the instant it is made and false a few
 * seconds later.
 *
 * ===========================================================================
 * WHAT THIS FILE PROVES
 * ===========================================================================
 * The RED half — the fallback ALGORITHM really does resurrect READY after
 * reporting failure — lives in `atelierFinanceLateWriteFallback.test.ts`. It
 * used to live here, forced onto a real database by setting `MOCK_DB=true`
 * mid-run, and that door is exactly what FIN-005 P1-1b closed: an env var can no
 * longer talk this module off PostgreSQL. What is left here is the pair of
 * PostgreSQL proofs.
 *
 * P1-1b — the same fault with `MOCK_DB=true` set. The seed STILL takes the
 *         pinned transaction, and nothing lands late. Before the fix this test
 *         went the other way: the fallback announced itself and READY came back
 *         from the dead.
 *
 * GREEN — the same fault, the same database, the ordinary PostgreSQL path. The
 *         promotion goes through the pinned transaction, the server's own
 *         `statement_timeout` cancels the slow UPDATE INSIDE the transaction,
 *         and `ROLLBACK` is the boundary. Nothing lands afterwards — the wait
 *         deliberately outlasts the trigger's ENTIRE sleep, so "no late write"
 *         is observed past the point where a surviving statement would have
 *         finished.
 *
 * ===========================================================================
 * THE FAULT
 * ===========================================================================
 * A `BEFORE UPDATE` trigger that `pg_sleep`s when a specific statement id is
 * being moved to `readiness_status = 'ready'`. It fires ONLY on a promotion, so
 * phase 0's heal and phase 1's upserts (which write `pending`) run at full
 * speed and the fault lands exactly on the write under test.
 *
 * `DB_QUERY_TIMEOUT` is lowered to 1.5s for this file, which is what drives the
 * JS side to its timeout — and, on the pinned path, what the adapter puts into
 * `SET LOCAL statement_timeout`. It must be set BEFORE the modules load, hence
 * `vi.hoisted`.
 *
 * ===========================================================================
 * HOW TO RUN — SEQUENTIALLY. THIS IS NOT OPTIONAL.
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_b \
 *   npx vitest run --retry=0 --fileParallelism=false \
 *     server/src/services/demo/__tests__/atelierFinance*.pg.test.ts
 *
 * `--fileParallelism=false` (or running this file alone) is load-bearing. This
 * file installs a trigger on `financial_statements` for the whole database, and
 * so does `atelierFinancePinnedTransaction.pg.test.ts`. Run in parallel against
 * ONE database they interleave — a trigger reading a table another worker is
 * creating, an ACCESS EXCLUSIVE lock a third worker's UPDATE queues behind — and
 * the failures look like adapter bugs while being pure harness interference.
 * Per-organization tenancy isolates the DATA, not the schema objects.
 */

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // Read once, at module load, by both `DbPromise` (its JS query timeout) and
  // the pinned adapter (its server-side statement timeout).
  process.env.DB_QUERY_TIMEOUT = '1500';
  process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';
});

import logger from '../../../utils/Logger.js';
import {
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
  type AtelierCanonicalIds,
} from '../atelierFinanceSeed.js';

const JS_TIMEOUT_MS = 1_500;
/**
 * How long the promotion UPDATE is held inside the trigger. It only has to
 * outlast the seed's own return (JS timeout 1.5s + the compensation), with room
 * to spare when the machine is loaded. Nothing in this file depends on it being
 * a particular value — the ORDERING is enforced by Postgres's lock queue, not by
 * wall clock. The green path cancels this write after 1.5s regardless.
 */
const TRIGGER_SLEEP_SECONDS = 20;

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HEALTHY_SCHEMA = REACHABLE ? await hasReadinessColumns(CONNECTION_STRING) : false;

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

async function hasReadinessColumns(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'financial_statements'
          AND column_name IN ('readiness_status', 'readiness_score')`
    );
    return Number(result.rows[0]?.present ?? 0) === 2;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE || !HEALTHY_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 late-write suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} migrated=${HEALTHY_SCHEMA}`
  );
}

const ORG_PREFIX = 'fin005-late-write';
const ORG_KEYS = ['red-fallback', 'green-pinned'] as const;
type OrgKey = (typeof ORG_KEYS)[number];

const orgFor = (key: OrgKey): string => `${ORG_PREFIX}-${key}`;
const idsFor = (key: OrgKey): AtelierCanonicalIds => getAtelierFinanceCanonicalIds(orgFor(key));

const FAULT_TABLE = 'fin005_late_write_faults';

let control: Pool;

const suite = REACHABLE && HEALTHY_SCHEMA ? describe.sequential : describe.skip;

suite('FIN-005 — a late UPDATE after a JS timeout cannot resurrect READY', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    for (const key of ORG_KEYS) {
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [orgFor(key), `FIN-005 late-write fixture (${key})`]
      );
    }
    await installSlowPromotionTrigger();
  }, 120_000);

  afterAll(async () => {
    if (!control) return;
    await removeSlowPromotionTrigger().catch(() => undefined);
    for (const key of ORG_KEYS) {
      await deleteFixture(idsFor(key)).catch(() => undefined);
      await control
        .query(`DELETE FROM organizations WHERE id = $1`, [orgFor(key)])
        .catch(() => undefined);
    }
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 120_000);

  afterEach(async () => {
    await control.query(`DELETE FROM ${FAULT_TABLE}`).catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // THE DOOR THAT USED TO OPEN — FIN-005 P1-1b.
  //
  // This test used to be the RED half, and it worked like this: set
  // `MOCK_DB=true` mid-run, ON THIS REAL DATABASE, because the seam predicate
  // accepted that bare env string as "no PostgreSQL here". The seed then took
  // the compensating path against a real Postgres and the abandoned UPDATE
  // resurrected READY after the seed had reported failure. That is not a test
  // fixture — it is a production hazard that a stray Railway service variable
  // could trigger, and `NODE_ENV=production` did not protect.
  //
  // The seam is now decided by asking the DATABASE first, so the env var cannot
  // open that door. Same fault, same database, same env var: the promotion goes
  // through the pinned transaction and nothing lands late.
  //
  // THE RED HALF DID NOT DISAPPEAR — it moved to
  // `atelierFinanceLateWriteFallback.test.ts`, where the fallback is reached
  // through the one seam that is real (a wholesale-doubled `DbPromise`) and the
  // resurrection is still demonstrated. Without it, the GREEN test below would
  // be a green light with no red light behind it.
  // -------------------------------------------------------------------------

  it(
    'MOCK_DB=true can no longer open the non-atomic path: the pinned transaction still runs, and nothing lands late',
    async () => {
      const ids = await seedThenDemote('red-fallback');
      const victim = ids.statementIds[0];
      await armFault(victim, 'slow-promotion');

      const previousMockDb = process.env.MOCK_DB;
      const warn = vi.spyOn(logger, 'warn');
      let result: Awaited<ReturnType<typeof seed>>;
      let warnLines: string[];
      const startedAt = Date.now();
      try {
        process.env.MOCK_DB = 'true';
        result = await seed('red-fallback');
      } finally {
        process.env.MOCK_DB = previousMockDb;
        // Read the calls BEFORE restoring: `mockRestore` clears the history, and
        // an assertion made after it is an assertion against an empty array.
        warnLines = warn.mock.calls.map((call) => String(call[0]));
        warn.mockRestore();
      }
      const elapsed = Date.now() - startedAt;

      // TEETH. This single line is the whole regression: before the fix it was
      // present, and the fixture was promoted by five autocommitted UPDATEs on a
      // real database.
      expect(warnLines.length, 'the spy must actually have observed the run').toBeGreaterThan(0);
      expect(
        warnLines.some((line) => line.includes('WITHOUT a pinned transaction')),
        'a stray MOCK_DB=true must not degrade a real PostgreSQL to the non-atomic path'
      ).toBe(false);

      // The slow promotion is cancelled by the server INSIDE the transaction,
      // exactly as on the ordinary path — produced only by the pinned path.
      expect(result.status).toBe('incomplete');
      expect(result.reason).toMatch(/^pinned promotion transaction rolled back: /);
      expect(result.reason).toMatch(/canceling statement|statement timeout/i);
      expect(elapsed, 'the server-side timeout must bound the call').toBeLessThan(60_000);

      // And no write appears afterwards — waited out past the trigger's ENTIRE
      // sleep, the window in which the old behaviour resurrected the row.
      const resurrected = await waitForStatementReady(victim, (TRIGGER_SLEEP_SECONDS + 5) * 1_000);
      expect(
        resurrected,
        'no late write may appear: the UPDATE was cancelled inside a transaction that rolled back'
      ).toBe(false);
      await expectNoPartialReady(ids);
    },
    240_000
  );

  // -------------------------------------------------------------------------
  // GREEN — the ordinary PostgreSQL path. Same fault, same database.
  // -------------------------------------------------------------------------

  it(
    'GREEN: on PostgreSQL the promotion goes through the pinned transaction and no late write can appear',
    async () => {
      const ids = await seedThenDemote('green-pinned');
      const victim = ids.statementIds[0];
      await armFault(victim, 'slow-promotion');

      const warn = vi.spyOn(logger, 'warn');
      let result: Awaited<ReturnType<typeof seed>>;
      let warnLines: string[];
      const startedAt = Date.now();
      try {
        result = await seed('green-pinned');
      } finally {
        warnLines = warn.mock.calls.map((call) => String(call[0]));
        warn.mockRestore();
      }
      const elapsed = Date.now() - startedAt;

      // TEETH: the fallback must not even have been considered here. Read from
      // the captured lines, not from a restored spy — see the RED test.
      expect(warnLines.length, 'the spy must actually have observed the run').toBeGreaterThan(0);
      expect(
        warnLines.some((line) => line.includes('WITHOUT a pinned transaction')),
        'PostgreSQL must never take the compensating path'
      ).toBe(false);

      expect(result.status).toBe('incomplete');
      // Produced ONLY by the pinned path.
      expect(result.reason).toMatch(/^pinned promotion transaction rolled back: /);
      expect(result.reason).toMatch(/canceling statement|statement timeout/i);
      expect(result.statementIds).toEqual([]);
      expect(elapsed, 'the server-side timeout must bound the call').toBeLessThan(60_000);

      // The write was cancelled INSIDE a transaction that then rolled back, so
      // there is nothing left to land. Wait past the trigger's ENTIRE sleep
      // before believing it — a statement that had survived would have finished
      // and landed well inside this budget.
      const resurrected = await waitForStatementReady(victim, (TRIGGER_SLEEP_SECONDS + 5) * 1_000);
      expect(
        resurrected,
        'GREEN PROOF: no write may appear after the operation returned'
      ).toBe(false);
      await expectNoPartialReady(ids);

      // ...and once the fault is gone the fixture recovers normally.
      await control.query(`DELETE FROM ${FAULT_TABLE}`);
      const recovery = await seed('green-pinned');
      expect(recovery.status, recovery.reason ?? '').toBe('complete');
    },
    240_000
  );

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function seed(key: OrgKey) {
    return upsertAtelierFinanceGoldenFlow({ organizationId: orgFor(key), createdBy: null });
  }

  async function seedThenDemote(key: OrgKey): Promise<AtelierCanonicalIds> {
    const ids = idsFor(key);
    await deleteFixture(ids);
    const first = await seed(key);
    expect(first.status, first.reason ?? '').toBe('complete');
    await demoteFixture(ids);
    await expectNoPartialReady(ids);
    return ids;
  }

  /** Arm the row-scoped slow-promotion fault for `statementId`. */
  async function armFault(statementId: string, mode: 'slow-promotion'): Promise<void> {
    await control.query(
      `INSERT INTO ${FAULT_TABLE} (target_id, mode) VALUES ($1, $2)
         ON CONFLICT (target_id, mode) DO NOTHING`,
      [statementId, mode]
    );
  }

  /** Does the persisted row CLAIM a READY-flavoured state? Read out of band. */
  async function isStatementReady(statementId: string): Promise<boolean> {
    const rows = await control.query(
      `SELECT status, validation_status, readiness_status FROM financial_statements WHERE id = $1`,
      [statementId]
    );
    const row = rows.rows[0];
    if (!row) return false;
    return (
      row.status === 'confirmed' ||
      row.validation_status === 'pass' ||
      row.readiness_status === 'ready'
    );
  }

  /** Poll until the row claims READY, or the budget runs out. */
  async function waitForStatementReady(statementId: string, budgetMs: number): Promise<boolean> {
    const deadline = Date.now() + budgetMs;
    for (;;) {
      if (await isStatementReady(statementId)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  async function deleteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`DELETE FROM financial_analyses WHERE id = $1`, [ids.analysisId]);
    await control.query(`DELETE FROM financial_statements WHERE id = ANY($1::text[])`, [
      ids.statementIds,
    ]);
    await control.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [ids.packId]);
  }

  async function demoteFixture(ids: AtelierCanonicalIds): Promise<void> {
    await control.query(
      `UPDATE financial_statements
          SET status = 'imported', validation_status = 'pending',
              readiness_status = 'pending', readiness_score = 0
        WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await control.query(`UPDATE financial_analyses SET status = 'DRAFT' WHERE id = $1`, [
      ids.analysisId,
    ]);
    await control.query(
      `UPDATE financial_statement_packs
          SET pack_status = 'draft', pack_readiness_status = 'pending', pack_readiness_score = 0
        WHERE id = $1`,
      [ids.packId]
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
});

// ---------------------------------------------------------------------------
// The slow-promotion trigger (module scope so the hooks can reach it)
// ---------------------------------------------------------------------------

async function installSlowPromotionTrigger(): Promise<void> {
  // IF NOT EXISTS + DELETE, never DROP + CREATE: the trigger below reads this
  // table on EVERY update of `financial_statements`, so dropping it takes an
  // ACCESS EXCLUSIVE lock that any concurrent writer would queue behind.
  await control.query(
    `CREATE TABLE IF NOT EXISTS ${FAULT_TABLE} (target_id text NOT NULL, mode text NOT NULL,
       PRIMARY KEY (target_id, mode))`
  );
  await control.query(`DELETE FROM ${FAULT_TABLE}`);
  // Row-scoped and mode-scoped. `slow-promotion` fires ONLY on a promotion
  // (`ready`), so phase 0's heal and phase 1's upserts run at full speed and the
  // fault lands exactly on the write under test.
  await control.query(`
    CREATE OR REPLACE FUNCTION fin005_late_write_slow_promotion() RETURNS trigger AS $fn$
    BEGIN
      IF NEW.readiness_status = 'ready'
         AND EXISTS (SELECT 1 FROM ${FAULT_TABLE}
                      WHERE target_id = NEW.id AND mode = 'slow-promotion') THEN
        PERFORM pg_sleep(${TRIGGER_SLEEP_SECONDS});
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  `);
  await control.query(
    `DROP TRIGGER IF EXISTS fin005_late_write_slow_trg ON financial_statements`
  );
  await control.query(
    `CREATE TRIGGER fin005_late_write_slow_trg BEFORE UPDATE ON financial_statements
       FOR EACH ROW EXECUTE FUNCTION fin005_late_write_slow_promotion()`
  );
}

async function removeSlowPromotionTrigger(): Promise<void> {
  await control.query(
    `DROP TRIGGER IF EXISTS fin005_late_write_slow_trg ON financial_statements`
  );
  await control.query(`DROP FUNCTION IF EXISTS fin005_late_write_slow_promotion()`);
  await control.query(`DROP TABLE IF EXISTS ${FAULT_TABLE}`);
}

// Referenced by the assertions above; kept next to the trigger it guards.
void JS_TIMEOUT_MS;
