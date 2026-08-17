/**
 * Results writer observability ledger proved against a REAL PostgreSQL
 * (migration 20261014).
 *
 * A mocked DB cannot prove any of the four guarantees this suite exists for:
 *  - retry dedupe depends on a REAL unique index rejecting the second insert
 *    under real MVCC (`uq_results_writer_observation_correlated_op`),
 *  - concurrency safety depends on real concurrent transactions racing that
 *    index, not on a mock's call ordering,
 *  - append-only immutability depends on the real BEFORE UPDATE trigger,
 *  - fail-open-on-telemetry-failure depends on a real constraint violation
 *    (a mock returning a fabricated error proves only that the mock was
 *    configured to fail).
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@127.0.0.1:<port>/<db> \
 *   npx vitest run --retry=0 \
 *     server/src/services/results/__tests__/resultsWriterObservation.pg.test.ts
 *
 * The target database must have 20261014_results_writer_observability_ledger.sql
 * applied. Without a reachable, migrated Postgres the suite SKIPS loudly rather
 * than passing vacuously.
 *
 * TENANCY: every test owns its own organization id (`orgFor(key)`) and every
 * row this suite writes is deleted in afterAll, so residue is provable.
 */
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

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
              AND to_regclass('public.uq_results_writer_observation_correlated_op') IS NOT NULL
              AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasSchema(CONNECTION_STRING) : false;

if (!REACHABLE || !HAS_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[results writer observation suite SKIPPED — clean skip, not a pass] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ` +
      `DATABASE_URL=<reachable postgres with 20261014 applied>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'reswriterobs';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

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

async function countFor(organizationId: string): Promise<number> {
  const { rows } = await control.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM results_writer_observations WHERE organization_id = $1`,
    [organizationId]
  );
  return Number(rows[0]?.n ?? '0');
}

suite('results writer observability ledger (real Postgres)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    service = await import('../resultsWriterObservationService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    // Residue: this suite deletes exactly what it wrote. Counted (not assumed)
    // in the final test below.
    await control
      .query(`DELETE FROM results_writer_observations WHERE organization_id LIKE $1`, [
        `${ORG_PREFIX}-%`,
      ])
      .catch(() => undefined);
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it('1. records one observation carrying tenant/actor/family/operation/endpoint/correlation and no business content', async () => {
    const org = orgFor('record');
    const result = await service.recordWriterObservation({
      organizationId: org,
      actorUserId: 'user-1',
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: 'corr-record-1',
    });

    expect(result).toEqual({ recorded: true, deduped: false });

    const { rows } = await control.query(
      `SELECT organization_id, actor_user_id, writer_family, operation, endpoint,
              correlation_id, created_at
         FROM results_writer_observations WHERE organization_id = $1`,
      [org]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organization_id: org,
      actor_user_id: 'user-1',
      writer_family: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlation_id: 'corr-record-1',
    });
    expect(rows[0].created_at).toBeInstanceOf(Date);

    // The table physically cannot hold business content: assert the column set
    // itself, so a future migration that adds a payload column fails here.
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

  it('2. a retry of the same correlated operation records exactly one row (dedupe, reported honestly)', async () => {
    const org = orgFor('retry');
    const input = {
      organizationId: org,
      actorUserId: 'user-1',
      writerFamily: 'vnext_kpi' as const,
      operation: 'recordMeasurement',
      endpoint: 'POST /api/vnext/results/kpi/:kpiId/measurements',
      correlationId: 'corr-retry-1',
    };

    const first = await service.recordWriterObservation(input);
    const second = await service.recordWriterObservation(input);

    expect(first).toEqual({ recorded: true, deduped: false });
    // The retry must NOT be reported as a fresh record — that is the difference
    // between "one real use" and a double-counted usage statistic.
    expect(second).toEqual({ recorded: true, deduped: true });
    expect(await countFor(org)).toBe(1);
  });

  it('3. the SAME correlation id under a different family/operation is a distinct observation', async () => {
    const org = orgFor('distinct');
    const shared = 'corr-shared-1';

    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'legacy_kpi_crud',
      operation: 'recordMeasurement',
      endpoint: 'POST /api/benefits/kpis/:kpiId/time-series',
      correlationId: shared,
    });
    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'kpi_reports',
      operation: 'createSnapshot',
      endpoint: 'POST /api/results/kpi-reports',
      correlationId: shared,
    });
    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'kpi_reports',
      operation: 'refreshSnapshot',
      endpoint: 'POST /api/results/kpi-reports/:snapshotId/refresh',
      correlationId: shared,
    });

    // One request can legitimately drive several distinct writer operations;
    // the dedupe key is (correlation, family, operation), not correlation alone.
    expect(await countFor(org)).toBe(3);
  });

  it('4. 8-way concurrent retry of one correlated operation still yields exactly one row', async () => {
    const org = orgFor('concurrency');
    const input = {
      organizationId: org,
      writerFamily: 'results_finance' as const,
      operation: 'pullAndReconcile',
      endpoint: 'POST /api/v8/results/reconciliations/pull',
      correlationId: 'corr-concurrent-1',
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.recordWriterObservation(input))
    );

    // Every attempt must report success (fail-open, no thrown error), and the
    // real unique index — not application-level ordering — collapses them.
    expect(results.every((r) => r.recorded)).toBe(true);
    expect(results.filter((r) => r.recorded && !r.deduped)).toHaveLength(1);
    expect(await countFor(org)).toBe(1);
  });

  it('5. observations are append-only: UPDATE is rejected by the database', async () => {
    const org = orgFor('immutable');
    await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'execution_results',
      operation: 'closureHandoff',
      endpoint: 'service:closureDeliveryReceiptService.deliver#results',
      correlationId: 'corr-immutable-1',
    });

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

  it('6. a telemetry write failure is fail-open and reported structurally, never thrown at the business path', async () => {
    // A real constraint violation, not a mocked rejection: writer_family is
    // CHECK-constrained, so an unknown family is rejected by Postgres itself.
    const org = orgFor('failopen');
    const outcome = await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'not_a_real_family' as never,
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: 'corr-failopen-1',
    });

    // Resolved (never rejected) so a `void`-ing caller cannot be turned into a
    // 500 on an already-successful business write, and the failure is explicit.
    expect(outcome).toEqual({ recorded: false, errorCode: 'WRITER_OBS_WRITE_FAILED' });
    expect(await countFor(org)).toBe(0);

    // The fire-and-forget wrapper must also not throw synchronously.
    expect(() =>
      service.observeWriter({
        organizationId: org,
        writerFamily: 'not_a_real_family' as never,
        operation: 'createKpi',
        endpoint: 'POST /api/benefits/kpis',
        correlationId: 'corr-failopen-2',
      })
    ).not.toThrow();
  });

  it('7. a missing correlation id is minted, so the NOT NULL column holds and the row is still recorded', async () => {
    const org = orgFor('nocorr');
    const outcome = await service.recordWriterObservation({
      organizationId: org,
      writerFamily: 'execution_results',
      operation: 'budgetHealthExport',
      endpoint: 'service:executionBudgetService.deleteBudgetEntry',
      // No correlationId: the non-request writers legitimately have none.
    });
    expect(outcome).toEqual({ recorded: true, deduped: false });

    const { rows } = await control.query<{ correlation_id: string }>(
      `SELECT correlation_id FROM results_writer_observations WHERE organization_id = $1`,
      [org]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('8. tenant isolation: a per-tenant read never returns another tenant’s observations', async () => {
    const orgA = orgFor('tenant-a');
    const orgB = orgFor('tenant-b');

    await service.recordWriterObservation({
      organizationId: orgA,
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: 'corr-tenant-a',
    });
    await service.recordWriterObservation({
      organizationId: orgB,
      writerFamily: 'legacy_kpi_crud',
      operation: 'createKpi',
      endpoint: 'POST /api/benefits/kpis',
      correlationId: 'corr-tenant-b',
    });

    expect(await countFor(orgA)).toBe(1);
    expect(await countFor(orgB)).toBe(1);

    const { rows } = await control.query<{ correlation_id: string }>(
      `SELECT correlation_id FROM results_writer_observations WHERE organization_id = $1`,
      [orgA]
    );
    expect(rows.map((r) => r.correlation_id)).toEqual(['corr-tenant-a']);
  });

  it('9. a cold pool connection reads back every observation this suite wrote (no read-after-write loss)', async () => {
    const cold = new Pool({ connectionString: CONNECTION_STRING, max: 1 });
    try {
      const { rows } = await cold.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM results_writer_observations WHERE organization_id LIKE $1`,
        [`${ORG_PREFIX}-%`]
      );
      // 1 + 1 + 3 + 1 + 1 + 0 + 1 + 2 = 10 rows across tests 1..8.
      expect(Number(rows[0]?.n ?? '0')).toBe(10);
    } finally {
      await cold.end().catch(() => undefined);
    }
  });

  it('10. residue0: deleting this suite’s rows leaves nothing behind', async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM results_writer_observations WHERE organization_id LIKE $1`, [
        `${ORG_PREFIX}-%`,
      ]);
    });

    const { rows } = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM results_writer_observations WHERE organization_id LIKE $1`,
      [`${ORG_PREFIX}-%`]
    );
    expect(Number(rows[0]?.n ?? '0')).toBe(0);
  });
});
