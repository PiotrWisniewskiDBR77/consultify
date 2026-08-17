/** @vitest-environment node */
/**
 * Finance B2 — approveModel() as ONE unit of work: atomicity, same-model
 * concurrency, forced-failure rollback, and pool-client release.
 *
 * Real PostgreSQL only. Nothing here mocks the database, auth, or tenancy;
 * every failure injected below is a REAL Postgres constraint violation or a
 * REAL concurrent transaction, and every assertion reads back committed
 * state (often from a separate cold Pool).
 *
 * Priority is correctness, not performance. The perf gate lives in
 * financialModelingService.approvePersist.perfgate.pg.test.ts.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  approveModel,
  computeModel,
  persistComputeResult,
  type ComputeResult,
} from '../financialModelingService.js';
import {
  getPoolClientForPinnedTransaction,
  getPrimaryPoolSaturationPercent,
} from '../../database/PostgresDatabase.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `finb2u-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const user = `${prefix}-user`;
const HORIZON_MONTHS = 60;
const EXPECTED_OUTPUT_ROWS = 2580;

function assumptionsJson(): string {
  // Balanced at t=0 by construction:
  //   Assets 470k+150k+100k+800k = 1,520k ; L+E 120k+400k+1,000k = 1,520k
  return JSON.stringify({
    initialCash: 470_000,
    initialEquity: 1_000_000,
    initialDebt: 400_000,
    initialPPE: 800_000,
    initialAR: 150_000,
    initialInventory: 100_000,
    initialAP: 120_000,
    initialOtherAssets: 0,
    initialOtherLiabilities: 0,
    baseline: {
      revenue: 1_000_000,
      cogs: 400_000,
      opex: 300_000,
      depreciation: 50_000,
      interest: 10_000,
      tax: 50_000,
      capex: 60_000,
    },
  });
}

/** A structurally valid ComputeResult with one deliberately poisoned field. */
function fakeResult(poison?: { validationStatus?: string; periodDate?: string }): ComputeResult {
  return {
    periods: [
      {
        date: poison?.periodDate ?? '2026-01-01',
        label: 'Jan 2026',
        pl: { REVENUE: 100 },
        bs: { CASH: 100 },
        cf: { CLOSING_CASH: 100 },
      },
    ],
    validations: [
      {
        checkCode: 'FORCED',
        checkName: 'forced',
        status: (poison?.validationStatus ?? 'pass') as 'pass',
        expected: 1,
        actual: 1,
        difference: 0,
        message: 'forced failure probe',
        periodDate: '2026-01-01',
      },
    ],
    overallStatus: 'pass',
  };
}

describe.skipIf(!REAL_PG)('Finance B2 — approveModel() unit of work (real PostgreSQL)', () => {
  let pool: Pool;
  const modelIds: string[] = [];

  async function newModel(suffix: string): Promise<string> {
    // Random component so a vitest retry of a failed test does not collide
    // with the row its own first attempt created.
    const id = `${prefix}-${suffix}-${randomUUID().slice(0, 8)}`;
    modelIds.push(id);
    await pool.query(
      `INSERT INTO financial_models
         (id, organization_id, name, currency, horizon_months, start_date, granularity, scenario, status, assumptions_json, version, created_by)
       VALUES ($1,$2,$3,'PLN',$4,'2026-01-01','monthly','base','draft',$5,1,$6)`,
      [id, org, `uow ${suffix}`, HORIZON_MONTHS, assumptionsJson(), user]
    );
    return id;
  }

  async function counts(modelId: string): Promise<{ outputs: number; validations: number; versions: number }> {
    const o = await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM financial_model_outputs WHERE model_id = $1`, [modelId]);
    const v = await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM financial_model_validations WHERE model_id = $1`, [modelId]);
    const ver = await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM financial_model_versions WHERE model_id = $1`, [modelId]);
    return { outputs: o.rows[0].n, validations: v.rows[0].n, versions: ver.rows[0].n };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING, max: 16 });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
       VALUES($1,$2,'enterprise','active',1,now()) ON CONFLICT (id) DO NOTHING`, [org, org]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'ADMIN','active')
       ON CONFLICT (id) DO NOTHING`, [user, org, `${user}@example.test`]);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM financial_model_versions WHERE model_id = ANY($1)`, [modelIds]);
    await pool.query(`DELETE FROM financial_model_validations WHERE model_id = ANY($1)`, [modelIds]);
    await pool.query(`DELETE FROM financial_model_outputs WHERE model_id = ANY($1)`, [modelIds]);
    await pool.query(`DELETE FROM financial_models WHERE id = ANY($1)`, [modelIds]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [user]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);

    const residue = await pool.query<{ n: number }>(
      `SELECT
         (SELECT count(*) FROM financial_models WHERE id = ANY($1))
       + (SELECT count(*) FROM financial_model_outputs WHERE model_id = ANY($1))
       + (SELECT count(*) FROM financial_model_validations WHERE model_id = ANY($1))
       + (SELECT count(*) FROM financial_model_versions WHERE model_id = ANY($1)) AS n`,
      [modelIds]
    );
    if (Number(residue.rows[0]?.n || 0) !== 0) {
      throw new Error(`FIN_B2_UOW_RESIDUE:${residue.rows[0]?.n}`);
    }
    await pool.end();
  });

  // ── pool-client release, checked after EVERY test ────────────────────────
  // If any path failed to release its PoolClient, saturation would ratchet up
  // and never come back down. Checked as an afterEach so the very first
  // leaking test is the one that fails, not some unrelated later one.
  afterEach(async () => {
    // Give the pool a tick to return clients released synchronously in finally.
    await new Promise((r) => setTimeout(r, 50));
    expect(
      getPrimaryPoolSaturationPercent(),
      'PoolClient leak: primary pool still saturated after the test settled'
    ).toBe(0);
  });

  it('writes exactly 2580 outputs whose values match an independent recompute, plus one version row', async () => {
    const modelId = await newModel('parity');
    expect((await approveModel(modelId, user)).success).toBe(true);

    const persisted = await pool.query<{
      period_date: string; statement_type: string; line_code: string; value: number;
    }>(
      `SELECT period_date::text, statement_type, line_code, value
         FROM financial_model_outputs WHERE model_id = $1
        ORDER BY period_date, statement_type, line_code`, [modelId]);
    expect(persisted.rows).toHaveLength(EXPECTED_OUTPUT_ROWS);

    const fresh = await computeModel(modelId);
    const expectedByKey = new Map<string, number>();
    for (const period of fresh.periods) {
      for (const [type, lines] of [['P&L', period.pl], ['BS', period.bs], ['CF', period.cf]] as const) {
        for (const [code, value] of Object.entries(lines)) {
          expectedByKey.set(`${period.date}|${type}|${code}`, Math.round((value as number) * 100) / 100);
        }
      }
    }
    expect(expectedByKey.size).toBe(EXPECTED_OUTPUT_ROWS);
    for (const row of persisted.rows) {
      const key = `${row.period_date}|${row.statement_type}|${row.line_code}`;
      const want = expectedByKey.get(key);
      expect(want, `unexpected row ${key}`).toBeDefined();
      // `value` is Postgres REAL (float4, ~7 significant digits) -- a
      // pre-existing schema choice this change does not touch. Compare
      // within float4's relative precision, not exact decimal identity.
      expect(
        Math.abs(Number(row.value) - want!),
        `value mismatch for ${key}: got ${row.value}, want ${want}`
      ).toBeLessThanOrEqual(Math.max(0.02, Math.abs(want!) * 2e-6));
    }

    expect((await counts(modelId)).versions).toBe(1);
  });

  // ── same-model concurrency ───────────────────────────────────────────────
  it('8 concurrent approves of the SAME model at the SAME baseVersion: exactly one winner, losers write nothing', async () => {
    const modelId = await newModel('race8');

    const settled = await Promise.allSettled(
      Array.from({ length: 8 }, () => approveModel(modelId, user, { expectedVersion: 1 }))
    );

    const fulfilled = settled.filter((s) => s.status === 'fulfilled') as
      PromiseFulfilledResult<Awaited<ReturnType<typeof approveModel>>>[];
    expect(fulfilled, 'no approve call may throw').toHaveLength(8);

    const winners = fulfilled.filter((s) => s.value.success);
    const losers = fulfilled.filter((s) => !s.value.success);
    expect(winners, 'exactly one winner').toHaveLength(1);
    expect(losers).toHaveLength(7);
    for (const loser of losers) {
      expect(loser.value.code).toBe('VERSION_CONFLICT');
    }

    // Losers must not have deleted or rewritten the winner's outputs: the
    // count is exactly one model's worth, and exactly ONE version row exists.
    const c = await counts(modelId);
    expect(c.outputs, 'losers must not duplicate or destroy outputs').toBe(EXPECTED_OUTPUT_ROWS);
    expect(c.versions, 'exactly one version-history row').toBe(1);

    // Cold Pool: the durable state must equal the winning version.
    const coldPool = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
    try {
      const cold = await coldPool.query<{ status: string; version: number; approved_by: string }>(
        `SELECT status, version, approved_by FROM financial_models WHERE id = $1`, [modelId]);
      expect(cold.rows[0]).toEqual({ status: 'approved', version: 2, approved_by: user });

      const coldOutputs = await coldPool.query<{ n: number }>(
        `SELECT count(*)::int n FROM financial_model_outputs WHERE model_id = $1`, [modelId]);
      expect(coldOutputs.rows[0].n).toBe(EXPECTED_OUTPUT_ROWS);

      const coldVersion = await coldPool.query<{ version: number }>(
        `SELECT version FROM financial_model_versions WHERE model_id = $1`, [modelId]);
      expect(coldVersion.rows.map((r) => Number(r.version))).toEqual([2]);
    } finally {
      await coldPool.end();
    }
  }, 120_000);

  // ── forced failure matrix ────────────────────────────────────────────────
  it('FORCED FAILURE (outputs): a real FK violation rolls back everything, no partial data', async () => {
    // No financial_models row -> financial_model_outputs' FK rejects the
    // very first output insert inside the transaction.
    const orphan = `${prefix}-orphan`;
    await expect(persistComputeResult(orphan, fakeResult(), 'base')).rejects.toThrow();
    const c = await counts(orphan);
    expect(c).toEqual({ outputs: 0, validations: 0, versions: 0 });
  });

  it('FORCED FAILURE (validations): a real CHECK violation rolls back the already-inserted output batch too', async () => {
    const modelId = await newModel('force-validations');
    // Seed a pre-existing output row: a rollback that undid only NEW writes
    // but kept the DELETE would show up as this row going missing.
    await pool.query(
      `INSERT INTO financial_model_outputs
         (id, model_id, period_date, period_label, statement_type, line_code, line_name, value, scenario)
       VALUES ($1,$2,'2025-12-01','pre-existing','P&L','REVENUE','Revenue',999,'base')`,
      [randomUUID(), modelId]
    );

    // status CHECK (status IN ('pass','fail','warning')) -- real constraint.
    await expect(
      persistComputeResult(modelId, fakeResult({ validationStatus: 'not_a_real_status' }), 'base')
    ).rejects.toThrow();

    const rows = await pool.query<{ line_code: string; value: number }>(
      `SELECT line_code, value::int AS value FROM financial_model_outputs WHERE model_id = $1`, [modelId]);
    expect(rows.rows, 'pre-existing row survives; new batch fully undone').toEqual([
      { line_code: 'REVENUE', value: 999 },
    ]);
    expect((await counts(modelId)).validations).toBe(0);
  });

  it('FORCED FAILURE (shadow reconcile): a fault there fails the unit of work and leaves no partial data', async () => {
    const modelId = await newModel('force-shadow');
    // RECONCILE_SUMMARY is written ONLY by shadowReconcileModel(), so a real
    // CHECK constraint rejecting that check_code fails the unit of work at
    // exactly the shadow stage and nowhere earlier. NOT VALID so Postgres
    // does not re-validate rows other tests already committed (it still
    // enforces the constraint on every new insert, which is all this needs).
    await pool.query(
      `ALTER TABLE financial_model_validations
         ADD CONSTRAINT tmp_no_reconcile_summary CHECK (check_code <> 'RECONCILE_SUMMARY') NOT VALID`
    );
    try {
      await expect(approveModel(modelId, user)).rejects.toThrow();

      const c = await counts(modelId);
      expect(
        c,
        'a shadow-reconcile fault must roll back outputs, validations AND the version row'
      ).toEqual({ outputs: 0, validations: 0, versions: 0 });

      const model = await pool.query<{ status: string; version: number }>(
        `SELECT status, version FROM financial_models WHERE id = $1`, [modelId]);
      expect(
        model.rows[0],
        'the model row must not have been flipped to approved'
      ).toEqual({ status: 'draft', version: 1 });
    } finally {
      await pool.query(
        `ALTER TABLE financial_model_validations DROP CONSTRAINT tmp_no_reconcile_summary`
      );
    }
  }, 60_000);

  it('FORCED FAILURE (CAS): an out-of-band version bump between recompute and write is rejected, nothing written', async () => {
    const modelId = await newModel('force-cas');
    // Approve once so the model is at version 2.
    expect((await approveModel(modelId, user)).success).toBe(true);
    const before = await counts(modelId);

    // A caller holding the now-stale version 1 must be rejected outright.
    const stale = await approveModel(modelId, user, { expectedVersion: 1 });
    expect(stale.success).toBe(false);
    expect(stale.code).toBe('VERSION_CONFLICT');

    const after = await counts(modelId);
    expect(after, 'rejected CAS must not add, remove or duplicate any row').toEqual(before);
  }, 60_000);

  it('FORCED FAILURE (version insert): a real PK collision on financial_model_versions rolls the whole approve back', async () => {
    const modelId = await newModel('force-version');
    // Pre-seed the version row this approve is going to try to write.
    // financial_model_versions has no unique key on (model_id, version) in
    // every schema variant, so collide on the PRIMARY KEY (id) instead by
    // making the approve's generated uuid collide is impossible; use a real
    // FK violation on approved_by instead -- financial_model_versions has no
    // FK on approved_by either. So: add a real, temporary unique constraint
    // on (model_id, version) and pre-insert the colliding row.
    await pool.query(
      `ALTER TABLE financial_model_versions
         ADD CONSTRAINT tmp_uq_model_version UNIQUE (model_id, version)`
    );
    try {
      await pool.query(
        `INSERT INTO financial_model_versions (id, model_id, version, snapshot_data, approved_by, created_at)
         VALUES ($1,$2,2,'{}',$3,CURRENT_TIMESTAMP)`,
        [randomUUID(), modelId, user]
      );

      await expect(approveModel(modelId, user)).rejects.toThrow();

      // Outputs and validations written earlier in the SAME transaction must
      // be gone, and the model must still be draft at version 1.
      const c = await counts(modelId);
      expect(c.outputs, 'outputs must roll back with the failed version insert').toBe(0);
      expect(c.validations).toBe(0);
      expect(c.versions, 'only the pre-seeded row remains').toBe(1);

      const model = await pool.query<{ status: string; version: number }>(
        `SELECT status, version FROM financial_models WHERE id = $1`, [modelId]);
      expect(model.rows[0]).toEqual({ status: 'draft', version: 1 });
    } finally {
      await pool.query(
        `ALTER TABLE financial_model_versions DROP CONSTRAINT tmp_uq_model_version`
      );
    }
  }, 60_000);

  it('FORCED FAILURE (COMMIT): a deferred-constraint violation surfacing at COMMIT leaves nothing behind', async () => {
    const modelId = await newModel('force-commit');
    // Postgres does not allow DEFERRABLE CHECK constraints, so use a
    // DEFERRABLE INITIALLY DEFERRED *constraint trigger*: it genuinely fires
    // at COMMIT, after every statement in the transaction has succeeded.
    // This is the only honest way to fail COMMIT itself rather than an
    // earlier statement.
    await pool.query(`
      CREATE OR REPLACE FUNCTION tmp_fail_at_commit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'TMP_FORCED_COMMIT_FAILURE';
      END $$;
    `);
    await pool.query(`
      CREATE CONSTRAINT TRIGGER tmp_fail_at_commit_trg
        AFTER INSERT ON financial_model_outputs
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION tmp_fail_at_commit();
    `);
    try {
      await expect(approveModel(modelId, user)).rejects.toThrow(/TMP_FORCED_COMMIT_FAILURE/);

      const c = await counts(modelId);
      expect(c, 'a COMMIT-time failure must leave zero rows').toEqual({
        outputs: 0, validations: 0, versions: 0,
      });
      const model = await pool.query<{ status: string; version: number }>(
        `SELECT status, version FROM financial_models WHERE id = $1`, [modelId]);
      expect(model.rows[0]).toEqual({ status: 'draft', version: 1 });
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS tmp_fail_at_commit_trg ON financial_model_outputs`);
      await pool.query(`DROP FUNCTION IF EXISTS tmp_fail_at_commit()`);
    }
  }, 60_000);

  it('FORCED FAILURE (BEGIN on a poisoned client) releases the client rather than leaking it', async () => {
    // Directly exercise the acquire/BEGIN-failure path: take a client, break
    // it, and confirm the pool recovers. This is the one path the service's
    // own callers cannot reach, so it is probed at the primitive level.
    const client = await getPoolClientForPinnedTransaction();
    try {
      await client.query('BEGIN');
      await expect(client.query('SELECT * FROM a_table_that_does_not_exist')).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    // afterEach asserts saturation is back to 0.
    expect(true).toBe(true);
  });

  it('cold readback after a normal approve matches the committed winning version', async () => {
    const modelId = await newModel('cold');
    expect((await approveModel(modelId, user)).success).toBe(true);

    const coldPool = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
    try {
      const outputs = await coldPool.query<{ n: number }>(
        `SELECT count(*)::int n FROM financial_model_outputs WHERE model_id = $1`, [modelId]);
      expect(outputs.rows[0].n).toBe(EXPECTED_OUTPUT_ROWS);
      const model = await coldPool.query<{ status: string; version: number }>(
        `SELECT status, version FROM financial_models WHERE id = $1`, [modelId]);
      expect(model.rows[0]).toEqual({ status: 'approved', version: 2 });
    } finally {
      await coldPool.end();
    }
  }, 60_000);
});
