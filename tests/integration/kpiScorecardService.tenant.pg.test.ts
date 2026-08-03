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
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
    // kpiScorecardService reads/joins.
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
        is_on_target BOOLEAN DEFAULT false,
        category TEXT,
        initiative_id TEXT
      )`);
    await client.query(
      `INSERT INTO initiative_kpis (id, organization_id, name, is_on_target) VALUES
         ('kpi-of-A-1', $1, 'A margin', true),
         ('kpi-of-B-1', $2, 'B margin', true)`,
      [ORG_A, ORG_B]
    );
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

    const listA = await listScorecards(ORG_A);
    const listB = await listScorecards(ORG_B);

    expect(listA.map((s) => s.name)).toEqual(['A Finance Q1']);
    expect(listB.map((s) => s.name)).toEqual(['B Finance Q1']);
    expect(JSON.stringify(listA)).not.toMatch(/B Finance Q1/);
  });

  it("getScorecard/getScorecardKpis return null for another org's card id (fail-closed, no leak)", async () => {
    const { createScorecard, getScorecard, getScorecardKpis, addKpiToScorecard } = await svc();
    const cardB = await createScorecard(ORG_B, { name: 'B Board Q2' });
    await addKpiToScorecard(ORG_B, cardB.id, 'kpi-of-B-1');

    const crossOrgLookup = await getScorecard(ORG_A, cardB.id);
    const crossOrgKpis = await getScorecardKpis(ORG_A, cardB.id);

    expect(crossOrgLookup).toBeNull();
    expect(crossOrgKpis).toBeNull();

    // Same-org access to the same card still works (positive control).
    const sameOrg = await getScorecardKpis(ORG_B, cardB.id);
    expect(sameOrg?.kpis.map((k) => k.id)).toEqual(['kpi-of-B-1']);
  });

  it("addKpiToScorecard refuses to attach another org's KPI, even to your own card", async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis, ScorecardKpiNotFoundError } =
      await svc();
    const cardA = await createScorecard(ORG_A, { name: 'A Ops Q3' });

    await expect(addKpiToScorecard(ORG_A, cardA.id, 'kpi-of-B-1')).rejects.toBeInstanceOf(
      ScorecardKpiNotFoundError
    );

    const kpis = await getScorecardKpis(ORG_A, cardA.id);
    expect(kpis?.kpis).toEqual([]);
  });

  it('updateScorecard returns null (no write) for a card id owned by another org', async () => {
    const { createScorecard, updateScorecard, getScorecard } = await svc();
    const cardB = await createScorecard(ORG_B, { name: 'B Legal Q4' });

    const result = await updateScorecard(ORG_A, cardB.id, { name: 'Hijacked name' });

    expect(result).toBeNull();
    const stillIntact = await getScorecard(ORG_B, cardB.id);
    expect(stillIntact?.name).toBe('B Legal Q4');
  });
});
