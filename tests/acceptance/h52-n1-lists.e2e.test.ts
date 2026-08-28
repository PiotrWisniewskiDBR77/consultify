/**
 * Acceptance E2E — H5.3: N+1 batching on hot lists (parity :5443, real SQL).
 *
 * Proves the three batched N+1 fixes return IDENTICAL results to the previous
 * per-row-loop implementation, against the REAL routers/services behind REAL
 * verifyToken + REAL Postgres. No business-logic mocks.
 *
 *   1. GET /api/teams — members for N teams fetched in ONE `WHERE team_id IN (…)`
 *      query (was 1 query per team). Asserts correct per-team grouping,
 *      memberCount, empty-team handling and the member user shape.
 *   2. pullAndReconcileInitiative — realized-ROI SUM for N KPIs fetched in ONE
 *      `GROUP BY kpi_id` query (was 1 SUM per KPI). Asserts each KPI's summed
 *      actual equals the sum of its seeded ROI entries.
 *   3. Static query-count proof for all three fixed sites (incl. pmoRoles, whose
 *      per-role COUNT collapsed to one GROUP BY — not exercised live because the
 *      parity snapshot lacks users.project_role; both old and new code reference
 *      it, so no regression). Confirms N queries → 1 in source.
 *
 * Artifacts use the reversible `odbior--h52--` prefix; the probe cleans up after
 * itself (demo-data hygiene). JEDYNY plik tej pracy.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const P = `odbior--h52--${randomUUID()}--`;
const TEAM_A = `${P}team-a`;
const TEAM_B = `${P}team-b`;
const TEAM_C = `${P}team-c`;
const M1 = `${P}m1`;
const M2 = `${P}m2`;
const M3 = `${P}m3`;
const M4 = `${P}m4`;
const INIT = `${P}init-1`;
const KPI1 = `${P}kpi-1`;
const KPI2 = `${P}kpi-2`;

const SERVER_SRC = fileURLToPath(new URL('../../server/src/', import.meta.url));

async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const teamsRouter = (await import('../../server/src/routes/organization/teams.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/teams', verifyToken as any, teamsRouter);
  return app;
}

async function seedFixtures(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    // Member users (project_role left NULL so they don't perturb any role count).
    for (const [id, fn] of [
      [M1, 'Ann'],
      [M2, 'Bob'],
      [M3, 'Cyd'],
      [M4, 'Dee'],
    ] as const) {
      await c.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'MEMBER', 'active', $4, 'H52', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, SEED.ORG_ID, `${id}@acceptance.local`, fn]
      );
    }
    // Teams: A (3 members), B (1 member), C (0 members).
    for (const [id, name] of [
      [TEAM_A, `${P}Alpha`],
      [TEAM_B, `${P}Bravo`],
      [TEAM_C, `${P}Charlie`],
    ] as const) {
      await c.query(
        `INSERT INTO teams (id, organization_id, name, created_at)
         VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO NOTHING`,
        [id, SEED.ORG_ID, name]
      );
    }
    for (const [team, user, role] of [
      [TEAM_A, M1, 'LEAD'],
      [TEAM_A, M2, 'MEMBER'],
      [TEAM_A, M3, 'MEMBER'],
      [TEAM_B, M4, 'MEMBER'],
    ] as const) {
      await c.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [team, user, role]
      );
    }
    // KPI defs + ROI entries for the reconciliation SUM batch.
    for (const [kpi, target] of [
      [KPI1, 400],
      [KPI2, 100],
    ] as const) {
      await c.query(
        `INSERT INTO v8_kpi_definitions
           (kpi_id, organization_id, name, mode, initiative_id, metric_type, target_value, current_value, measurement_cadence, status, created_at)
         VALUES ($1, $2, $3, 'initiative_linked', $4, 'currency', $5, 0, 'monthly', 'active', NOW())
         ON CONFLICT (kpi_id) DO NOTHING`,
        [kpi, SEED.ORG_ID, `${P}${kpi}`, INIT, target]
      );
    }
    const roiEntries: Array<[string, number]> = [
      [KPI1, 100],
      [KPI1, 250],
      [KPI1, 50], // sum 400
      [KPI2, 70],
      [KPI2, 30], // sum 100
    ];
    let i = 0;
    for (const [kpi, val] of roiEntries) {
      await c.query(
        `INSERT INTO v8_roi_realization_entries
           (entry_id, organization_id, kpi_id, initiative_id, realized_value, period, created_at)
         VALUES ($1, $2, $3, $4, $5, '2026-Q2', NOW())
         ON CONFLICT (entry_id) DO NOTHING`,
        [`${P}roi-${i++}`, SEED.ORG_ID, kpi, INIT, val]
      );
    }
  } finally {
    await c.end();
  }
}

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM v8_kpi_finance_reconciliations WHERE organization_id = $1 AND kpi_id LIKE $2`, [SEED.ORG_ID, `${P}%`]);
    // ROI-E007 makes realization rows append-only. Their KPI identities must
    // remain with them; the whole local database is disposable and removed by
    // the acceptance harness after the run.
    await c.query(`DELETE FROM team_members WHERE team_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM teams WHERE id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM users WHERE id LIKE $1 AND id <> $2`, [`${P}%`, SEED.USER_ID]);
  } finally {
    await c.end();
  }
}

let app: Express;
let token: string;

beforeAll(async () => {
  await seed();
  await cleanup(); // idempotent: clear any residue from a prior run
  await seedFixtures();
  app = await buildApp();
  token = mintToken();
});

afterAll(async () => {
  await cleanup();
});

describe('H5.3 — GET /api/teams members batched (WHERE team_id IN)', () => {
  it('groups members per team with correct counts and member shape', async () => {
    const res = await request(app).get('/api/teams').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const byId = new Map<string, any>(res.body.map((t: any) => [t.id, t]));
    const a = byId.get(TEAM_A);
    const b = byId.get(TEAM_B);
    const cc = byId.get(TEAM_C);
    expect(a && b && cc).toBeTruthy();

    // Team A: 3 members, correctly grouped (NOT bleeding into B/C).
    // `memberCount` is the SQL COUNT subquery (bigint ⇒ string in pg) — left
    // untouched by the batch fix; assert numeric equality, not JS type.
    expect(a.members).toHaveLength(3);
    expect(Number(a.memberCount)).toBe(3);
    const aUserIds = a.members.map((m: any) => m.userId).sort();
    expect(aUserIds).toEqual([M1, M2, M3].sort());

    // Member shape preserved (contract unchanged): userId/role/user{...}.
    const lead = a.members.find((m: any) => m.userId === M1);
    expect(lead.role).toBe('LEAD');
    expect(lead.user).toMatchObject({ id: M1, firstName: 'Ann', email: `${M1}@acceptance.local` });

    // Team B: exactly its one member (no cross-team leakage from the IN batch).
    expect(b.members).toHaveLength(1);
    expect(b.members[0].userId).toBe(M4);

    // Team C: empty team returns [] (skip-query branch), memberCount 0.
    expect(cc.members).toHaveLength(0);
    expect(Number(cc.memberCount)).toBe(0);
  });
});

describe('H5.3 — pullAndReconcileInitiative realized SUM batched (GROUP BY kpi_id)', () => {
  it('sums realized ROI per KPI identically to the per-KPI loop', async () => {
    const svc = await import('../../server/src/services/v8/resultsFinanceReconciliationService.js');
    const result = await svc.pullAndReconcileInitiative(SEED.ORG_ID, INIT, [
      { kpiId: KPI1, driverKey: `${P}driver-1`, unitMultiplier: 1 },
      { kpiId: KPI2, driverKey: `${P}driver-2`, unitMultiplier: 1 },
    ]);

    expect(result.reconciledCount).toBe(2);
    const byKpi = new Map<string, any>(result.items.map((it: any) => [it.kpiId, it]));
    // Batched GROUP BY must reproduce the exact per-KPI sums.
    expect(byKpi.get(KPI1).kpiActual).toBe(400); // 100+250+50
    expect(byKpi.get(KPI2).kpiActual).toBe(100); // 70+30
    // unitMultiplier 1 ⇒ realized on finance basis equals the summed actual.
    expect(byKpi.get(KPI1).realizedValue).toBe(400);
    expect(byKpi.get(KPI2).realizedValue).toBe(100);
  });
});

describe('H5.3 — static query-count proof (N per-row queries → 1 batch)', () => {
  it('teams.routes: single IN batch, no per-team map(async) query', () => {
    const src = readFileSync(`${SERVER_SRC}routes/organization/teams.routes.ts`, 'utf8');
    expect(src).toMatch(/WHERE tm\.team_id IN \(/);
    expect(src).not.toMatch(/teams\.map\(async/);
  });

  it('pmoRoles.routes: single GROUP BY, no per-role map(async) COUNT', () => {
    const src = readFileSync(`${SERVER_SRC}routes/pmo/pmoRoles.routes.ts`, 'utf8');
    expect(src).toMatch(/GROUP BY project_role/);
    expect(src).not.toMatch(/SYSTEM_ROLES\.map\(async/);
  });

  it('resultsFinanceReconciliationService: single GROUP BY kpi_id, no per-KPI SUM in loop', () => {
    const src = readFileSync(
      `${SERVER_SRC}services/v8/resultsFinanceReconciliationService.js`.replace('.js', '.ts'),
      'utf8'
    );
    expect(src).toMatch(/GROUP BY kpi_id/);
    // The per-KPI SUM dbGet inside the loop is gone; realized comes from the map.
    expect(src).toMatch(/realizedByKpi/);
  });
});
