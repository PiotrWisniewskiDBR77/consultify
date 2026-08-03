/**
 * RES-10 — kpiScorecardService tenant isolation, against REAL PostgreSQL, two organizations.
 *
 * Mirrors tests/integration/initiativeGovernance.goalRollup.tenant.pg.test.ts (same opt-in
 * pattern, same "prove it against real Postgres, not a mock" rationale) but for the NEW
 * Results-owned scorecard contract instead of the Initiatives goals contract.
 *
 * Opt-in — needs a disposable Postgres. NEVER point this at demo or prod: it creates and
 * drops its own schema objects.
 *
 *   docker run -d --name res10-pg -e POSTGRES_PASSWORD=res10 -e POSTGRES_USER=res10 \
 *     -e POSTGRES_DB=res10 -p 55432:5432 postgres:15-alpine
 *   RES10_PG_URL=postgresql://res10:res10@localhost:55432/res10 \
 *     npx vitest run tests/integration/kpiScorecardService.tenant.pg.test.ts --retry=0
 */
import fs from 'fs';
import path from 'path';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Resolved relative to the repo root (vitest's cwd), same convention
// server/scripts/migrate.postgres.ts itself uses for --dir.
const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'server/migrations/20260803_res010_kpi_scorecards.sql'
);

const PG_URL = process.env.RES10_PG_URL;
const describeIfPg = PG_URL ? describe : describe.skip;

let client: Client;

// kpiScorecardService talks to the DB only through DbPromise's all/get/run/exec.
// Point those at a real client (via the same `?` -> `$N` rewrite PostgresDatabase
// uses) so the SQL under test runs verbatim against Postgres.
vi.mock('../../server/src/utils/DbPromise.js', async () => {
  const { replacePositionalPlaceholders } = await vi.importActual<
    typeof import('../../server/src/database/PostgresDatabase.js')
  >('../../server/src/database/PostgresDatabase.js');
  return {
    all: async (sql: string, params: unknown[] = []) =>
      (await client.query(replacePositionalPlaceholders(sql), params)).rows,
    get: async (sql: string, params: unknown[] = []) =>
      (await client.query(replacePositionalPlaceholders(sql), params)).rows[0] ?? null,
    run: async (sql: string, params: unknown[] = []) => {
      const r = await client.query(replacePositionalPlaceholders(sql), params);
      return { changes: r.rowCount ?? 0 };
    },
    exec: async (sql: string) => {
      await client.query(replacePositionalPlaceholders(sql));
      return {};
    },
  };
});

const ORG_A = 'org-A';
const ORG_B = 'org-B';
// RES-11: listScorecards/getScorecardKpis/updateScorecard now require a
// viewer context for visibility filtering. This suite is about TENANT
// isolation, not visibility scoping, and no fixture row sets owner_user_id
// or a non-default visibility, so any viewer sees every row here (default
// 'org_visible') — a fixed non-admin viewer keeps that orthogonal.
const VIEWER = { userId: 'tenant-test-viewer', isAdmin: false };

async function svc() {
  return import('../../server/src/services/results/kpiScorecardService.js');
}

describeIfPg('RES-10 — kpiScorecardService cross-tenant (real PostgreSQL)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: PG_URL });
    await client.connect();

    await client.query(
      `DROP TABLE IF EXISTS kpi_scorecard_items, kpi_scorecards, initiative_kpis CASCADE`
    );
    // Minimal slice of the live `initiative_kpis` schema — just the columns
    // kpiScorecardService reads/joins. `is_on_target` is INTEGER (0/1) here,
    // matching the real column type (565_kpi_time_series_roi_attribution_finance.sql /
    // 20260719_baseline_gap.sql), not BOOLEAN.
    await client.query(`
      CREATE TABLE initiative_kpis (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        baseline_value REAL,
        current_value REAL,
        target_value REAL,
        unit TEXT,
        direction TEXT,
        progress_percentage REAL,
        is_on_target INTEGER DEFAULT 0,
        category TEXT,
        initiative_id TEXT,
        owner_user_id TEXT,
        visibility TEXT NOT NULL DEFAULT 'org_visible'
      )`);
    await client.query(
      `INSERT INTO initiative_kpis (id, organization_id, name, is_on_target) VALUES
         ('kpi-of-A-1', $1, 'A margin', 1),
         ('kpi-of-B-1', $2, 'B margin', 1)`,
      [ORG_A, ORG_B]
    );
    // Referenced by kpiVisibilityService's EXISTS subquery — needs to exist
    // syntactically even though every fixture row here is default org_visible.
    await client.query(`
      CREATE TABLE initiative_resources (
        initiative_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        user_id TEXT
      )`);

    // kpiScorecardService no longer creates its own tables (RES-10 CTO fix:
    // schema ownership moves to a real migration, no lazy DDL in the request
    // path) — apply the actual migration file, so this test proves the real
    // schema artifact, not a hand-rolled stand-in.
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    await client.query(migrationSql);
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(
      `DROP TABLE IF EXISTS kpi_scorecard_items, kpi_scorecards, initiative_kpis CASCADE`
    );
    await client.end();
  });

  it("org A never sees org B's scorecards in the list", async () => {
    const { createScorecard, listScorecards } = await svc();
    await createScorecard(ORG_A, { name: 'A Finance Q1' });
    await createScorecard(ORG_B, { name: 'B Finance Q1' });

    const listA = await listScorecards(ORG_A, VIEWER);
    const listB = await listScorecards(ORG_B, VIEWER);

    expect(listA.map((s) => s.name)).toEqual(['A Finance Q1']);
    expect(listB.map((s) => s.name)).toEqual(['B Finance Q1']);
    expect(JSON.stringify(listA)).not.toMatch(/B Finance Q1/);
  });

  it("getScorecard/getScorecardKpis return null for another org's card id (fail-closed, no leak)", async () => {
    const { createScorecard, getScorecard, getScorecardKpis, addKpiToScorecard } = await svc();
    const cardB = await createScorecard(ORG_B, { name: 'B Board Q2' });
    await addKpiToScorecard(ORG_B, cardB.id, 'kpi-of-B-1');

    const crossOrgLookup = await getScorecard(ORG_A, cardB.id);
    const crossOrgKpis = await getScorecardKpis(ORG_A, cardB.id, VIEWER);

    expect(crossOrgLookup).toBeNull();
    expect(crossOrgKpis).toBeNull();

    // Same-org access to the same card still works (positive control).
    const sameOrg = await getScorecardKpis(ORG_B, cardB.id, VIEWER);
    expect(sameOrg?.kpis.map((k) => k.id)).toEqual(['kpi-of-B-1']);
  });

  it("addKpiToScorecard refuses to attach another org's KPI, even to your own card", async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis, ScorecardKpiNotFoundError } =
      await svc();
    const cardA = await createScorecard(ORG_A, { name: 'A Ops Q3' });

    await expect(addKpiToScorecard(ORG_A, cardA.id, 'kpi-of-B-1')).rejects.toBeInstanceOf(
      ScorecardKpiNotFoundError
    );

    const kpis = await getScorecardKpis(ORG_A, cardA.id, VIEWER);
    expect(kpis?.kpis).toEqual([]);
  });

  it('updateScorecard returns null (no write) for a card id owned by another org', async () => {
    const { createScorecard, updateScorecard, getScorecard } = await svc();
    const cardB = await createScorecard(ORG_B, { name: 'B Legal Q4' });

    const result = await updateScorecard(ORG_A, cardB.id, { name: 'Hijacked name' }, VIEWER);

    expect(result).toBeNull();
    const stillIntact = await getScorecard(ORG_B, cardB.id);
    expect(stillIntact?.name).toBe('B Legal Q4');
  });
});
