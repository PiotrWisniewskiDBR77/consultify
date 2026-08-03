/**
 * RES-11 (Phase 1) — KPI visibility contract, proved against REAL PostgreSQL.
 *
 * Covers the 9 required minimum evidence items from the CTO handoff:
 *   1. owner sees PRIVATE
 *   2. another user without permission does NOT see PRIVATE
 *   3. PROJECT/TEAM sees only the authorized scope (initiative_resources membership)
 *   4. ORGANIZATION is visible within the org
 *   5. a foreign tenant is always zero, regardless of visibility
 *   6. scorecard roll-up filters out invisible KPIs
 *   7. no double-counting (a KPI on two scorecards; a KPI mapped to two initiatives)
 *   8. fresh reopen preserves visibility (persisted in the DB, not session state)
 *   9. one mounted, active HTTP route (Express router, not a React component
 *      — see the real mounted-component test in
 *      KPITimeSeriesDrawer.visibility.test.tsx for that) shows only allowed KPIs
 *
 * Uses kpiScorecardService (RES-10, Results-owned) as the primary vehicle —
 * it is the simplest, most complete real consumer of kpiVisibilityService —
 * plus one direct kpiAttributionService test to prove attribution/roll-up
 * also respects visibility, per the CTO's explicit "w tym ... attribution/
 * roll-up" instruction. No second KPI owner, no second scorecard service —
 * both consume the SAME kpiVisibilityService policy and the SAME
 * initiative_kpis table this whole program canonicalized.
 *
 * Opt-in — needs a disposable Postgres. NEVER point this at demo or prod: it
 * creates and drops its own schema objects.
 *
 *   docker run -d --name res11-pg -e POSTGRES_PASSWORD=res11 -e POSTGRES_USER=res11 \
 *     -e POSTGRES_DB=res11 -p 55433:5432 postgres:15-alpine
 *   RES11_PG_URL=postgresql://res11:res11@localhost:55433/res11 \
 *     npx vitest run tests/integration/kpiVisibility.res11.pg.test.ts --retry=0
 */
import fs from 'fs';
import path from 'path';

import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const PG_URL = process.env.RES11_PG_URL;
const describeIfPg = PG_URL ? describe : describe.skip;

let client: Client;

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

// v8/results.routes.ts pulls in a wide surface of Results service modules at
// import time (see server/src/routes/v8/__tests__/res10-ownership-separation
// .routes.test.ts for the same minimal-mock set proven to let a direct
// `results.routes.js` import succeed without mounting the whole v8 index).
vi.mock('../../server/src/services/v8/resultsROIService.js', () => ({
  getResultsDashboard: vi.fn(),
  getReconciliationOverview: vi.fn(),
  getResultsKpiCatalog: vi.fn(),
  getResultsKpiDrawerDetail: vi.fn(),
  getROIPortfolioSummary: vi.fn(),
  getROIInitiativeDetail: vi.fn(),
}));
vi.mock('../../server/src/services/results/kpiReportSnapshotService.js', () => ({
  createKpiReportSnapshot: vi.fn(),
  getKpiReportSnapshot: vi.fn(),
  ResultsKpiReportSnapshotError: class extends Error {},
}));
vi.mock('../../server/src/services/results/kpiDeviationService.js', () => ({
  handleTimeSeriesRecorded: vi.fn(),
}));
vi.mock('../../server/src/services/reportBuilderService.js', () => ({
  createReport: vi.fn(),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token provided' });
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token provided' });
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const OWNER = 'user-owner';
const TEAMMATE = 'user-teammate';
const OUTSIDER = 'user-outsider';

async function svc() {
  return import('../../server/src/services/results/kpiScorecardService.js');
}
async function attributionSvc() {
  return import('../../server/src/services/kpiAttributionService.js');
}

const RES010_MIGRATION = path.resolve(
  process.cwd(),
  'server/migrations/20260803_res010_kpi_scorecards.sql'
);
const RES011_MIGRATION = path.resolve(
  process.cwd(),
  'server/migrations/20260803_res011_kpi_visibility.sql'
);

describeIfPg('RES-11 — KPI visibility (real PostgreSQL)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: PG_URL });
    await client.connect();

    await client.query(
      `DROP TABLE IF EXISTS kpi_scorecard_items, kpi_scorecards, kpi_time_series,
        initiative_kpi_mappings, initiative_resources, initiative_kpis, initiatives CASCADE`
    );
    await client.query(`
      CREATE TABLE initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT,
        status TEXT DEFAULT 'active',
        progress REAL DEFAULT 0
      )`);
    await client.query(`
      CREATE TABLE initiative_kpis (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        initiative_id TEXT,
        name TEXT NOT NULL,
        owner_user_id TEXT,
        baseline_value REAL,
        current_value REAL,
        target_value REAL,
        unit TEXT,
        direction TEXT,
        progress_percentage REAL,
        is_on_target INTEGER DEFAULT 0,
        category TEXT
      )`);
    await client.query(`
      CREATE TABLE initiative_resources (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        initiative_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        role TEXT NOT NULL DEFAULT 'member'
      )`);
    await client.query(`
      CREATE TABLE initiative_kpi_mappings (
        initiative_id TEXT NOT NULL,
        kpi_id TEXT NOT NULL,
        organization_id TEXT NOT NULL
      )`);
    await client.query(`
      CREATE TABLE kpi_time_series (
        id TEXT PRIMARY KEY,
        kpi_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        value REAL NOT NULL,
        period_start TEXT NOT NULL
      )`);

    // Real migration artifacts — same principle as the RES-10 pg test: prove
    // the actual files, not a hand-rolled stand-in.
    await client.query(fs.readFileSync(RES010_MIGRATION, 'utf-8'));
    await client.query(fs.readFileSync(RES011_MIGRATION, 'utf-8'));

    // Fixture: one initiative in org A, three KPIs of each visibility scope,
    // a team member (TEAMMATE) resourced onto it, an outsider who is a member
    // of the SAME org but NOT resourced onto the initiative, and the owner.
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name) VALUES ('init-A', $1, 'Initiative A')`,
      [ORG_A]
    );
    await client.query(
      `INSERT INTO initiative_resources (initiative_id, organization_id, user_id, role)
       VALUES ('init-A', $1, $2, 'member')`,
      [ORG_A, TEAMMATE]
    );
    await client.query(
      `INSERT INTO initiative_kpis
         (id, organization_id, initiative_id, name, owner_user_id, visibility, is_on_target)
       VALUES
         ('kpi-org-visible', $1, 'init-A', 'Org KPI', $2, 'org_visible', 1),
         ('kpi-restricted',  $1, 'init-A', 'Team KPI', $2, 'initiative_restricted', 0),
         ('kpi-private',     $1, 'init-A', 'Private KPI', $2, 'private_to_owner', 1)`,
      [ORG_A, OWNER]
    );
    // A second org's own KPI, visible to nobody in org A — cross-tenant control.
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name) VALUES ('init-B', $1, 'Initiative B')`,
      [ORG_B]
    );
    await client.query(
      `INSERT INTO initiative_kpis (id, organization_id, initiative_id, name, visibility)
       VALUES ('kpi-org-b', $1, 'init-B', 'Org B KPI', 'org_visible')`,
      [ORG_B]
    );
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(
      `DROP TABLE IF EXISTS kpi_scorecard_items, kpi_scorecards, kpi_time_series,
        initiative_kpi_mappings, initiative_resources, initiative_kpis, initiatives CASCADE`
    );
    await client.end();
  });

  it('1. owner sees PRIVATE', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Owner view' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-private');

    const result = await getScorecardKpis(ORG_A, card.id, { userId: OWNER, isAdmin: false });

    expect(result?.kpis.map((k) => k.id)).toContain('kpi-private');
  });

  it('2. another org member WITHOUT permission does not see PRIVATE', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Outsider view' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-private');

    const result = await getScorecardKpis(ORG_A, card.id, { userId: OUTSIDER, isAdmin: false });

    expect(result?.kpis.map((k) => k.id)).not.toContain('kpi-private');
  });

  it('3. PROJECT/TEAM (initiative_restricted) is visible only to the authorized scope', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Team scope' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-restricted');

    const asTeammate = await getScorecardKpis(ORG_A, card.id, { userId: TEAMMATE, isAdmin: false });
    const asOutsider = await getScorecardKpis(ORG_A, card.id, { userId: OUTSIDER, isAdmin: false });

    expect(asTeammate?.kpis.map((k) => k.id)).toContain('kpi-restricted');
    expect(asOutsider?.kpis.map((k) => k.id)).not.toContain('kpi-restricted');
  });

  it('4. ORGANIZATION (org_visible) is visible to anyone inside the org', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Org scope' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-org-visible');

    for (const userId of [OWNER, TEAMMATE, OUTSIDER]) {
      const result = await getScorecardKpis(ORG_A, card.id, { userId, isAdmin: false });
      expect(result?.kpis.map((k) => k.id)).toContain('kpi-org-visible');
    }
  });

  it('5. a foreign tenant always gets zero, independent of visibility scope', async () => {
    const { createScorecard, addKpiToScorecard, getScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Cross-tenant probe' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-org-visible');

    // Org B cannot even resolve org A's card id — fail-closed before visibility is ever evaluated.
    const crossOrg = await getScorecard(ORG_B, card.id);
    expect(crossOrg).toBeNull();
    const crossOrgKpis = await getScorecardKpis(ORG_B, card.id, { userId: OWNER, isAdmin: false });
    expect(crossOrgKpis).toBeNull();
  });

  it('6. scorecard roll-up filters out invisible KPIs (counts match the visible list)', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis, listScorecards } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Mixed visibility card' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-org-visible');
    await addKpiToScorecard(ORG_A, card.id, 'kpi-restricted');
    await addKpiToScorecard(ORG_A, card.id, 'kpi-private');

    const asOutsider = await getScorecardKpis(ORG_A, card.id, { userId: OUTSIDER, isAdmin: false });
    expect(asOutsider?.kpis.map((k) => k.id)).toEqual(['kpi-org-visible']);

    const listAsOutsider = await listScorecards(ORG_A, { userId: OUTSIDER, isAdmin: false });
    const found = listAsOutsider.find((c) => c.id === card.id);
    // Count must match the visible list exactly — not the raw 3 attached KPIs.
    expect(found?.kpiCount).toBe(1);

    const asOwner = await getScorecardKpis(ORG_A, card.id, { userId: OWNER, isAdmin: false });
    expect(asOwner?.kpis.map((k) => k.id).sort()).toEqual(
      ['kpi-org-visible', 'kpi-restricted', 'kpi-private'].sort()
    );
    const listAsOwner = await listScorecards(ORG_A, { userId: OWNER, isAdmin: false });
    expect(listAsOwner.find((c) => c.id === card.id)?.kpiCount).toBe(3);
  });

  it('7. no double-counting: the same KPI on two cards, and a KPI mapped to two initiatives', async () => {
    const { createScorecard, addKpiToScorecard, listScorecards } = await svc();
    const cardX = await createScorecard(ORG_A, { name: 'Card X' });
    const cardY = await createScorecard(ORG_A, { name: 'Card Y' });
    await addKpiToScorecard(ORG_A, cardX.id, 'kpi-org-visible');
    await addKpiToScorecard(ORG_A, cardY.id, 'kpi-org-visible');

    const list = await listScorecards(ORG_A, { userId: OWNER, isAdmin: false });
    // Each card counts the KPI once — attaching to two cards must not inflate
    // either card's own count (no shared-row fan-out artifact).
    expect(list.find((c) => c.id === cardX.id)?.kpiCount).toBe(1);
    expect(list.find((c) => c.id === cardY.id)?.kpiCount).toBe(1);

    // initiative_kpi_mappings many-to-many fan-out must not double-count the
    // KPI itself in a card's roll-up — attribution reads the KPI row once
    // regardless of how many initiatives it is mapped to.
    await client.query(
      `INSERT INTO initiatives (id, organization_id, name) VALUES ('init-A2', $1, 'Initiative A2')`,
      [ORG_A]
    );
    await client.query(
      `INSERT INTO initiative_kpi_mappings (initiative_id, kpi_id, organization_id) VALUES
         ('init-A', 'kpi-org-visible', $1), ('init-A2', 'kpi-org-visible', $1)`,
      [ORG_A]
    );
    const listAfterMapping = await listScorecards(ORG_A, { userId: OWNER, isAdmin: false });
    expect(listAfterMapping.find((c) => c.id === cardX.id)?.kpiCount).toBe(1);
  });

  it('8. fresh reopen preserves visibility (persisted in the DB, not session/cache state)', async () => {
    const { createScorecard, addKpiToScorecard, getScorecardKpis } = await svc();
    const card = await createScorecard(ORG_A, { name: 'Reopen probe' });
    await addKpiToScorecard(ORG_A, card.id, 'kpi-private');

    const before = await getScorecardKpis(ORG_A, card.id, { userId: OUTSIDER, isAdmin: false });
    expect(before?.kpis.map((k) => k.id)).not.toContain('kpi-private');

    // "Reopen": a brand-new client connection and a fresh module import,
    // simulating a new request/process rather than reusing in-memory state.
    const reopened = new Client({ connectionString: PG_URL });
    await reopened.connect();
    const rows = (
      await reopened.query(`SELECT visibility FROM initiative_kpis WHERE id = 'kpi-private'`)
    ).rows;
    await reopened.end();
    expect(rows[0]?.visibility).toBe('private_to_owner');

    const after = await getScorecardKpis(ORG_A, card.id, { userId: OUTSIDER, isAdmin: false });
    expect(after?.kpis.map((k) => k.id)).not.toContain('kpi-private');
    const afterAsOwner = await getScorecardKpis(ORG_A, card.id, { userId: OWNER, isAdmin: false });
    expect(afterAsOwner?.kpis.map((k) => k.id)).toContain('kpi-private');
  });

  it('attribution/roll-up: computeAttribution treats a hidden KPI the caller cannot see as Unknown', async () => {
    const { computeAttribution } = await attributionSvc();
    await client.query(
      `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start) VALUES
         ('ts-1', 'kpi-private', $1, 10, '2026-01-01'),
         ('ts-2', 'kpi-private', $1, 20, '2026-02-01')`,
      [ORG_A]
    );

    const asOutsider = await computeAttribution('kpi-private', ORG_A, '2026-01-01', '2026-02-28', {
      userId: OUTSIDER,
      isAdmin: false,
    });
    expect(asOutsider.kpiName).toBe('Unknown');
    expect(asOutsider.kpiDelta).toBe(0);

    const asOwner = await computeAttribution('kpi-private', ORG_A, '2026-01-01', '2026-02-28', {
      userId: OWNER,
      isAdmin: false,
    });
    expect(asOwner.kpiName).toBe('Private KPI');
    expect(asOwner.kpiDelta).toBe(10);
  });

  it('9. one mounted, active HTTP route (Express, not a React UI) shows only the KPIs allowed for the caller', async () => {
    const resultsRoutes = (await import('../../server/src/routes/v8/results.routes.js')).default;
    const { attachV8Context } = await import('../../server/src/middleware/v8Auth.middleware.js');
    const verifyToken = (await import('../../server/src/middleware/auth.middleware.js')).default;

    const app: Express = express();
    app.use(express.json());
    app.use('/api/v8/results', verifyToken, attachV8Context, resultsRoutes);

    const card = (await (await svc()).createScorecard(ORG_A, { name: 'Mounted flow card' })).id;
    await (await svc()).addKpiToScorecard(ORG_A, card, 'kpi-org-visible');
    await (await svc()).addKpiToScorecard(ORG_A, card, 'kpi-restricted');
    await (await svc()).addKpiToScorecard(ORG_A, card, 'kpi-private');

    mockUser = { id: OUTSIDER, organizationId: ORG_A };
    const outsiderRes = await request(app).get(`/api/v8/results/scorecards/${card}/kpis`);
    expect(outsiderRes.status).toBe(200);
    expect(outsiderRes.body.data.kpis.map((k: any) => k.id)).toEqual(['kpi-org-visible']);

    mockUser = { id: TEAMMATE, organizationId: ORG_A };
    const teammateRes = await request(app).get(`/api/v8/results/scorecards/${card}/kpis`);
    expect(teammateRes.body.data.kpis.map((k: any) => k.id).sort()).toEqual(
      ['kpi-org-visible', 'kpi-restricted'].sort()
    );

    mockUser = { id: OWNER, organizationId: ORG_A };
    const ownerRes = await request(app).get(`/api/v8/results/scorecards/${card}/kpis`);
    expect(ownerRes.body.data.kpis.map((k: any) => k.id).sort()).toEqual(
      ['kpi-org-visible', 'kpi-restricted', 'kpi-private'].sort()
    );

    // Cross-tenant, independent of visibility: org B can never even resolve this card.
    mockUser = { id: 'user-b', organizationId: ORG_B };
    const crossOrgRes = await request(app).get(`/api/v8/results/scorecards/${card}/kpis`);
    expect(crossOrgRes.status).toBe(404);
    expect(JSON.stringify(crossOrgRes.body)).not.toMatch(/kpi-org-visible|kpi-restricted|kpi-private/);
  });
});
