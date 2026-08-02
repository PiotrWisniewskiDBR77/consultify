/**
 * FIN-005 P1-A — DECISIVE READS COME FROM THE PRIMARY, proved against a real
 * PostgreSQL with a real, LAGGING read seam.
 *
 * ===========================================================================
 * THE DEFECT
 * ===========================================================================
 * `DbPromise.get` and `DbPromise.all` route to `PostgresDatabase.getReadPool()`,
 * which is the READ REPLICA pool whenever `DB_READ_URL` / `DATABASE_READ_URL` is
 * configured. The connection-identity guard in
 * `fin005-seed-atelier-finance.ts` deliberately ALLOWS a replica there — it
 * compares `system_identifier`, database name and database OID, and a physical
 * standby reproduces all three. That is the correct design: a legitimate replica
 * must not be mistaken for a foreign cluster.
 *
 * What a standby does not reproduce is the WAL position. It lags. And every
 * decisive question this packet asks used to travel down that pipe:
 *
 *   - phase 0's residue check (`findRowsStillClaimingReady`), which DECIDES TO
 *     DEMOTE THE WHOLE FIXTURE when it sees a mixed state;
 *   - the schema probe, whose column sets decide what is written and verified;
 *   - the promotion plan on the non-pinned seam;
 *   - the rollback verification, i.e. the decision to escalate.
 *
 * A replica that has not yet replayed the last seed run answers all of them with
 * the PRE-write rows. The seed then "heals" a perfectly healthy fixture, or
 * refuses a promotion that already succeeded. Compensation computed from stale
 * evidence is the worst possible failure mode here, because it WRITES.
 *
 * ===========================================================================
 * THE SEAM THIS FILE BUILDS
 * ===========================================================================
 * A physical standby cannot be conjured on a laptop, and it does not need to be:
 * the defect is not about replication, it is about WHICH POOL a decisive read
 * goes to. So `DB_READ_URL` is pointed at a SECOND, fully migrated database
 * (`fin005_rep`) that is deliberately loaded with the OLD state — the state the
 * fixture had before the last run. That is exactly what a lagging replica shows,
 * and it has the property a real replica lacks: it is stable, so the test is
 * deterministic.
 *
 * The seam is ARMED FIRST and PROVED ARMED (`the read pool really is on
 * fin005_rep, the write pool really is on fin005_pri`) before anything else is
 * asserted. Without that check every green result in this file would be
 * vacuous — a misconfigured `DB_READ_URL` would make the whole suite pass by
 * doing nothing.
 *
 * ===========================================================================
 * HOW TO RUN — SEQUENTIALLY, WITH BOTH DATABASES
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/fin005_pri \
 *   DB_READ_URL=postgresql://<user>@localhost:5432/fin005_rep \
 *   npx vitest run --retry=0 --fileParallelism=false \
 *     server/src/services/demo/__tests__/atelierFinancePrimaryReads.pg.test.ts
 *
 * RUN IT IN ITS OWN VITEST INVOCATION. This file sets `DB_READ_URL` at module
 * load, and `process.env` is shared across the files in a worker even when their
 * module registries are not. A leaked `DB_READ_URL` gives every other pg suite a
 * configured read replica, which changes what
 * `atelierFinanceFailClosed.pg.test.ts` expects from a divergent seam probe (a
 * refusal when no replica is configured, a loud log when one is). Batching this
 * file with the others is a harness bug that reads like an adapter bug.
 *
 * ===========================================================================
 * HOW THIS WAS PROVED RED
 * ===========================================================================
 * `findRowsStillClaimingReady` was temporarily given back its old default
 * (`read: params.read ?? dbPromiseReader`) and phase 0's call was reverted to
 * omit `read`. With that one change the run against this seam logs
 * `residual MIXED promotion state found on entry (2/5 rows claim READY)`,
 * demotes and re-promotes all five rows, and `updated_at` moves on every one of
 * them — so `leaves the primary byte-identical` and `runs no compensation` both
 * fail. Restoring the required parameter turns them green.
 */

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const PRIMARY_URL = process.env.DATABASE_URL ?? '';
/**
 * The stale read seam. Defaults to the sibling scratch database so the file is
 * runnable with the same one-line environment the other pg suites use.
 */
const READ_SEAM_URL =
  process.env.FIN005_READ_SEAM_URL ??
  (PRIMARY_URL ? PRIMARY_URL.replace(/\/[^/]+$/, '/fin005_rep') : '');

vi.hoisted(() => {
  process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';
});

import * as DbPromise from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';
import { openDecisiveReadSession } from '../atelierFinancePromotionTransaction.js';
import {
  type AtelierCanonicalIds,
  getAtelierFinanceCanonicalIds,
  upsertAtelierFinanceGoldenFlow,
} from '../atelierFinanceSeed.js';

const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  PRIMARY_URL.startsWith('postgres') &&
  READ_SEAM_URL.startsWith('postgres') &&
  READ_SEAM_URL !== PRIMARY_URL;

const REACHABLE = REAL_DB_REQUESTED
  ? (await canReach(PRIMARY_URL)) && (await canReach(READ_SEAM_URL))
  : false;

/**
 * ARM THE SEAM — as late as possible, only when it is real, and put it back.
 *
 * `DatabaseConfig` resolves `DB_READ_URL` LAZILY on first access, so setting it
 * here (after the imports have been evaluated, before any database call) is what
 * `PostgresDatabase.getReadPool()` will see. Two things are deliberate:
 *
 *   - GATED ON REACHABLE. Pointing `DB_READ_URL` at a database that does not
 *     exist would break every read in the process instead of skipping this file;
 *   - RESTORED IN `afterAll`. `process.env` is shared across the files in a
 *     vitest worker even when their module registries are not, and a leaked
 *     `DB_READ_URL` hands every other pg suite a configured read replica — which
 *     changes what `atelierFinanceFailClosed.pg.test.ts` expects from a
 *     divergent seam probe (a refusal when no replica is configured, a loud log
 *     when one is). Running this file in its own vitest invocation is still the
 *     recommendation; this makes the batched case safe rather than lucky.
 */
const PREVIOUS_DB_READ_URL = process.env.DB_READ_URL;
if (REACHABLE) {
  process.env.DB_READ_URL = READ_SEAM_URL;
}

async function canReach(connectionString: string): Promise<boolean> {
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

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[FIN-005 primary-reads suite SKIPPED — this is a clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a migrated DATABASE_URL and a ` +
      `migrated, DIFFERENT read seam (DB_READ_URL / FIN005_READ_SEAM_URL). ` +
      `requested=${REAL_DB_REQUESTED} primary=${PRIMARY_URL ? 'set' : 'unset'} seam=${READ_SEAM_URL || 'unset'}`
  );
}

const ORG = 'fin005-primary-reads';
const ids: AtelierCanonicalIds = getAtelierFinanceCanonicalIds(ORG);

const suite = REACHABLE ? describe.sequential : describe.skip;

/** Every column of every canonical row — the byte-identity assertion. */
type FixtureSnapshot = Record<string, Array<Record<string, unknown>>>;

suite('FIN-005 P1-A — decisive reads come from the PRIMARY, never the read seam', () => {
  let primary: Pool;
  let seam: Pool;

  beforeAll(async () => {
    primary = new Pool({ connectionString: PRIMARY_URL, max: 4 });
    seam = new Pool({ connectionString: READ_SEAM_URL, max: 4 });
    for (const pool of [primary, seam]) {
      await pool.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [ORG, 'FIN-005 primary-reads fixture']
      );
      await deleteFixture(pool);
    }
  }, 120_000);

  afterAll(async () => {
    for (const pool of [primary, seam]) {
      if (!pool) continue;
      await deleteFixture(pool).catch(() => undefined);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
    if (PREVIOUS_DB_READ_URL === undefined) delete process.env.DB_READ_URL;
    else process.env.DB_READ_URL = PREVIOUS_DB_READ_URL;
  }, 120_000);

  // -------------------------------------------------------------------------
  // ARM THE SEAM, AND PROVE IT IS ARMED.
  //
  // This test exists so the rest of the file cannot pass vacuously. If
  // `DB_READ_URL` did not take effect, `DbPromise.all` would answer from the
  // primary, the "stale" rows would never be read by anything, and every
  // assertion below would hold for the wrong reason.
  // -------------------------------------------------------------------------
  it('the read pool and the write pool really are DIFFERENT databases', async () => {
    const readSide = await DbPromise.all<{ db: string }>('SELECT current_database() AS db', [], {
      fallback: false,
    });
    const opened = await openDecisiveReadSession();
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    try {
      expect(opened.session.seam).toBe('primary');
      expect(opened.session.identity?.inRecovery).toBe(false);
      expect(opened.session.identity?.database).toBe('fin005_pri');
      expect(readSide[0]?.db).toBe('fin005_rep');
      // The decisive session is on the primary; DbPromise's reads are not.
      expect(opened.session.identity?.database).not.toBe(readSide[0]?.db);
    } finally {
      await opened.session.close();
    }
  }, 60_000);

  it('the decisive reader answers from the PRIMARY even when the read pool disagrees', async () => {
    // A row that exists ONLY on the read seam. A reader bound to the primary
    // must not see it; a reader on `DbPromise` must.
    await seam.query(
      `INSERT INTO financial_statement_packs
           (id, organization_id, entity_name, currency, pack_status, period_start, period_end)
         VALUES ($1, $2, 'seam-only', 'EUR', 'draft', '2014-01-01', '2014-12-31')
         ON CONFLICT (id) DO NOTHING`,
      [`${ids.packId}--seam-only`, ORG]
    );
    try {
      const opened = await openDecisiveReadSession();
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      try {
        const viaPrimary = await opened.session.read(
          `SELECT id FROM financial_statement_packs WHERE id = ?`,
          [`${ids.packId}--seam-only`]
        );
        const viaReadPool = await DbPromise.all<{ id: string }>(
          `SELECT id FROM financial_statement_packs WHERE id = $1`,
          [`${ids.packId}--seam-only`],
          { fallback: false }
        );
        expect(
          viaPrimary,
          'the primary must not see a row that only exists on the seam'
        ).toHaveLength(0);
        expect(viaReadPool, 'the seam is armed: the read pool DOES see it').toHaveLength(1);
      } finally {
        await opened.session.close();
      }
    } finally {
      await seam.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [
        `${ids.packId}--seam-only`,
      ]);
    }
  }, 60_000);

  // -------------------------------------------------------------------------
  // THE ACTUAL PROOF.
  //
  // Run 1 promotes the fixture on the primary. The seam is then loaded with the
  // state that fixture had BEFORE run 1 — three pending statements under a READY
  // pack and an APPROVED analysis (a MIXED residue, 2/5), and no statement
  // values at all. Both halves are decisive:
  //
  //   the MIXED residue would make phase 0 DEMOTE ALL FIVE ROWS;
  //   the missing values would make the promotion plan REFUSE, ending the run
  //   `incomplete` over a fixture that is in fact perfectly READY.
  //
  // Run 2 must see neither.
  // -------------------------------------------------------------------------
  it('a stale read seam changes NOTHING: no heal, no compensation, verdict from the primary', async () => {
    const first = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG });
    expect(first.status, first.reason ?? '').toBe('complete');

    await loadStaleStateIntoSeam();
    const seamResidue = await seam.query(
      `SELECT count(*)::int AS ready FROM financial_statements
          WHERE id = ANY($1::text[]) AND readiness_status = 'ready'`,
      [ids.statementIds]
    );
    expect(
      Number(seamResidue.rows[0]?.ready ?? -1),
      'the seam must be showing the OLD, not-yet-promoted statements'
    ).toBe(0);
    const seamValues = await seam.query(
      `SELECT count(*)::int AS n FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    expect(Number(seamValues.rows[0]?.n ?? -1), 'the seam must be missing the values').toBe(0);

    const before = await snapshotPrimary();

    const warn = vi.spyOn(logger, 'warn');
    const readPoolSql: string[] = [];
    const realAll = DbPromise.all;
    const allSpy = vi.spyOn(DbPromise, 'all').mockImplementation(((
      sql: string,
      params?: unknown[],
      options?: unknown
    ) => {
      readPoolSql.push(String(sql));
      return (realAll as unknown as (...args: unknown[]) => unknown)(sql, params, options);
    }) as typeof DbPromise.all);

    let second: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    let warnLines: string[];
    try {
      second = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG });
    } finally {
      warnLines = warn.mock.calls.map((call) => String(call[0]));
      warn.mockRestore();
      allSpy.mockRestore();
    }

    // 1. THE VERDICT COMES FROM THE PRIMARY. On the seam's evidence this run
    //    would have been `incomplete` (no statement values).
    expect(second.status, second.reason ?? '').toBe('complete');
    expect(second.promotion?.rolledBack).toBe(false);
    expect(second.promotion?.rowsStillClaimingReady ?? []).toEqual([]);

    // 2. NO COMPENSATION RAN. Phase 0 saw 5/5 on the primary, not 2/5 on the
    //    seam, so it did not demote anything.
    expect(
      warnLines.some((line) => line.includes('residual MIXED promotion state')),
      `phase 0 must not heal on stale evidence; warnings: ${warnLines.join(' | ')}`
    ).toBe(false);

    // 3. BYTE-IDENTICAL. A demote-then-re-promote would move `updated_at` on
    //    all five rows; a guarded no-op re-run moves nothing.
    expect(await snapshotPrimary()).toEqual(before);

    // 4. NOT ONE CANONICAL READ WENT DOWN THE READ POOL. `DbPromise.all` is
    //    still reachable — the pinned adapter's availability probe uses it on
    //    purpose, because the question there is "is the module the caller
    //    writes through a real PostgreSQL". Nothing about the FIXTURE may go
    //    that way.
    const canonicalReads = readPoolSql.filter((sql) =>
      /financial_statement|financial_analyses|financial_statement_packs|information_schema/i.test(
        sql
      )
    );
    expect(
      canonicalReads,
      `these fixture/schema reads went to the READ POOL: ${canonicalReads.join(' ;; ')}`
    ).toEqual([]);
    expect(
      readPoolSql.every((sql) => /pinned_probe_db|SELECT 1/i.test(sql)),
      `unexpected read-pool traffic: ${readPoolSql.join(' ;; ')}`
    ).toBe(true);

    // 5. The seed wrote nothing to the seam — it never had a connection to it.
    const seamAfter = await seam.query(
      `SELECT count(*)::int AS n FROM financial_statement_values WHERE statement_id = ANY($1::text[])`,
      [ids.statementIds]
    );
    expect(Number(seamAfter.rows[0]?.n ?? -1)).toBe(0);
  }, 240_000);

  it("the heal fires on the PRIMARY's state, even while the seam says everything is READY", async () => {
    // The mirror image of the test above, and red-sensitive in the opposite
    // direction. The PRIMARY is put into a genuine MIXED residue (pack READY,
    // analysis APPROVED, three statements pending) while the SEAM claims all
    // five are ready. Phase 0 must heal — because the primary is mixed — and
    // must not be talked out of it by the seam.
    await primary.query(
      `UPDATE financial_statements SET status = 'imported', validation_status = 'pending',
            readiness_status = 'pending', readiness_score = 0 WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
    await seam.query(
      `UPDATE financial_statements SET status = 'confirmed', validation_status = 'pass',
            readiness_status = 'ready' WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );

    const warn = vi.spyOn(logger, 'warn');
    let result: Awaited<ReturnType<typeof upsertAtelierFinanceGoldenFlow>>;
    let warnLines: string[];
    try {
      result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG });
    } finally {
      warnLines = warn.mock.calls.map((call) => String(call[0]));
      warn.mockRestore();
    }

    expect(result.status, result.reason ?? '').toBe('complete');
    expect(
      warnLines.some((line) => line.includes('residual MIXED promotion state')),
      `phase 0 must heal on the PRIMARY's mixed state; warnings: ${warnLines.join(' | ')}`
    ).toBe(true);
    expect(result.promotion?.rowsStillClaimingReady ?? []).toEqual([]);
    expect(result.promotion?.rollbackErrors ?? []).toEqual([]);
  }, 240_000);

  it('a DRIFTED seam schema cannot make a healthy primary report INCOMPLETE', async () => {
    // The schema probe decides `missing` -> `incomplete`, and its column sets
    // decide what every later write and read-back names. A replica that has
    // not yet replayed a migration is the ordinary case, not an exotic one.
    // Drop a readiness column ON THE SEAM ONLY: a probe that reads the seam
    // reports `financial_statements.readiness_status` missing and ends the run
    // `incomplete` over a database where the column is perfectly present.
    await seam.query(`ALTER TABLE financial_statements DROP COLUMN IF EXISTS readiness_status`);
    try {
      const drifted = await DbPromise.all<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'financial_statements'
              AND column_name = 'readiness_status'`,
        [],
        { fallback: false }
      );
      expect(Number(drifted[0]?.n ?? -1), 'the seam must really be drifted').toBe(0);

      const result = await upsertAtelierFinanceGoldenFlow({ organizationId: ORG });
      expect(result.status, result.reason ?? '').toBe('complete');
      expect(result.missing ?? []).toEqual([]);
    } finally {
      await seam.query(
        `ALTER TABLE financial_statements ADD COLUMN IF NOT EXISTS readiness_status TEXT`
      );
    }
  }, 240_000);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function deleteFixture(pool: Pool): Promise<void> {
    await pool
      .query(`DELETE FROM financial_statement_values WHERE statement_id = ANY($1::text[])`, [
        ids.statementIds,
      ])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM financial_analyses WHERE id = $1`, [ids.analysisId])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM financial_statement_ingest_runs WHERE statement_id = ANY($1::text[])`, [
        ids.statementIds,
      ])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM financial_statements WHERE id = ANY($1::text[])`, [ids.statementIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM financial_statement_packs WHERE id = $1`, [ids.packId])
      .catch(() => undefined);
  }

  /**
   * Copy the primary's canonical rows onto the seam and roll them BACK to the
   * state they had before the promotion — which is exactly what a replica that
   * has not replayed the last transaction shows. The statement VALUES are left
   * out entirely, which is the stronger half: the promotion plan reads them, and
   * without them it refuses.
   */
  async function loadStaleStateIntoSeam(): Promise<void> {
    await deleteFixture(seam);
    await copyRows('financial_statement_packs', `id = '${ids.packId}'`);
    await copyRows('financial_statements', `id = ANY(ARRAY['${ids.statementIds.join("','")}'])`);
    await copyRows('financial_analyses', `id = '${ids.analysisId}'`);
    // The MIXED residue: pack READY + analysis APPROVED, statements pending.
    await seam.query(
      `UPDATE financial_statements SET status = 'imported', validation_status = 'pending',
          readiness_status = 'pending', readiness_score = 0 WHERE id = ANY($1::text[])`,
      [ids.statementIds]
    );
  }

  /**
   * Copy rows between two databases WITHOUT re-typing them by hand.
   *
   * `to_jsonb(t)` on the source and `jsonb_populate_record(NULL::<table>, …)` on
   * the destination round-trip every column through the server's own I/O
   * functions, so `json`, `text[]`, `real`, `timestamptz` and friends all land
   * back in their own types. Passing the driver's decoded JS values straight
   * back into an INSERT does not: a `json` column arrives as an object and is
   * then sent as a Postgres record literal, which fails with
   * `invalid input syntax for type json`.
   */
  async function copyRows(table: string, where: string): Promise<void> {
    const source = await primary.query(
      `SELECT to_jsonb(t) AS payload FROM ${table} t WHERE ${where}`
    );
    for (const row of source.rows as Array<{ payload: unknown }>) {
      await seam.query(
        `INSERT INTO ${table}
         SELECT * FROM jsonb_populate_record(NULL::${table}, $1::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(row.payload)]
      );
    }
  }

  /** Every column of every canonical row on the PRIMARY, `updated_at` included. */
  async function snapshotPrimary(): Promise<FixtureSnapshot> {
    const snapshot: FixtureSnapshot = {};
    const queries: Array<[string, string, unknown[]]> = [
      ['financial_statement_packs', 'id = $1', [ids.packId]],
      ['financial_statements', 'id = ANY($1::text[])', [ids.statementIds]],
      ['financial_analyses', 'id = $1', [ids.analysisId]],
      ['financial_statement_values', 'statement_id = ANY($1::text[])', [ids.statementIds]],
    ];
    for (const [table, where, params] of queries) {
      const result = await primary.query(
        `SELECT * FROM ${table} WHERE ${where} ORDER BY id`,
        params
      );
      snapshot[table] = (result.rows as Array<Record<string, unknown>>).map((row) =>
        JSON.parse(JSON.stringify(row))
      );
    }
    return snapshot;
  }
});
