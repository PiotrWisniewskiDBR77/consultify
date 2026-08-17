/**
 * Results writer observability ledger proved against a REAL PostgreSQL
 * (migration 20261014).
 *
 * A mocked DB cannot prove any of the guarantees this suite exists for:
 *  - TENANT-SCOPED dedupe depends on a real unique index over
 *    (organization_id, correlation_id, writer_family, operation). The earlier,
 *    tenant-blind key silently collapsed a second tenant's identically
 *    correlated observation — the exact defect regressed against here;
 *  - concurrency safety depends on real concurrent transactions racing that
 *    index, not on a mock's call ordering;
 *  - append-only immutability depends on the real BEFORE UPDATE / BEFORE DELETE
 *    triggers;
 *  - fail-open-on-telemetry-failure depends on a real constraint violation (a
 *    mock returning a fabricated error proves only that the mock was configured
 *    to fail).
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   RESULTS_WRITER_OBS_TEST_CLEANUP=i-own-this-disposable-database \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/consultify_wobs_<something> \
 *   npx vitest run --retry=0 \
 *     server/src/services/results/__tests__/resultsWriterObservation.pg.test.ts
 *
 * FIXTURE SAFETY — WHY THE GUARDS BELOW ARE NOT CEREMONY
 * This ledger is append-only: its DELETE trigger must be disabled for teardown
 * to remove anything. A suite able to do that must never be able to run against
 * a shared or real database. So teardown requires ALL of:
 *   1. an explicit opt-in env value (no default, no inference),
 *   2. a caller-side database-name prefix check,
 *   3. a SERVER-side `current_database()` prefix assertion (the connection
 *      string can lie; the server cannot),
 *   4. a transaction-scoped advisory lock, so two concurrent runs cannot
 *      interleave a trigger disable with each other's writes,
 *   5. deletion of EXACT observation ids captured during this run — never a
 *      `LIKE` sweep, never an unqualified DELETE,
 *   6. no swallowed errors: teardown failures fail the suite instead of
 *      pretending residue0,
 *   7. a final exact residue count AND an assertion that both triggers are back
 *      to `tgenabled = 'O'`.
 *
 * Every id and organization id is unique per run (`runId`), so parallel runs and
 * repeat runs never observe each other's rows.
 */
import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Teardown must be opted into by exact value; there is no default. */
const CLEANUP_OPT_IN =
  process.env.RESULTS_WRITER_OBS_TEST_CLEANUP === 'i-own-this-disposable-database';

/** Caller-side guard: the database this suite may mutate must be named for it. */
const REQUIRED_DB_PREFIX = 'consultify_wobs';

const DELETE_TRIGGER = 'trg_results_writer_observation_no_delete';
const UPDATE_TRIGGER = 'trg_results_writer_observation_no_update';

function callerDbName(connectionString: string): string {
  try {
    return new URL(connectionString).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

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

async function hasSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT to_regclass('public.results_writer_observations') IS NOT NULL
              AND to_regclass('public.uq_results_writer_observation_tenant_correlated_op') IS NOT NULL
              AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const CALLER_DB = callerDbName(CONNECTION_STRING);
const DB_NAME_OK = CALLER_DB.startsWith(REQUIRED_DB_PREFIX);
const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasSchema(CONNECTION_STRING) : false;
const ENABLED = REACHABLE && HAS_SCHEMA && CLEANUP_OPT_IN && DB_NAME_OK;

if (!ENABLED) {
  // eslint-disable-next-line no-console
  console.warn(
    `[results writer observation suite SKIPPED — clean skip, not a pass] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, ` +
      `RESULTS_WRITER_OBS_TEST_CLEANUP=i-own-this-disposable-database, and a DATABASE_URL whose ` +
      `database name starts with "${REQUIRED_DB_PREFIX}" (this suite disables an append-only ` +
      `DELETE trigger for teardown and must never touch a shared database). ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA} ` +
      `cleanupOptIn=${CLEANUP_OPT_IN} dbNameOk=${DB_NAME_OK} db="${CALLER_DB}"`
  );
}

const suite = ENABLED ? describe.sequential : describe.skip;

/** Unique per run: no two runs (or parallel workers) share an organization id. */
const runId = randomUUID();
const orgFor = (key: string): string => `wobs-${runId}-${key}`;

/** Every observation id this run creates, for exact teardown. */
const createdObservationIds = new Set<string>();

let control: Pool;
let service: typeof import('../resultsWriterObservationService.js');

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await control.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Records ids so teardown can delete exactly what this run wrote. */
async function track(organizationId: string): Promise<void> {
  const { rows } = await control.query<{ observation_id: string }>(
    `SELECT observation_id FROM results_writer_observations WHERE organization_id = $1`,
    [organizationId]
  );
  for (const row of rows) createdObservationIds.add(row.observation_id);
}

async function countFor(organizationId: string): Promise<number> {
  const { rows } = await control.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM results_writer_observations WHERE organization_id = $1`,
    [organizationId]
  );
  return Number(rows[0]?.n ?? '0');
}

async function triggerStates(client: Pool | PoolClient): Promise<Record<string, string>> {
  const { rows } = await client.query<{ tgname: string; tgenabled: string }>(
    `SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgrelid = 'results_writer_observations'::regclass AND NOT tgisinternal
      ORDER BY tgname`
  );
  return Object.fromEntries(rows.map((r) => [r.tgname, r.tgenabled]));
}

suite('results writer observability ledger (real Postgres)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 10 });

    // Guard 3: the SERVER decides which database this is. A connection string
    // can be rewritten by a proxy or a stale env; `current_database()` cannot.
    const { rows } = await control.query<{ db: string }>(`SELECT current_database() AS db`);
    const serverDb = rows[0]?.db ?? '';
    if (!serverDb.startsWith(REQUIRED_DB_PREFIX)) {
      throw new Error(
        `refusing to run: server-side current_database()="${serverDb}" does not start with ` +
          `"${REQUIRED_DB_PREFIX}". This suite disables an append-only DELETE trigger and must ` +
          `only ever run against a disposable database.`
      );
    }

    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    service = await import('../resultsWriterObservationService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    // Deliberately NOT wrapped in a swallowing catch: a teardown that fails
    // silently would let this suite claim residue0 while leaving rows behind.
    try {
      const ids = Array.from(createdObservationIds);
      await withClient(async (client) => {
        await client.query('BEGIN');
        try {
          // Guard 4: transaction-scoped, so it is released even if we throw, and
          // two concurrent runs cannot interleave trigger toggling.
          await client.query(`SELECT pg_advisory_xact_lock(hashtext('results_writer_obs_test'))`);
          // Re-assert inside the locked transaction: the guard must hold at the
          // moment of the destructive act, not only at suite start.
          const { rows } = await client.query<{ db: string }>(`SELECT current_database() AS db`);
          if (!(rows[0]?.db ?? '').startsWith(REQUIRED_DB_PREFIX)) {
            throw new Error('database name guard failed inside teardown transaction');
          }
          if (ids.length > 0) {
            // The ledger is append-only: DELETE is blocked by design, so an
            // owner-governed purge (here: disposable-DB teardown) must disable
            // the precisely-named trigger explicitly. Scoped to this suite's
            // exact ids — never a LIKE sweep.
            await client.query(
              `ALTER TABLE results_writer_observations DISABLE TRIGGER ${DELETE_TRIGGER}`
            );
            await client.query(
              `DELETE FROM results_writer_observations WHERE observation_id = ANY($1::text[])`,
              [ids]
            );
            await client.query(
              `ALTER TABLE results_writer_observations ENABLE TRIGGER ${DELETE_TRIGGER}`
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });

      // Exact residue: none of this run's ids may survive.
      const residue = await control.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM results_writer_observations WHERE observation_id = ANY($1::text[])`,
        [ids]
      );
      if (Number(residue.rows[0]?.n ?? '0') !== 0) {
        throw new Error(`teardown left ${residue.rows[0]?.n} observation row(s) behind`);
      }

      // Trigger state O: both append-only triggers must be enabled again, or the
      // next consumer of this database inherits a silently unprotected ledger.
      const states = await triggerStates(control);
      if (states[DELETE_TRIGGER] !== 'O' || states[UPDATE_TRIGGER] !== 'O') {
        throw new Error(`append-only triggers not restored to 'O': ${JSON.stringify(states)}`);
      }
    } finally {
      await control.end();
      const { default: db } = await import('../../../database/PostgresDatabase.js');
      await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
    }
  }, 60_000);

  it('1. records one observation with tenant/actor/family/operation/endpoint/correlation and no business content', async () => {
    const org = orgFor('record');
    const result = await service.recordWriterObservation({
      organizationId: org,
      actorUserId: `${runId}-user-1`,
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: `${runId}-corr-record`,
    });
    await track(org);

    // `recorded: true` must come with the CONFIRMED id the database returned.
    expect(result.recorded).toBe(true);
    expect(result).toMatchObject({ recorded: true, deduped: false });
    expect((result as { observationId: string }).observationId).toBeTruthy();

    const { rows } = await control.query(
      `SELECT organization_id, actor_user_id, writer_family, operation, endpoint, correlation_id, created_at
         FROM results_writer_observations WHERE organization_id = $1`,
      [org]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organization_id: org,
      actor_user_id: `${runId}-user-1`,
      writer_family: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlation_id: `${runId}-corr-record`,
    });
    expect(rows[0].created_at).toBeInstanceOf(Date);

    // The table physically cannot hold business content: assert the column set,
    // so a future migration adding a payload column fails here.
    const { rows: cols } = await control.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'results_writer_observations' ORDER BY column_name`
    );
    expect(cols.map((c) => c.column_name)).toEqual([
      'actor_user_id',
      'correlation_id',
      'created_at',
      'endpoint',
      'observation_id',
      'operation',
      'organization_id',
      'writer_family',
    ]);
  });

  it('2. TENANT-SCOPED dedupe: the same correlation/family/operation in two tenants records exactly 2 rows', async () => {
    const orgA = orgFor('tenant-a');
    const orgB = orgFor('tenant-b');
    const shared = `${runId}-corr-cross-tenant`;
    const common = {
      writerFamily: 'vnext_kpi' as const,
      operation: 'recordMeasurement',
      endpoint: 'POST /api/vnext/results/kpi/:kpiId/measurements',
      correlationId: shared,
    };

    const a = await service.recordWriterObservation({ organizationId: orgA, ...common });
    const b = await service.recordWriterObservation({ organizationId: orgB, ...common });
    await track(orgA);
    await track(orgB);

    // REGRESSION GUARD: under the pre-corrective tenant-blind key, org B's
    // observation was silently swallowed as a "dedupe" and this was 1 row and
    // deduped:true — losing an entire tenant's usage signal.
    expect(a).toMatchObject({ recorded: true, deduped: false });
    expect(b).toMatchObject({ recorded: true, deduped: false });
    expect((a as { observationId: string }).observationId).not.toBe(
      (b as { observationId: string }).observationId
    );
    expect(await countFor(orgA)).toBe(1);
    expect(await countFor(orgB)).toBe(1);

    const { rows } = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM results_writer_observations WHERE correlation_id = $1`,
      [shared]
    );
    expect(Number(rows[0]?.n)).toBe(2);
  });

  it('3. within ONE tenant, a retry of the same correlated operation records exactly one row', async () => {
    const org = orgFor('retry');
    const input = {
      organizationId: org,
      writerFamily: 'vnext_kpi' as const,
      operation: 'recordMeasurement',
      endpoint: 'POST /api/vnext/results/kpi/:kpiId/measurements',
      correlationId: `${runId}-corr-retry`,
    };

    const first = await service.recordWriterObservation(input);
    const second = await service.recordWriterObservation(input);
    await track(org);

    expect(first).toMatchObject({ recorded: true, deduped: false });
    // The retry is reported as a dedupe, not as a fresh record — the difference
    // between "one real use" and a double-counted statistic. Its confirmed id
    // must be the id of the row already present.
    expect(second).toMatchObject({ recorded: true, deduped: true });
    expect((second as { observationId: string }).observationId).toBe(
      (first as { observationId: string }).observationId
    );
    expect(await countFor(org)).toBe(1);
  });

  it('4. the same correlation id under a different family/operation stays distinct', async () => {
    const org = orgFor('distinct');
    const shared = `${runId}-corr-shared-op`;

    for (const [family, operation, endpoint] of [
      ['legacy_kpi_crud', 'recordMeasurement', 'POST /api/benefits/kpis/:kpiId/time-series'],
      ['kpi_reports', 'createSnapshot', 'POST /api/results/kpi-reports'],
      ['kpi_reports', 'refreshSnapshot', 'POST /api/results/kpi-reports/:snapshotId/refresh'],
    ] as const) {
      const outcome = await service.recordWriterObservation({
        organizationId: org,
        writerFamily: family,
        operation,
        endpoint,
        correlationId: shared,
      });
      expect(outcome).toMatchObject({ recorded: true, deduped: false });
    }
    await track(org);

    // One request can legitimately drive several distinct writer operations; the
    // key is (tenant, correlation, family, operation), not correlation alone.
    expect(await countFor(org)).toBe(3);
  });

  it('5. 8-way concurrent retry of one key in one tenant still yields exactly one row', async () => {
    const org = orgFor('concurrency');
    const input = {
      organizationId: org,
      writerFamily: 'results_finance' as const,
      operation: 'pullAndReconcile',
      endpoint: 'POST /api/v8/results/reconciliations/pull',
      correlationId: `${runId}-corr-concurrent`,
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.recordWriterObservation(input))
    );
    await track(org);

    // Every attempt reports success (fail-open, nothing thrown), and the real
    // unique index — not application-level ordering — collapses them.
    expect(results.every((r) => r.recorded)).toBe(true);
    expect(results.filter((r) => r.recorded && !r.deduped)).toHaveLength(1);
    expect(await countFor(org)).toBe(1);

    // All eight confirmed ids point at the same single row.
    const ids = new Set(results.map((r) => (r as { observationId?: string }).observationId));
    expect(ids.size).toBe(1);
  });

  it('6. INVOCATION semantics: a replay under a NEW correlation id is counted again', async () => {
    const org = orgFor('replay');
    const base = {
      organizationId: org,
      writerFamily: 'legacy_kpi_crud' as const,
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
    };

    await service.recordWriterObservation({ ...base, correlationId: `${runId}-replay-1` });
    await service.recordWriterObservation({ ...base, correlationId: `${runId}-replay-2` });
    await track(org);

    // This is the ledger's TRUE semantics, asserted rather than assumed: it
    // counts handler INVOCATIONS, not unique business mutations. A client that
    // replays the same logical intent with a fresh correlation id is counted
    // twice, because the ledger cannot know the two calls meant one intent.
    // Consumers must not read this number as "distinct rows written".
    expect(await countFor(org)).toBe(2);
  });

  it('7. append-only: UPDATE is rejected by the database', async () => {
    const org = orgFor('immutable-update');
    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'execution_results',
      operation: 'closureHandoff',
      endpoint: 'service:closureDeliveryReceiptService.deliver#results',
      correlationId: `${runId}-corr-immutable-update`,
    });
    await track(org);

    await expect(
      control.query(
        `UPDATE results_writer_observations SET operation = 'tampered' WHERE organization_id = $1`,
        [org]
      )
    ).rejects.toThrow(/append-only/i);

    const { rows } = await control.query<{ operation: string }>(
      `SELECT operation FROM results_writer_observations WHERE organization_id = $1`,
      [org]
    );
    expect(rows.map((r) => r.operation)).toEqual(['closureHandoff']);
  });

  it('8. append-only: DELETE is rejected too, so the term is literal', async () => {
    const org = orgFor('immutable-delete');
    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'execution_results',
      operation: 'budgetHealthExport',
      endpoint: 'service:executionBudgetService.createBudgetEntry',
      correlationId: `${runId}-corr-immutable-delete`,
    });
    await track(org);

    await expect(
      control.query(`DELETE FROM results_writer_observations WHERE organization_id = $1`, [org])
    ).rejects.toThrow(/append-only/i);

    expect(await countFor(org)).toBe(1);
  });

  it('9. a telemetry write failure is fail-open, reported structurally, and never thrown at the business path', async () => {
    // A real constraint violation, not a mocked rejection: writer_family is
    // CHECK-constrained, so an unknown family is rejected by Postgres itself.
    const org = orgFor('failopen');
    const outcome = await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'not_a_real_family' as never,
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: `${runId}-corr-failopen`,
    });

    // Resolved (never rejected) so a `void`-ing caller cannot be turned into a
    // 500 on an already-successful business write, and never `recorded: true`
    // for a write the database refused.
    expect(outcome).toEqual({ recorded: false, errorCode: 'WRITER_OBS_WRITE_FAILED' });
    expect(await countFor(org)).toBe(0);

    // The fire-and-forget wrapper must not throw synchronously either.
    expect(() =>
      service.observeWriter({
        organizationId: org,
        writerFamily: 'not_a_real_family' as never,
        operation: 'createKpi',
        endpoint: 'POST /api/benefits/kpis',
        correlationId: `${runId}-corr-failopen-2`,
      })
    ).not.toThrow();
  });

  it('10. a missing correlation id is minted so the NOT NULL column holds', async () => {
    const org = orgFor('nocorr');
    const outcome = await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'execution_results',
      operation: 'budgetHealthExport',
      endpoint: 'service:executionBudgetService.deleteBudgetEntry',
      // No correlationId: the non-request writers legitimately have none.
    });
    await track(org);
    expect(outcome).toMatchObject({ recorded: true, deduped: false });

    const { rows } = await control.query<{ correlation_id: string }>(
      `SELECT correlation_id FROM results_writer_observations WHERE organization_id = $1`,
      [org]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('11. tenant isolation: a per-tenant read never returns another tenant’s observations', async () => {
    const orgA = orgFor('iso-a');
    const orgB = orgFor('iso-b');

    await service.recordWriterObservation({
      organizationId: orgA,
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: `${runId}-corr-iso-a`,
    });
    await service.recordWriterObservation({
      organizationId: orgB,
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: `${runId}-corr-iso-b`,
    });
    await track(orgA);
    await track(orgB);

    const { rows } = await control.query<{ correlation_id: string }>(
      `SELECT correlation_id FROM results_writer_observations WHERE organization_id = $1`,
      [orgA]
    );
    expect(rows.map((r) => r.correlation_id)).toEqual([`${runId}-corr-iso-a`]);
    expect(await countFor(orgB)).toBe(1);
  });

  it('12. a COLD pool connection reads back exactly this run’s observations', async () => {
    const cold = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    try {
      // Exact ids, not a prefix sweep: proves read-after-write across a brand new
      // connection without depending on any other run's data.
      const ids = Array.from(createdObservationIds);
      const { rows } = await cold.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM results_writer_observations WHERE observation_id = ANY($1::text[])`,
        [ids]
      );
      expect(Number(rows[0]?.n)).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(0);
    } finally {
      await cold.end();
    }
  });

  it('13. both append-only triggers are enabled (tgenabled = O) during the run', async () => {
    const states = await triggerStates(control);
    expect(states[UPDATE_TRIGGER]).toBe('O');
    expect(states[DELETE_TRIGGER]).toBe('O');
  });
});
