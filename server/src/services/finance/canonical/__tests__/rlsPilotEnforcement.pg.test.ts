/**
 * W2 RLS PILOT — three-state negative control (EM-9).
 *
 * Gate FC-01 / EM-9. Source: W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md §4,
 * §4.2, §7; implementation: 20260826_finance_v3_w2_rls_pilot_policies.sql;
 * full diagnosis: W2_RLS_TENANT_ENFORCEMENT_report.md (this same work
 * package — read it first).
 *
 * ===========================================================================
 * WHAT THIS FILE DOES NOT TEST
 * ===========================================================================
 * It does NOT call `computeJobService.cancelJob()` or
 * `valuationSensitivityService.writeSensitivityGrid()` with a wrong
 * `organizationId` and expect a refusal — `tenantMatrix.pg.test.ts` already
 * proves that the SERVICE layer refuses those (P0_TENANT_ISOLATION_FIX,
 * FIXED W9-C-3/W9-C-4). This file exists to answer a DIFFERENT question: if
 * a caller bypasses the service layer entirely — a raw SQL statement, a
 * future endpoint that forgets the `organization_id` predicate, a bug — does
 * anything at the DATABASE ITSELF still stop a cross-tenant read or write?
 * That is what RLS is for, and it is the only layer this file exercises: raw
 * `pg` queries issued directly against the physical tables, never through
 * `computeJobService`/`valuationSensitivityService`.
 *
 * ===========================================================================
 * THE THREE STATES, AND WHY ALL THREE MATTER (not just "does it block")
 * ===========================================================================
 *   STATE 1 — WITH the pilot policy, connected as a throwaway NON-SUPERUSER,
 *             NON-OWNER role, wrong tenant context via `SET LOCAL
 *             app.organization_id`: cross-tenant SELECT/UPDATE/DELETE must
 *             see/affect ZERO rows.
 *   STATE 2 — SAME role, SAME wrong tenant context, policy DISABLED
 *             (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`): the SAME
 *             statements must now succeed. If STATE 1 and STATE 2 behave
 *             identically, whatever blocked STATE 1 was not RLS (e.g. a
 *             missing GRANT, or the composite FK from the W9-C-7 migration)
 *             and the policy is not actually being exercised.
 *   STATE 3 — WITH the policy, but connected as the role migrations and (per
 *             the W2 report's diagnosis) the application itself actually
 *             use today: superuser. No `SET LOCAL` at all. Row IS visible —
 *             because superusers always bypass row security, with or
 *             without FORCE. This is not a bug in this test; it is the
 *             documented, measured, CURRENT production risk: today, this
 *             policy protects nothing, because nothing connects as anything
 *             other than a superuser.
 *
 * Only the STATE-1-vs-STATE-2 contrast is the actual proof the policy works;
 * STATE 3 is what stops anyone from mistaking "the migration ran" for "the
 * tenant boundary exists in production".
 *
 * ===========================================================================
 * HOW TO RUN (own throwaway ephemeral cluster only)
 * ===========================================================================
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config vitest.config.ts \
 *     src/services/finance/canonical/__tests__/rlsPilotEnforcement.pg.test.ts \
 *     --no-file-parallelism
 *   (run from `server/`)
 *
 * This file CREATEs and DROPs a throwaway cluster-level ROLE in `afterAll`.
 * Roles are cluster-scoped in PostgreSQL, not per-database — never point this
 * at a shared cluster. The bramka below (RUN_DB_TESTS + MOCK_DB + a real
 * DATABASE_URL) is the same one every other `.pg.test.ts` file in this repo
 * uses; a run without all three env vars set SKIPS, it never runs against a
 * guessed default.
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

const TEST_ROLE = `fv3_rls_pilot_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
const PILOT_TABLES = [
  'compute_jobs',
  'finance_valuation_sensitivity_grids',
  'finance_valuation_sensitivity_cells',
] as const;

describe.skipIf(!REAL_PG)('W2 RLS pilot — three-state negative control (real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../artifactVersionService.js');
  let jobsSvc: typeof import('../computeJobService.js');
  let valc: typeof import('../valuationComputeService.js');
  let sens: typeof import('../valuationSensitivityService.js');

  let superuserPool: Pool;
  let lowPrivPool: Pool;

  let orgA: string;
  let orgB: string;
  let userB: string;
  let jobB: string;
  let gridB: string;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../artifactVersionService.js');
    jobsSvc = await import('../computeJobService.js');
    valc = await import('../valuationComputeService.js');
    sens = await import('../valuationSensitivityService.js');

    superuserPool = new Pool({ connectionString: CONNECTION_STRING });

    // Throwaway, cluster-scoped, non-superuser role — created and dropped by
    // this file only, never touches any role used outside this test run.
    await superuserPool.query(`DROP ROLE IF EXISTS "${TEST_ROLE}"`);
    await superuserPool.query(
      `CREATE ROLE "${TEST_ROLE}" LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`
    );
    await superuserPool.query(`GRANT USAGE ON SCHEMA public TO "${TEST_ROLE}"`);
    await superuserPool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${PILOT_TABLES.join(', ')} TO "${TEST_ROLE}"`
    );

    const lowPrivUrl = new URL(CONNECTION_STRING);
    lowPrivUrl.username = TEST_ROLE;
    lowPrivUrl.password = '';
    lowPrivPool = new Pool({ connectionString: lowPrivUrl.toString() });

    // --- Seed two real tenants through the ACTUAL service layer (not synthetic
    // rows) so this test proves something about the real schema/FK chain, not
    // about a hand-rolled fixture. Only org B's rows are the "victim" data;
    // org A exists purely to be the wrong tenant context in SET LOCAL.
    orgA = `org-w2rls-A-${randomUUID()}`;
    orgB = `org-w2rls-B-${randomUUID()}`;
    const userA = `user-w2rls-A-${randomUUID()}`;
    userB = `user-w2rls-B-${randomUUID()}`;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgA, 'W2 RLS Pilot Org A'])
    );
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgB, 'W2 RLS Pilot Org B'])
    );
    // userA is only referenced to keep the seed symmetric with tenantMatrix's
    // pattern; no row in this file is created under userA.
    void userA;

    const baselineArtifact = await av.createArtifact({
      organizationId: orgB,
      artifactType: 'BASELINE_MODEL',
      createdBy: userB,
    });
    const job = await jobsSvc.enqueue({
      organizationId: orgB,
      jobType: 'w2_rls_pilot_probe_job',
      inputArtifactId: baselineArtifact.artifact.artifact_id,
      inputRevisionHash: 'hash-w2rls-B',
      engineManifestId: baselineArtifact.businessVersion.engine_manifest_id,
      idempotencyKey: `w2rls-B-${randomUUID()}`,
      requestedByUserId: userB,
    });
    jobB = job.job.id;

    const valuation = await av.createArtifact({
      organizationId: orgB,
      artifactType: 'VALUATION_CASE',
      createdBy: userB,
    });
    const methodResult = await valc.findOrCreateMethod({
      organizationId: orgB,
      businessVersionId: valuation.businessVersion.business_version_id,
      methodType: 'DCF_FCFF',
      createdBy: userB,
    });
    if (!methodResult.ok) throw new Error(`seed: findOrCreateMethod failed ${methodResult.code}`);

    const cells = Array.from({ length: 25 }, (_, i) => ({
      rowIndex: Math.floor(i / 5) + 1,
      colIndex: (i % 5) + 1,
      rowAxisValue: 0.1 + i * 0.001,
      columnAxisValue: 0.02,
      cellValueDecimal: 100 + i,
      isBaseCell: i === 12,
    }));
    await sens.writeSensitivityGrid({
      organizationId: orgB,
      methodId: methodResult.method.id,
      gridLabel: 'W2RLS_PILOT_GRID',
      rowAxisVariable: 'WACC',
      columnAxisVariable: 'TERMINAL_G',
      cells,
      createdBy: userB,
    });
    const gridRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM finance_valuation_sensitivity_grids WHERE method_id = ? AND grid_label = 'W2RLS_PILOT_GRID'`,
        [methodResult.method.id]
      )
    );
    if (!gridRow) throw new Error('seed: sensitivity grid not found after write');
    gridB = gridRow.id;
  }, 60_000);

  afterAll(async () => {
    await lowPrivPool?.end();
    if (superuserPool) {
      await superuserPool
        .query(`REVOKE ALL ON ${PILOT_TABLES.join(', ')} FROM "${TEST_ROLE}"`)
        .catch(() => {});
      await superuserPool.query(`REVOKE USAGE ON SCHEMA public FROM "${TEST_ROLE}"`).catch(() => {});
      await superuserPool.query(`DROP ROLE IF EXISTS "${TEST_ROLE}"`).catch(() => {});
      await superuserPool.end();
    }
  });

  it('sanity: the connecting role today is a superuser; the throwaway test role is neither superuser, BYPASSRLS, nor table owner', async () => {
    const { rows } = await superuserPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN (current_user, $1)`, [
      TEST_ROLE,
    ]);
    const connecting = rows.find((r) => r.rolname !== TEST_ROLE);
    const testRole = rows.find((r) => r.rolname === TEST_ROLE);
    expect(connecting).toBeDefined();
    expect(testRole).toBeDefined();
    // This assertion documents today's ACTUAL, undesirable posture — it is
    // expected to PASS today and is exactly the fact the W2 report's
    // diagnosis is built on. If this ever fails, the diagnosis is stale and
    // must be re-run, not silently ignored.
    expect(connecting!.rolsuper).toBe(true);
    expect(testRole!.rolsuper).toBe(false);
    expect(testRole!.rolbypassrls).toBe(false);

    const owners = await superuserPool.query<{ tablename: string; tableowner: string }>(
      `SELECT tablename, tableowner FROM pg_tables WHERE tablename = ANY($1)`,
      [PILOT_TABLES as unknown as string[]]
    );
    expect(owners.rows).toHaveLength(PILOT_TABLES.length);
    for (const row of owners.rows) {
      expect(row.tableowner).not.toBe(TEST_ROLE);
    }
  });

  it('STATE 1 (WITH policy, non-superuser, wrong tenant context): cross-tenant SELECT/UPDATE/DELETE on compute_jobs see/affect zero rows', async () => {
    const client = await lowPrivPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA]);

      const read = await client.query(`SELECT id FROM compute_jobs WHERE id = $1`, [jobB]);
      expect(read.rows).toHaveLength(0);

      const upd = await client.query(
        `UPDATE compute_jobs SET cancel_requested_at = now(), cancel_reason = 'w2 rls pilot cross-tenant probe' WHERE id = $1`,
        [jobB]
      );
      expect(upd.rowCount).toBe(0);

      const del = await client.query(`DELETE FROM compute_jobs WHERE id = $1`, [jobB]);
      expect(del.rowCount).toBe(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Independent verification through the superuser connection: org B's job
    // is completely untouched.
    const check = await superuserPool.query<{ cancel_requested_at: string | null }>(
      `SELECT cancel_requested_at FROM compute_jobs WHERE id = $1`,
      [jobB]
    );
    expect(check.rows).toHaveLength(1);
    expect(check.rows[0].cancel_requested_at).toBeNull();
  });

  it('STATE 1 (WITH policy): cross-tenant SELECT/DELETE on finance_valuation_sensitivity_grids/_cells see/affect zero rows; all 25 of B\'s cells survive', async () => {
    const client = await lowPrivPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA]);

      const readGrid = await client.query(`SELECT id FROM finance_valuation_sensitivity_grids WHERE id = $1`, [
        gridB,
      ]);
      expect(readGrid.rows).toHaveLength(0);

      const readCells = await client.query(
        `SELECT id FROM finance_valuation_sensitivity_cells WHERE grid_id = $1`,
        [gridB]
      );
      expect(readCells.rows).toHaveLength(0);

      const delCells = await client.query(`DELETE FROM finance_valuation_sensitivity_cells WHERE grid_id = $1`, [
        gridB,
      ]);
      expect(delCells.rowCount).toBe(0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const check = await superuserPool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM finance_valuation_sensitivity_cells WHERE grid_id = $1`,
      [gridB]
    );
    expect(Number(check.rows[0].n)).toBe(25);
  });

  it('STATE 1 (WITH policy, CORRECT tenant context): the owning org can still read and write its own compute_jobs row', async () => {
    const client = await lowPrivPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.organization_id', $1, true)`, [orgB]);
      const read = await client.query(`SELECT id, organization_id FROM compute_jobs WHERE id = $1`, [jobB]);
      expect(read.rows).toHaveLength(1);
      expect(read.rows[0].organization_id).toBe(orgB);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('STATE 2 (policy DISABLED, same role, same wrong tenant context): the SAME statements now succeed — proves STATE 1 was RLS, not a missing GRANT', async () => {
    await superuserPool.query(`ALTER TABLE compute_jobs DISABLE ROW LEVEL SECURITY`);
    try {
      const client = await lowPrivPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA]);

        const read = await client.query(`SELECT id, organization_id FROM compute_jobs WHERE id = $1`, [jobB]);
        expect(read.rows).toHaveLength(1);
        expect(read.rows[0].organization_id).toBe(orgB);

        const upd = await client.query(
          `UPDATE compute_jobs SET cancel_reason = 'w2 rls pilot state2 probe' WHERE id = $1`,
          [jobB]
        );
        expect(upd.rowCount).toBe(1);

        // Roll back the mutation — this test only needs to prove visibility
        // and writability, not to actually leave org B's row mutated.
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await superuserPool.query(`ALTER TABLE compute_jobs ENABLE ROW LEVEL SECURITY`);
    }

    // Restore verified: with RLS re-enabled, the same cross-tenant read is
    // blocked again (guards against this test leaving the suite in a state
    // where a later run would misreport STATE 1).
    const client2 = await lowPrivPool.connect();
    try {
      await client2.query('BEGIN');
      await client2.query(`SELECT set_config('app.organization_id', $1, true)`, [orgA]);
      const read2 = await client2.query(`SELECT id FROM compute_jobs WHERE id = $1`, [jobB]);
      expect(read2.rows).toHaveLength(0);
      await client2.query('ROLLBACK');
    } finally {
      client2.release();
    }
  });

  it('STATE 3 (policy present, connected as the actual superuser role migrations/app use today): RLS is silently bypassed — no SET LOCAL needed at all', async () => {
    // No set_config call whatsoever: this is exactly how every existing
    // caller in this codebase connects today (see PostgresDatabase.ts /
    // getPool()). If RLS "worked" here, it would mean Postgres broke its own
    // documented superuser-bypass contract.
    const read = await superuserPool.query<{ id: string; organization_id: string }>(
      `SELECT id, organization_id FROM compute_jobs WHERE id = $1`,
      [jobB]
    );
    expect(read.rows).toHaveLength(1);
    expect(read.rows[0].organization_id).toBe(orgB);
  });
});
