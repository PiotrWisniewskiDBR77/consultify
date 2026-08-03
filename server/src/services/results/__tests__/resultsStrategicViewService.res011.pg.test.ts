/**
 * RES-011 — portfolio/BSC roll-up: no double-counting, fail-closed on tenant,
 * proved against a REAL PostgreSQL for the exact queries
 * `GET /api/results-strategic/:projectId/strategic` runs.
 *
 * Motivation: `initiative_kpi_mappings` is many-to-many (a KPI can map to
 * several initiatives). The RES-011 discovery pass audited every rollup
 * point that reads it and found each one already correctly derives its KPI
 * COUNT from the `initiative_kpis` table directly (one row per KPI) rather
 * than by fanning out through the mapping join — this test proves that
 * property holds against real data (a KPI genuinely mapped to 2 different
 * initiatives) rather than trusting the code-reading alone, and proves the
 * org filter is fail-closed (a foreign org sees zero rows, not an error and
 * not someone else's rows).
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/results/__tests__/resultsStrategicViewService.res011.pg.test.ts
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
    `[RES-011 resultsStrategicViewService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res011-rollup';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;

let control: Pool;
let dbPromise: typeof import('../../../utils/DbPromise.js');
let strategicView: typeof import('../resultsStrategicViewService.js');

/**
 * Mirrors resultsStrategic.routes.ts's exact query shape for
 * `GET /:projectId/strategic` (org-wide branch) — same table, same
 * predicate, same three-query composition.
 */
async function fetchStrategicRollupInput(orgId: string) {
  const initiativeRows =
    (await dbPromise.all(`SELECT id, name FROM initiatives WHERE organization_id = ?`, [orgId])) ||
    [];
  const kpiRows =
    (await dbPromise.all(
      `SELECT id, name, current_value, target_value, measurement_frequency
       FROM initiative_kpis WHERE organization_id = ?`,
      [orgId]
    )) || [];
  const mappingRows =
    (await dbPromise.all(
      `SELECT initiative_id, kpi_id FROM initiative_kpi_mappings WHERE organization_id = ?`,
      [orgId]
    )) || [];
  return { initiativeRows, kpiRows, mappingRows };
}

suite('resultsStrategicViewService — RES-011 roll-up correctness (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    dbPromise = await import('../../../utils/DbPromise.js');
    strategicView = await import('../resultsStrategicViewService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it('1. a KPI mapped to TWO initiatives is counted ONCE in the KPI rollup, not twice', async () => {
    const org = orgFor('double-count');
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
      [org]
    );
    const initA = `initA-${org}`;
    const initB = `initB-${org}`;
    const kpiId = `kpi-${org}`;
    await control.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1,$2,'Initiative A','DRAFT') ON CONFLICT (id) DO NOTHING`,
      [initA, org]
    );
    await control.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1,$2,'Initiative B','DRAFT') ON CONFLICT (id) DO NOTHING`,
      [initB, org]
    );
    await control.query(
      `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name, current_value, target_value)
       VALUES ($1,$2,$3,'Shared KPI', 50, 100) ON CONFLICT (id) DO NOTHING`,
      [kpiId, initA, org]
    );
    // The SAME KPI mapped to BOTH initiatives — the many-to-many fan-out.
    await control.query(
      `INSERT INTO initiative_kpi_mappings (initiative_id, kpi_id, organization_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [initA, kpiId, org]
    );
    await control.query(
      `INSERT INTO initiative_kpi_mappings (initiative_id, kpi_id, organization_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [initB, kpiId, org]
    );

    const { initiativeRows, kpiRows, mappingRows } = await fetchStrategicRollupInput(org);
    expect(mappingRows).toHaveLength(2); // the fan-out is real at the mapping layer
    expect(kpiRows).toHaveLength(1); // but the KPI itself is one row, one count

    const view = strategicView.buildStrategicView({
      kpis: kpiRows.map((r: any) => ({
        id: r.id,
        name: r.name,
        value: r.current_value ?? undefined,
        target: r.target_value ?? undefined,
      })),
      initiatives: initiativeRows.map((r: any) => ({ id: r.id, name: r.name })),
      initiativeToKpi: mappingRows.map((r: any) => ({
        initiativeId: r.initiative_id,
        kpiId: r.kpi_id,
      })),
    });

    // BSC perspective counts sum to exactly 1 KPI across all 4 perspectives —
    // not 2, despite 2 mapping rows feeding the same composition.
    const bscTotal = Object.values(view.bsc.perspectives).reduce(
      (sum: number, p: any) => sum + (p?.count ?? 0),
      0
    );
    expect(bscTotal).toBe(1);

    // The BDN graph, by contrast, legitimately shows 2 edges (enabler->benefit
    // per initiative) — that is correct network modeling, not a double-count
    // of the KPI itself (still exactly 1 'benefit'-type node for this KPI).
    expect(view.bdn.edges).toHaveLength(2);
    expect(view.bdn.nodes.filter((n: any) => n.type === 'benefit')).toHaveLength(1);
  });

  it('2. NEGATIVE CONTROL — fail-closed tenant scope: a foreign org sees zero rows, not an error and not org A\'s data', async () => {
    const orgA = orgFor('tenant-a');
    const orgB = orgFor('tenant-b');
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
      [orgA]
    );
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
      [orgB]
    );
    const initId = `init-${orgA}`;
    const kpiId = `kpi-${orgA}`;
    await control.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1,$2,'Org A Initiative','DRAFT') ON CONFLICT (id) DO NOTHING`,
      [initId, orgA]
    );
    await control.query(
      `INSERT INTO initiative_kpis (id, initiative_id, organization_id, name) VALUES ($1,$2,$3,'Org A KPI') ON CONFLICT (id) DO NOTHING`,
      [kpiId, initId, orgA]
    );

    const asOwner = await fetchStrategicRollupInput(orgA);
    expect(asOwner.kpiRows).toHaveLength(1);

    const asForeign = await fetchStrategicRollupInput(orgB);
    expect(asForeign.kpiRows).toHaveLength(0);
    expect(asForeign.initiativeRows).toHaveLength(0);
  });
});
