/**
 * RES-011 (Phase 0 — security fix) — kpiAttributionService cross-tenant
 * read guard, proved against a REAL PostgreSQL.
 *
 * Confirmed pre-fix: `computeAttribution`'s first query
 * (`SELECT ... FROM initiative_kpis ik WHERE ik.id = ?`) had no
 * organization_id predicate at all — `organizationId` was a function
 * parameter that reached the LATER initiative_kpi_mappings join but never
 * this one. `GET /api/benefits/attribution/:kpiId` with a foreign org's
 * kpiId returned that KPI's real name and time-series-derived delta in a
 * 200 response. The sibling `POST /attribution/:kpiId/snapshot` route
 * already had the correct ownership precheck (SEC-3/L-04) — this GET
 * variant was the one that got missed.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/__tests__/kpiAttributionService.res011.pg.test.ts
 *
 * TENANCY: every test uses fresh org ids (orgFor(key)).
 */
import { Pool } from 'pg';
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
      `SELECT to_regclass('public.initiative_kpi_mappings') IS NOT NULL AS present`
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
    `[RES-011 kpiAttributionService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res011-attribution';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let attribution: typeof import('../kpiAttributionService.js');
let writer: typeof import('../results/kpiMeasurementWriterService.js');

async function seedOrgInitiativeKpi(
  orgId: string,
  initiativeId: string,
  kpiId: string,
  kpiName: string
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
    `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [kpiId, initiativeId, orgId, kpiName]
  );
}

suite('kpiAttributionService — RES-011 cross-tenant guard (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    attribution = await import('../kpiAttributionService.js');
    writer = await import('../results/kpiMeasurementWriterService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it("1. THE FIX: org B cannot read org A's real KPI name/delta via computeAttribution — falls into the same 'Unknown' branch as a nonexistent kpiId", async () => {
    const orgA = orgFor('owner');
    const orgB = orgFor('attacker');
    const initId = `init-${orgA}`;
    const kpiId = `kpi-${orgA}`;
    await seedOrgInitiativeKpi(orgA, initId, kpiId, 'Org A Confidential Revenue KPI');

    // Real time-series history via the RES-003 writer, so kpiDelta would be
    // genuinely non-zero if the leak were still open.
    await writer.recordKpiMeasurement({
      organizationId: orgA,
      kpiId,
      value: 100,
      periodStart: '2026-01-01',
      source: 'manual',
    });
    await writer.recordKpiMeasurement({
      organizationId: orgA,
      kpiId,
      value: 150,
      periodStart: '2026-02-01',
      source: 'manual',
    });

    // Org B calls with ITS OWN organizationId but org A's kpiId — exactly
    // the shape GET /api/benefits/attribution/:kpiId passes through.
    const result = await attribution.computeAttribution(kpiId, orgB, '2026-01-01', '2026-02-01');

    expect(result.kpiName).toBe('Unknown'); // NOT "Org A Confidential Revenue KPI"
    expect(result.kpiDelta).toBe(0); // NOT the real 50 delta
    expect(result.contributions).toEqual([]);

    // Owner org still sees its own real data — the fix isn't a global block.
    const ownerResult = await attribution.computeAttribution(
      kpiId,
      orgA,
      '2026-01-01',
      '2026-02-01'
    );
    expect(ownerResult.kpiName).toBe('Org A Confidential Revenue KPI');
    expect(ownerResult.kpiDelta).toBe(50);
  });

  it('2. POSITIVE CONTROL: an unmapped-but-owned KPI still returns real name/delta with an honest "no initiatives mapped" reason', async () => {
    const org = orgFor('unmapped');
    const initId = `init-${org}`;
    const kpiId = `kpi-${org}`;
    await seedOrgInitiativeKpi(org, initId, kpiId, 'Real KPI, no mappings');

    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 10,
      periodStart: '2026-03-01',
      source: 'manual',
    });
    await writer.recordKpiMeasurement({
      organizationId: org,
      kpiId,
      value: 20,
      periodStart: '2026-04-01',
      source: 'manual',
    });

    const result = await attribution.computeAttribution(kpiId, org, '2026-03-01', '2026-04-01');
    expect(result.kpiName).toBe('Real KPI, no mappings');
    expect(result.kpiDelta).toBe(10);
    expect(result.confidenceReasons).toContain('No initiatives mapped to this KPI');
  });
});
