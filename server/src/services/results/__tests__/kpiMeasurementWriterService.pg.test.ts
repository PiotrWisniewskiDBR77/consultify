/**
 * RES-003 — kpiMeasurementWriterService proved against a REAL PostgreSQL.
 *
 * A mocked DB cannot prove the dedup/idempotency guard (the ON CONFLICT
 * upsert depends on a real unique index actually rejecting/merging a
 * concurrent duplicate under real Postgres MVCC), the backfill-ordering
 * guard on current_value (depends on a real MAX(period_start) read-after-write),
 * or the RES-02 definition_version_id pin (depends on the real
 * kpi_definition_versions ledger and the composite FK on
 * initiative_kpis.current_definition_version). All three require a real
 * database honoring its own constraints.
 *
 * KPI fixtures go through RES-02's canonical `kpiDefinitionService.createDefinition`
 * — the canonical owner, not a raw INSERT into initiative_kpis — so every
 * fixture KPI has a real v1 kpi_definition_versions row and
 * current_definition_version already set, exactly like a KPI created through
 * the real API.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/results/__tests__/kpiMeasurementWriterService.pg.test.ts
 *
 * The target database must have both 20260803_res002_kpi_definition_versions.sql
 * (RES-02 — kpi_definition_versions, current_definition_version) and
 * 20260803_res003_kpi_time_series_measurement_identity.sql (RES-03 — the
 * (kpi_id, period_start, source) unique index this suite proves) applied.
 * Without a reachable, migrated Postgres the suite SKIPS loudly.
 *
 * TENANCY: every test owns its own organization id (orgFor(key)) so tests
 * never observe each other's rows and can run in any order.
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
      `SELECT to_regclass('public.ux_kpi_time_series_kpi_period_source') IS NOT NULL
              AND to_regclass('public.kpi_definition_versions') IS NOT NULL AS present`
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
    `[RES-003 kpiMeasurementWriterService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, RES-002+RES-003-migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res003-kpiwriter';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let writer: typeof import('../kpiMeasurementWriterService.js');
let kpiDefinitionService: typeof import('../kpiDefinitionService.js');

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await control.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function seedOrgAndInitiative(orgId: string, initiativeId: string): Promise<void> {
  await control.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await control.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
     ON CONFLICT (id) DO NOTHING`,
    [initiativeId, orgId]
  );
}

/** Creates a real KPI through RES-02's canonical owner — not a raw INSERT. */
async function seedKpi(
  orgId: string,
  initiativeId: string,
  extra: { measurementFrequency?: string } = {}
): Promise<string> {
  await seedOrgAndInitiative(orgId, initiativeId);
  const created = await kpiDefinitionService.createDefinition({
    organizationId: orgId,
    initiativeId,
    name: 'Test KPI',
    measurementFrequency: extra.measurementFrequency || 'MONTHLY',
  });
  return created.id;
}

suite(
  'kpiMeasurementWriterService — RES-003 canonical measurement writer (real PostgreSQL)',
  () => {
    beforeAll(async () => {
      control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
      process.env.DB_TYPE = 'postgres';
      process.env.DATABASE_URL = CONNECTION_STRING;
      writer = await import('../kpiMeasurementWriterService.js');
      kpiDefinitionService = await import('../kpiDefinitionService.js');
    }, 60_000);

    afterAll(async () => {
      if (!control) return;
      await control.end().catch(() => undefined);
      const { default: db } = await import('../../../database/PostgresDatabase.js');
      await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
    }, 60_000);

    it("1. records a fresh measurement: wasNewRow=true, row exists exactly once, pinned to the KPI's v1 definition", async () => {
      const org = orgFor('fresh');
      const kpiId = await seedKpi(org, `init-${org}`);

      const result = await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 42,
        periodStart: '2026-01-01',
        source: 'manual',
        actorUserId: 'user-1',
      });

      expect(result.wasNewRow).toBe(true);
      expect(result.value).toBe(42);
      expect(result.definitionVersionId).toBeTruthy(); // RES-02 pin resolved, not null

      const rows = await withClient((c) =>
        c.query(`SELECT value, definition_version_id FROM kpi_time_series WHERE kpi_id = $1`, [
          kpiId,
        ])
      );
      expect(rows.rowCount).toBe(1);
      expect(Number(rows.rows[0].value)).toBe(42);
      expect(rows.rows[0].definition_version_id).toBe(result.definitionVersionId);

      // The pin genuinely resolves to the KPI's own v1 version row.
      const versionRow = await withClient((c) =>
        c.query(`SELECT kpi_id, version_no FROM kpi_definition_versions WHERE id = $1`, [
          result.definitionVersionId,
        ])
      );
      expect(versionRow.rows[0].kpi_id).toBe(kpiId);
      expect(versionRow.rows[0].version_no).toBe(1);
    });

    it('2. duplicate resubmission at the same (kpi, period, source) key CORRECTS the row, not a second one', async () => {
      const org = orgFor('dup-resubmit');
      const kpiId = await seedKpi(org, `init-${org}`);

      const first = await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 10,
        periodStart: '2026-02-01',
        source: 'manual',
      });
      const second = await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 99,
        periodStart: '2026-02-01',
        source: 'manual',
      });

      expect(first.wasNewRow).toBe(true);
      expect(second.wasNewRow).toBe(false);
      expect(second.id).toBe(first.id); // corrected the SAME row, not a new one

      const rows = await withClient((c) =>
        c.query(`SELECT value FROM kpi_time_series WHERE kpi_id = $1`, [kpiId])
      );
      expect(rows.rowCount).toBe(1); // exactly one row survives — this is the core RES-003 dedup guarantee
      expect(Number(rows.rows[0].value)).toBe(99); // holds the corrected value
    });

    it('3. concurrent double-submit of the same key never produces two rows (real Postgres serializes the race)', async () => {
      const org = orgFor('concurrent');
      const kpiId = await seedKpi(org, `init-${org}`);

      const [a, b] = await Promise.all([
        writer.recordKpiMeasurement({
          organizationId: org,
          kpiId,
          value: 1,
          periodStart: '2026-03-01',
          source: 'manual',
        }),
        writer.recordKpiMeasurement({
          organizationId: org,
          kpiId,
          value: 2,
          periodStart: '2026-03-01',
          source: 'manual',
        }),
      ]);

      expect(a.id).toBe(b.id);
      const rows = await withClient((c) =>
        c.query(`SELECT count(*)::int AS n FROM kpi_time_series WHERE kpi_id = $1`, [kpiId])
      );
      expect(rows.rows[0].n).toBe(1);
    });

    it('4. a different source for the same (kpi, period) is a DISTINCT row, not merged', async () => {
      const org = orgFor('distinct-source');
      const kpiId = await seedKpi(org, `init-${org}`);

      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 5,
        periodStart: '2026-04-01',
        source: 'manual',
      });
      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 7,
        periodStart: '2026-04-01',
        source: 'connector:abc',
      });

      const rows = await withClient((c) =>
        c.query(`SELECT source, value FROM kpi_time_series WHERE kpi_id = $1 ORDER BY source`, [
          kpiId,
        ])
      );
      expect(rows.rowCount).toBe(2);
    });

    it('5. backfilling an OLDER period after a newer one does NOT overwrite current_value', async () => {
      const org = orgFor('backfill-order');
      const kpiId = await seedKpi(org, `init-${org}`);

      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 100,
        periodStart: '2026-06-01', // newer period first
        source: 'manual',
      });
      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 1, // backfilled OLDER period, deliberately a very different value
        periodStart: '2026-01-01',
        source: 'manual',
      });

      const kpi = await withClient((c) =>
        c.query(`SELECT current_value FROM initiative_kpis WHERE id = $1`, [kpiId])
      );
      expect(Number(kpi.rows[0].current_value)).toBe(100); // still the newest period's value, not the backfilled 1
    });

    it('6. a forward-dated (newest-yet) measurement DOES advance current_value', async () => {
      const org = orgFor('forward-order');
      const kpiId = await seedKpi(org, `init-${org}`);

      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 10,
        periodStart: '2026-01-01',
        source: 'manual',
      });
      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 20,
        periodStart: '2026-02-01',
        source: 'manual',
      });

      const kpi = await withClient((c) =>
        c.query(`SELECT current_value FROM initiative_kpis WHERE id = $1`, [kpiId])
      );
      expect(Number(kpi.rows[0].current_value)).toBe(20);
    });

    it('7. a correction re-pins definition_version_id to whatever is current AT CORRECTION TIME (not frozen at first write)', async () => {
      const org = orgFor('repin-on-correct');
      const kpiId = await seedKpi(org, `init-${org}`);

      const first = await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 1,
        periodStart: '2026-05-01',
        source: 'manual',
      });

      // Bump the definition to v2 via the canonical owner (CAS with expectedVersion=1).
      await kpiDefinitionService.updateDefinition({
        organizationId: org,
        kpiId,
        expectedVersion: 1,
        targetValue: 500,
      });

      const corrected = await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 2,
        periodStart: '2026-05-01',
        source: 'manual',
      });

      expect(corrected.id).toBe(first.id); // same row, corrected
      expect(corrected.definitionVersionId).not.toBe(first.definitionVersionId); // re-pinned to v2

      const versionRow = await withClient((c) =>
        c.query(`SELECT version_no FROM kpi_definition_versions WHERE id = $1`, [
          corrected.definitionVersionId,
        ])
      );
      expect(versionRow.rows[0].version_no).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Negative controls
    // -----------------------------------------------------------------------

    it('8. NEGATIVE CONTROL — a foreign-org kpiId is rejected before any write (no measurement row, no current_value change)', async () => {
      const ownerOrg = orgFor('owner');
      const attackerOrg = orgFor('attacker');
      const kpiId = await seedKpi(ownerOrg, `init-${ownerOrg}`);
      await control.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
        [attackerOrg]
      );

      await expect(
        writer.recordKpiMeasurement({
          organizationId: attackerOrg,
          kpiId,
          value: 999,
          periodStart: '2026-05-01',
          source: 'manual',
        })
      ).rejects.toThrow(writer.KpiMeasurementKpiNotFoundError);

      const rows = await withClient((c) =>
        c.query(`SELECT count(*)::int AS n FROM kpi_time_series WHERE kpi_id = $1`, [kpiId])
      );
      expect(rows.rows[0].n).toBe(0); // zero rows — the attacker's write never reached the table

      const kpi = await withClient((c) =>
        c.query(`SELECT current_value FROM initiative_kpis WHERE id = $1`, [kpiId])
      );
      expect(kpi.rows[0].current_value).toBeNull(); // untouched
    });

    it('9. NEGATIVE CONTROL — a non-finite value is rejected before any write', async () => {
      const org = orgFor('bad-value');
      const kpiId = await seedKpi(org, `init-${org}`);

      await expect(
        writer.recordKpiMeasurement({
          organizationId: org,
          kpiId,
          value: Number.NaN,
          periodStart: '2026-05-01',
          source: 'manual',
        })
      ).rejects.toThrow(writer.KpiMeasurementInvalidValueError);

      const rows = await withClient((c) =>
        c.query(`SELECT count(*)::int AS n FROM kpi_time_series WHERE kpi_id = $1`, [kpiId])
      );
      expect(rows.rows[0].n).toBe(0);
    });

    it('10. NEGATIVE CONTROL — a missing periodStart is rejected before any write', async () => {
      const org = orgFor('bad-period');
      const kpiId = await seedKpi(org, `init-${org}`);

      await expect(
        writer.recordKpiMeasurement({
          organizationId: org,
          kpiId,
          value: 1,
          periodStart: '',
          source: 'manual',
        })
      ).rejects.toThrow(writer.KpiMeasurementInvalidValueError);
    });

    it('11. deriveKpiPeriodKey buckets identically for the two former duplicated implementations (WEEKLY/QUARTERLY/DAILY/MONTHLY)', () => {
      expect(writer.deriveKpiPeriodKey('2026-03-15', 'MONTHLY')).toBe('2026-03');
      expect(writer.deriveKpiPeriodKey('2026-03-15', 'DAILY')).toBe('2026-03-15');
      expect(writer.deriveKpiPeriodKey('2026-03-15', 'QUARTERLY')).toBe('2026-Q1');
      expect(writer.deriveKpiPeriodKey('2026-03-15', 'WEEKLY')).toBe('2026-W03');
    });

    it('12. audit log entry is written on every successful measurement (both create and correction)', async () => {
      const org = orgFor('audit');
      const kpiId = await seedKpi(org, `init-${org}`);

      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 1,
        periodStart: '2026-07-01',
        source: 'manual',
        actorUserId: 'user-audit',
      });
      await writer.recordKpiMeasurement({
        organizationId: org,
        kpiId,
        value: 2,
        periodStart: '2026-07-01',
        source: 'manual',
        actorUserId: 'user-audit',
      });

      // seedKpi() itself goes through kpiDefinitionService.createDefinition,
      // which writes its own kpi_metric_audit_log row (event_type
      // 'create'/'created', source 'kpi_definition_service') — filter to just
      // the writer's own event_type so this test isolates what recordKpiMeasurement
      // itself is responsible for, independent of the canonical fixture's own audit trail.
      const audit = await withClient((c) =>
        c.query(
          `SELECT event_type, source FROM kpi_metric_audit_log
         WHERE kpi_id = $1 AND event_type = 'measurement_recorded' ORDER BY created_at`,
          [kpiId]
        )
      );
      expect(audit.rowCount).toBe(2); // one per write, including the correction
      expect(audit.rows.every((r) => r.event_type === 'measurement_recorded')).toBe(true);
    });
  }
);
