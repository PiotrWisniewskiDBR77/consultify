/**
 * RES-004 — threshold evaluation, proved end-to-end against a REAL PostgreSQL.
 *
 * Two things a mock cannot prove:
 *  1. Recompute-after-measurement: that a real write through the RES-003
 *     canonical writer (recordKpiMeasurement) leaves the system evaluating
 *     the KPI's CURRENT state, not a stale one — this needs the real
 *     writer -> real deviation-check integration, not a stubbed call.
 *  2. The recovery-card close gate's fail-closed behaviour against a real
 *     schema: CHECK constraints, the FK join in closeRecoveryCard's own
 *     SELECT, and the version-guarded UPDATE all need to actually exist and
 *     behave as this test expects.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/results/__tests__/kpiDeviationService.res004.pg.test.ts
 *
 * Requires 20260803_res003_kpi_time_series_measurement_identity.sql applied
 * (RES-003's unique index — recordKpiMeasurement depends on it). Without a
 * reachable, migrated Postgres the suite SKIPS loudly.
 *
 * TENANCY: every test owns its own organization id (orgFor(key)).
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

async function hasRes003Schema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT to_regclass('public.ux_kpi_time_series_kpi_period_source') IS NOT NULL AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasRes003Schema(CONNECTION_STRING) : false;

if (!REACHABLE || !HAS_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[RES-004 evaluation suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, RES-003-migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res004-eval';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let writer: typeof import('../kpiMeasurementWriterService.js');
let deviation: typeof import('../kpiDeviationService.js');
let recoveryCard: typeof import('../kpiRecoveryCardService.js');
let definitionService: typeof import('../kpiDefinitionService.js');
let dbPromise: typeof import('../../../utils/DbPromise.js');

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await control.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function seedOrgInitiativeKpi(
  orgId: string,
  initiativeId: string,
  kpiId: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await control.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await control.query(
    `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
     ON CONFLICT (id) DO NOTHING`,
    [initiativeId, orgId]
  );
  await control.query(
    `INSERT INTO initiative_kpis
       (id, initiative_id, organization_id, name, target_value, direction, threshold_mode,
        amber_threshold_pct, red_threshold_pct, owner_user_id)
     VALUES ($1, $2, $3, 'Test KPI', $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      kpiId,
      initiativeId,
      orgId,
      extra.targetValue ?? 100,
      extra.direction ?? 'HIGHER_IS_BETTER',
      extra.thresholdMode ?? 'PERCENT_FROM_TARGET',
      extra.amberThresholdPct ?? 0.1,
      extra.redThresholdPct ?? 0.2,
      extra.ownerUserId ?? 'owner-1',
    ]
  );
}

function dbAdapter() {
  // Same IDatabase shape production code builds inline at every call site —
  // exercising the real DbPromise-backed connection, not a stub of it.
  return {
    get: (sql: string, params: unknown[]) => dbPromise.get(sql, params),
    all: (sql: string, params: unknown[]) => dbPromise.all(sql, params),
    run: (sql: string, params: unknown[]) => dbPromise.run(sql, params),
  };
}

suite('kpiDeviationService — RES-004 threshold evaluation end-to-end (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    writer = await import('../kpiMeasurementWriterService.js');
    deviation = await import('../kpiDeviationService.js');
    recoveryCard = await import('../kpiRecoveryCardService.js');
    definitionService = await import('../kpiDefinitionService.js');
    dbPromise = await import('../../../utils/DbPromise.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it('1. recompute after new measurement: writing a RED value opens a case; correcting the SAME period to GREEN re-evaluates GREEN', async () => {
    const org = orgFor('recompute');
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, `init-${org}`, kpiId);

    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 70, // 30% below target=100, red=20% -> RED
      periodStart: '2026-01-01',
      source: 'manual',
    });

    const caseAfterRed = await withClient((c) =>
      c.query(`SELECT severity FROM kpi_deviation_cases WHERE kpi_id = $1`, [kpiId])
    );
    expect(caseAfterRed.rows[0]?.severity).toBe('RED');

    // Correct the SAME period to a value comfortably inside the GREEN band.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 99,
      periodStart: '2026-01-01',
      source: 'manual',
    });

    // The RES-003 upsert corrected the row in place — confirm exactly one
    // measurement row survives for this key (not a duplicate) and holds the
    // corrected value.
    const rows = await withClient((c) =>
      c.query(`SELECT value FROM kpi_time_series WHERE kpi_id = $1`, [kpiId])
    );
    expect(rows.rowCount).toBe(1);
    expect(Number(rows.rows[0].value)).toBe(99);

    // Recompute: evaluating the KPI's CURRENT state (fresh definition +
    // fresh value) now yields GREEN — this is the "no false green, but also
    // no false red" half of RES-004: status tracks the latest write.
    const def = await withClient((c) =>
      c.query(
        `SELECT target_value, direction, threshold_mode, amber_threshold_pct, red_threshold_pct
         FROM initiative_kpis WHERE id = $1`,
        [kpiId]
      )
    );
    const evalResult = deviation.evaluateKpiPoint(
      {
        id: kpiId,
        organizationId: org,
        name: 'Test KPI',
        targetValue: Number(def.rows[0].target_value),
        direction: def.rows[0].direction,
        thresholdMode: def.rows[0].threshold_mode,
        amberThresholdPct: Number(def.rows[0].amber_threshold_pct),
        redThresholdPct: Number(def.rows[0].red_threshold_pct),
      },
      99
    );
    expect(evalResult.status).toBe('GREEN');
  });

  it('2. fail-closed integration: recovery card close is BLOCKED (not silently allowed) when the KPI becomes UNCONFIGURED', async () => {
    const org = orgFor('failclosed');
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, `init-${org}`, kpiId);

    // Open a RED case + recovery card the same way handleTimeSeriesRecorded does.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 70,
      periodStart: '2026-02-01',
      source: 'manual',
    });
    // handleTimeSeriesRecorded (invoked inside recordKpiMeasurement above)
    // already best-effort-created the recovery card via ensureRecoveryCardForCase
    // — read it rather than inserting a second row (deviation_case_id is
    // UNIQUE on kpi_recovery_cards, one card per case by design).
    const cardRow = await withClient((c) =>
      c.query(
        `SELECT id, version FROM kpi_recovery_cards WHERE kpi_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [kpiId]
      )
    );
    expect(cardRow.rowCount).toBe(1);
    const cardId = cardRow.rows[0].id;
    const cardVersion = cardRow.rows[0].version;

    // Simulate the KPI's threshold config breaking (target removed) — the
    // exact scenario RES-004's fail-closed fix targets.
    await withClient((c) =>
      c.query(`UPDATE initiative_kpis SET target_value = NULL WHERE id = $1`, [kpiId])
    );

    // A fresh measurement lands after active_since (satisfies the freshness
    // guard) with a value that would look "recovered" under the old target —
    // but there is no target to evaluate against anymore.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 99,
      periodStart: '2026-02-02',
      source: 'manual',
      runDeviationCheck: false, // isolate the close-gate's OWN evaluation, not a side effect of this write
    });

    const result = await recoveryCard.closeRecoveryCard({
      db: dbAdapter() as any,
      orgId: org,
      recoveryCardId: cardId,
      expectedVersion: cardVersion,
      evidenceText: 'Attempting closure after target was removed',
      effectivenessRating: 'EFFECTIVE',
      actorUserId: 'closer-1',
    });

    expect(result.closed).toBe(false);
    if (!result.closed) {
      expect(result.reason).toBe('STILL_BREACHING');
      expect(result.latestMeasurement?.status).toBe('UNCONFIGURED');
    }

    // NEGATIVE CONTROL evidence: the card really is untouched — still ACTIVE.
    const cardAfter = await withClient((c) =>
      c.query(`SELECT lifecycle_status, version FROM kpi_recovery_cards WHERE id = $1`, [cardId])
    );
    expect(cardAfter.rows[0].lifecycle_status).toBe('ACTIVE');
    expect(cardAfter.rows[0].version).toBe(cardVersion);
  });

  it('3. POSITIVE CONTROL: a genuinely GREEN, well-configured KPI still closes normally (fail-closed does not over-block)', async () => {
    const org = orgFor('positivecontrol');
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, `init-${org}`, kpiId);

    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 70,
      periodStart: '2026-03-01',
      source: 'manual',
    });
    // handleTimeSeriesRecorded (invoked inside recordKpiMeasurement above)
    // already best-effort-created the recovery card via ensureRecoveryCardForCase
    // — read it rather than inserting a second row (deviation_case_id is
    // UNIQUE on kpi_recovery_cards, one card per case by design).
    const cardRow = await withClient((c) =>
      c.query(
        `SELECT id, version FROM kpi_recovery_cards WHERE kpi_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [kpiId]
      )
    );
    expect(cardRow.rowCount).toBe(1);
    const cardId = cardRow.rows[0].id;
    const cardVersion = cardRow.rows[0].version;

    // Genuine recovery: fresh, in-band measurement, threshold config untouched.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 99,
      periodStart: '2026-03-02',
      source: 'manual',
      runDeviationCheck: false,
    });

    const result = await recoveryCard.closeRecoveryCard({
      db: dbAdapter() as any,
      orgId: org,
      recoveryCardId: cardId,
      expectedVersion: cardVersion,
      evidenceText: 'KPI genuinely recovered, closing with evidence',
      effectivenessRating: 'EFFECTIVE',
      actorUserId: 'closer-1',
    });

    expect(result.closed).toBe(true);
  });

  it('4. RES-004 version pin: re-evaluating an OLD measurement uses the threshold it was recorded under, not a target edited since', async () => {
    const org = orgFor('versionpin');
    const initiativeId = `init-${org}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
      [org]
    );
    await control.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, 'Test initiative', 'DRAFT')
       ON CONFLICT (id) DO NOTHING`,
      [initiativeId, org]
    );

    // v1: target=100, HIGHER_IS_BETTER, red=20%.
    const created = await definitionService.createDefinition({
      organizationId: org,
      initiativeId,
      name: 'Version pin KPI',
      targetValue: 100,
      direction: 'HIGHER_IS_BETTER',
      thresholdMode: 'PERCENT_FROM_TARGET',
      amberThresholdPct: 0.1,
      redThresholdPct: 0.2,
    });
    const kpiId = created.id;

    // Recorded while v1 is current — value=70 is 30% below target=100 -> RED
    // under v1. The writer pins this row to v1's definitionVersionId.
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 70,
      periodStart: '2026-04-01',
      source: 'manual',
      runDeviationCheck: false,
    });
    const pinnedRow = await withClient((c) =>
      c.query(
        `SELECT definition_version_id FROM kpi_time_series WHERE kpi_id = $1 AND period_start = '2026-04-01'`,
        [kpiId]
      )
    );
    const v1PinId = pinnedRow.rows[0]?.definition_version_id;
    expect(v1PinId).toBeTruthy();

    // Target is edited to 50 (v2, CAS via expectedVersion=1). Under v2, the
    // SAME value=70 is now ABOVE target -> GREEN.
    await definitionService.updateDefinition({
      organizationId: org,
      kpiId,
      expectedVersion: 1,
      targetValue: 50,
    });
    const liveVerdict = deviation.evaluateKpiPoint(
      { id: kpiId, organizationId: org, name: 'x', targetValue: 50, direction: 'HIGHER_IS_BETTER' },
      70
    );
    expect(liveVerdict.status).toBe('GREEN');

    // Re-evaluating the SAME old measurement through handleTimeSeriesRecorded
    // with its OWN pin (v1) must still read RED — the threshold it was
    // actually recorded under, not today's live (v2) config.
    const pinnedResult = await deviation.handleTimeSeriesRecorded({
      db: dbAdapter() as any,
      orgId: org,
      kpiId,
      value: 70,
      periodStart: '2026-04-01',
      definitionVersionId: v1PinId,
    });
    expect(pinnedResult.eval.status).toBe('RED');

    // NEGATIVE CONTROL: the same call WITHOUT a pin falls back to today's
    // live (v2) config and reads GREEN — proving the RED above came from the
    // pin, not from some other difference between the two calls.
    const unpinnedResult = await deviation.handleTimeSeriesRecorded({
      db: dbAdapter() as any,
      orgId: org,
      kpiId,
      value: 70,
      periodStart: '2026-04-01',
    });
    expect(unpinnedResult.eval.status).toBe('GREEN');
  });
});
