/**
 * KPI-E003 — deviation-case idempotency, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §A/§B — case key =
 * (organization_id, kpi_id), at most one non-closed DeviationCase per KPI,
 * enforced by a DB-level partial unique index
 * (`ux_rvn_kpi_deviation_cases_one_active_per_kpi`), not just an application
 * check. This file proves that invariant against the real thing, through
 * the real command layer (`recordMeasurement` -> `openOrEscalateDeviationCase`,
 * same transaction, decision #3) — not a mock.
 *
 * SKIP POLICY (same convention as tests/integration/*.realdb.test.ts): if no
 * database is configured (no DATABASE_URL/DB_HOST), every scenario below is
 * a silent no-op and this file reports green — that is expected in
 * environments without a Postgres available (e.g. a default CI/sandbox run)
 * and is NOT evidence the behavior works. If a database IS configured but
 * unreachable, `beforeAll` throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (server/migrations/
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql,
 * 20260811_rvn_kpi_deviation_loop.sql, 20260811_rvn_platform_obligations.sql)
 * before importing this file — env vars are read once, at
 * `server/src/config/DatabaseConfig.ts`'s module-load time, so they must be
 * set before ANY transitive import of it (this file sets them at the very
 * top, before its own dynamic `await import(...)` calls, same pattern as
 * `tests/integration/m02c-notebook-legacy-conflict.realdb.test.ts`).
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `kpi-e003-it-org-${tag}`;
const OWNER_USER_ID = `kpi-e003-it-owner-${tag}`;

let client: Client;
let reachable = false;

// Dynamic imports (populated in beforeAll, AFTER env vars are confirmed set)
// so PostgresDatabase.ts's module-level config resolution sees them.
type CommandsModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');
let recordMeasurement: CommandsModule['recordMeasurement'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertFixtureKpi(kpiId: string, definitionVersionId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $5)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, OWNER_USER_ID, OWNER_USER_ID]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, target_geometry,
        target_value, warning_low, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'IT fixture KPI', 'threshold_min', 100, 50, 'approved', $4, now())`,
    [definitionVersionId, kpiId, ORG_ID, OWNER_USER_ID]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    definitionVersionId,
    kpiId,
  ]);
}

async function activeCaseCount(kpiId: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
    [ORG_ID, kpiId]
  );
  return Number(result.rows[0]?.count ?? '0');
}

describe('KPI-E003 — deviation-case idempotency (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — KPI-E003 deviation-case idempotency tests did NOT run. ' +
          'This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      // Confirm the schema this file depends on is actually present —
      // fail loudly with a clear message rather than a confusing 42P01
      // mid-test if someone points this at a DB without the migrations
      // applied.
      await client.query('SELECT 1 FROM rvn_kpi_deviation_cases LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E003 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js'
    );
    recordMeasurement = commands.recordMeasurement;
    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_effectiveness_verification_measurements
                          WHERE verification_id IN (
                            SELECT verification_id FROM rvn_kpi_effectiveness_verifications
                             WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_effectiveness_verifications WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_corrective_actions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (
                          SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    // Null the forward-reference before deleting versions — rvn_kpi_definitions
    // .current_definition_version_id -> rvn_kpi_definition_versions (the
    // circular-FK resolution 20260810_rvn_kpi_core.sql's ALTER TABLE adds).
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'SEQUENTIAL: a warning measurement opens exactly one case; a subsequent critical measurement escalates severity on the SAME case, not a second one',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId);

      const first = await recordMeasurement({
        kpiId,
        definitionVersionId: versionId,
        organizationId: ORG_ID,
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-31T00:00:00.000Z',
        actualValue: 50,
        performanceStatus: 'warning',
        source: 'manual',
        recordedBy: OWNER_USER_ID,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `it-first-${kpiId}`,
      });
      expect(first.outcome).toBe('applied');
      expect(await activeCaseCount(kpiId)).toBe(1);

      const caseAfterFirst = await client.query<{ case_id: string; severity: string }>(
        `SELECT case_id, severity FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [ORG_ID, kpiId]
      );
      const originalCaseId = caseAfterFirst.rows[0]?.case_id;
      expect(caseAfterFirst.rows[0]?.severity).toBe('warning');

      const second = await recordMeasurement({
        kpiId,
        definitionVersionId: versionId,
        organizationId: ORG_ID,
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-28T00:00:00.000Z',
        actualValue: 10,
        performanceStatus: 'critical',
        source: 'manual',
        recordedBy: OWNER_USER_ID,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `it-second-${kpiId}`,
      });
      expect(second.outcome).toBe('applied');

      // Still exactly ONE open case — severity escalated on it, no second
      // case spawned.
      expect(await activeCaseCount(kpiId)).toBe(1);
      const caseAfterSecond = await client.query<{ case_id: string; severity: string }>(
        `SELECT case_id, severity FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [ORG_ID, kpiId]
      );
      expect(caseAfterSecond.rows[0]?.case_id).toBe(originalCaseId);
      expect(caseAfterSecond.rows[0]?.severity).toBe('critical');

      // Both the opened and the escalated event landed as their OWN
      // rvn_platform_events rows (decision #4).
      const events = await client.query<{ event_type: string }>(
        `SELECT event_type FROM rvn_platform_events WHERE organization_id = $1 AND aggregate_id = $2 ORDER BY sequence ASC`,
        [ORG_ID, originalCaseId]
      );
      expect(events.rows.map((r) => r.event_type)).toEqual(['kpi.deviation_opened', 'kpi.deviation_escalated']);

      // The §C MyWork obligation was created exactly once, assigned to the
      // KPI's owner.
      const obligations = await client.query<{ obligation_type: string; assignee_user_id: string }>(
        `SELECT obligation_type, assignee_user_id FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'deviation_case' AND reference_id = $2`,
        [ORG_ID, originalCaseId]
      );
      expect(obligations.rows).toHaveLength(1);
      expect(obligations.rows[0]?.obligation_type).toBe('explain_warning_critical_deviation');
      expect(obligations.rows[0]?.assignee_user_id).toBe(OWNER_USER_ID);
    }
  );

  itDB(
    'CONCURRENT: two parallel critical measurements for a fresh KPI race to open a case — exactly one case survives',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId);

      // Two genuinely concurrent recordMeasurement calls, each its own
      // connection/transaction from the pool, different periods (the
      // measurements table's own period-uniqueness index requires that —
      // the invariant under test here is the DEVIATION CASE table's
      // partial unique index, not the measurement one).
      const [a, b] = await Promise.all([
        recordMeasurement({
          kpiId,
          definitionVersionId: versionId,
          organizationId: ORG_ID,
          periodStart: '2026-03-01T00:00:00.000Z',
          periodEnd: '2026-03-31T00:00:00.000Z',
          actualValue: 5,
          performanceStatus: 'critical',
          source: 'manual',
          recordedBy: OWNER_USER_ID,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `it-race-a-${kpiId}`,
        }),
        recordMeasurement({
          kpiId,
          definitionVersionId: versionId,
          organizationId: ORG_ID,
          periodStart: '2026-04-01T00:00:00.000Z',
          periodEnd: '2026-04-30T00:00:00.000Z',
          actualValue: 4,
          performanceStatus: 'critical',
          source: 'manual',
          recordedBy: OWNER_USER_ID,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `it-race-b-${kpiId}`,
        }),
      ]);

      // Neither call is allowed to throw — a losing racer must gracefully
      // discover the winner's case, never surface a raw unique-violation
      // (or the transaction-aborted follow-on error the design's literal
      // retry-without-SAVEPOINT code would have hit — see the
      // "DEVIATION FROM DESIGN" comment in kpiDeviationCommands.ts).
      expect(a.outcome).toBe('applied');
      expect(b.outcome).toBe('applied');

      expect(await activeCaseCount(kpiId)).toBe(1);

      // Exactly one kpi.deviation_opened event for this KPI's case (the
      // loser must NOT have written its own second "opened" event).
      const caseRow = await client.query<{ case_id: string }>(
        `SELECT case_id FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
        [ORG_ID, kpiId]
      );
      const caseId = caseRow.rows[0]?.case_id;
      const openedEvents = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_opened'`,
        [ORG_ID, caseId]
      );
      expect(Number(openedEvents.rows[0]?.count ?? '0')).toBe(1);

      // Exactly one obligation, not one per racer.
      const obligations = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'deviation_case' AND reference_id = $2`,
        [ORG_ID, caseId]
      );
      expect(Number(obligations.rows[0]?.count ?? '0')).toBe(1);
    }
  );

  itDB(
    'DETERMINISTIC PROOF: a losing INSERT under the partial unique index recovers via SAVEPOINT ' +
      '(negative control performed manually against this same Postgres before the fix landed: without ' +
      'the SAVEPOINT, the identical retry-SELECT below fails with 25P02 "current transaction is aborted" ' +
      '— see the "DEVIATION FROM DESIGN" comment in kpiDeviationCommands.ts for the full writeup)',
    async () => {
      // This test does not go through Promise.all — Node/pg scheduling can
      // let one recordMeasurement call fully commit before the other even
      // starts, which never exercises the actual "both transactions saw no
      // existing case, both attempt the INSERT, one blocks on the other's
      // uncommitted row" collision the partial unique index exists to
      // resolve. Two independently driven raw `pg.Client` connections give
      // full, deterministic control over that exact interleaving instead.
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId);
      const measurementId = randomUUID();
      await client.query(
        `INSERT INTO rvn_kpi_measurements
           (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
            actual_value, performance_status, source, recorded_by)
         VALUES ($1, $2, $3, $4, '2026-05-01T00:00:00.000Z', '2026-05-31T00:00:00.000Z', 1, 'critical', 'manual', $5)`,
        [measurementId, kpiId, versionId, ORG_ID, OWNER_USER_ID]
      );

      const insertCaseSql = `
        INSERT INTO rvn_kpi_deviation_cases
          (organization_id, kpi_id, trigger_measurement_id, severity, status, owner_user_id, created_by)
        VALUES ($1, $2, $3, 'critical', 'open', $4, $4)
        RETURNING case_id
      `;

      const clientA = new Client(buildClientConfig() as ClientConfig);
      const clientB = new Client(buildClientConfig() as ClientConfig);
      await clientA.connect();
      await clientB.connect();
      try {
        await clientA.query('BEGIN');
        await clientB.query('BEGIN');

        // A inserts first and does NOT commit yet.
        const insertedByA = await clientA.query<{ case_id: string }>(insertCaseSql, [
          ORG_ID,
          kpiId,
          measurementId,
          OWNER_USER_ID,
        ]);
        const winningCaseId = insertedByA.rows[0]?.case_id;

        // B mirrors openOrEscalateDeviationCase's own SAVEPOINT/INSERT
        // sequence. Fired WITHOUT awaiting yet — against A's still-open,
        // conflicting row this blocks server-side until A's transaction
        // resolves (standard Postgres unique-index MVCC behavior, verified
        // manually against this same engine before this fix existed).
        await clientB.query('SAVEPOINT deviation_case_create');
        const blockedInsertB = clientB.query(insertCaseSql, [ORG_ID, kpiId, measurementId, OWNER_USER_ID]);

        // Give B's query time to actually reach the server and start
        // blocking before A commits (local loopback Postgres — generous
        // margin, not a tight race).
        await new Promise((resolve) => setTimeout(resolve, 150));

        await clientA.query('COMMIT');

        // B's blocked INSERT now unblocks and raises the unique violation.
        await expect(blockedInsertB).rejects.toMatchObject({ code: '23505' });

        // The fix: roll back to the savepoint (clears the aborted-transaction
        // state) before retrying — this is the exact sequence
        // openOrEscalateDeviationCase's catch block now runs.
        await clientB.query('ROLLBACK TO SAVEPOINT deviation_case_create');
        const retry = await clientB.query<{ case_id: string }>(
          `SELECT case_id FROM rvn_kpi_deviation_cases WHERE organization_id = $1 AND kpi_id = $2 AND status <> 'closed'`,
          [ORG_ID, kpiId]
        );
        expect(retry.rows).toHaveLength(1);
        expect(retry.rows[0]?.case_id).toBe(winningCaseId);
        await clientB.query('COMMIT');

        expect(await activeCaseCount(kpiId)).toBe(1);
      } finally {
        await clientA.end();
        await clientB.end();
      }
    }
  );
});
