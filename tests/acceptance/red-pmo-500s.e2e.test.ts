/**
 * RED-PMO — regression guard for schema-500s in the PMO / execution / v8 rewir.
 *
 * ŁOWCA RED (2026-07-19). Discovery probe over every GET endpoint in
 *   routes/pmo/initiatives.routes · routes/pmo/execution.routes ·
 *   routes/v8/results.routes · routes/v8/finance.routes
 * (real routers + real verifyToken + real Postgres PARITY :5443, zero mocks)
 * found six 500s whose root cause is schema drift on demo/parity:
 *
 *   endpoint                                   code    root cause
 *   GET /initiatives/:id/watchers              42P01   table initiative_watchers missing
 *   GET /initiatives/:id/history               42P01   table initiative_history missing
 *   GET /initiatives/:id/comments              42P01   table initiative_comments missing
 *   GET /initiatives/:id/stakeholders          42703   initiative_stakeholders.influence_level missing
 *   GET /execution/:projectId/blockers         42703   initiatives.blocked_reason missing
 *   GET /initiatives/portfolio/rollups         42804   SUM(COALESCE(business_value TEXT, 0)) type clash
 *
 * The first five are fixed by the additive, idempotent migration
 *   server/migrations/20260719_red_pmo_missing_pmo_tables.sql
 * (legacy migrations 247/334/335 never run — the live runner only matches
 *  /^(7\d{2}|\d{8})_.*\.sql$/ and they use SQLite-only syntax). The sixth is a
 * code fix in InitiativeController.getPortfolioRollups (guarded numeric cast).
 *
 * This test applies the migration idempotently, then asserts every previously
 * red endpoint is now non-5xx, and that the write paths that depend on the new
 * columns/tables succeed (201). Reverting either the migration or the code fix
 * turns these back to 5xx.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--redpmo--';
const INIT_ID = `${PREFIX}init-0001`;
const PROJECT_ID = `${PREFIX}project-0001`;

let token: string;
let app: Express;

const MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/migrations/20260719_red_pmo_missing_pmo_tables.sql'
);

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    // Order respects nothing destructive outside the odbior-- prefix.
    await c.query(`DELETE FROM initiative_watchers WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_comments WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_stakeholders WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_milestones WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_budget_items WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiative_raid_items WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiatives WHERE id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => {});
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  process.env.ENABLE_V8_GLOBAL = 'true';
  await seed();

  // Apply the RED-PMO migration idempotently (mirrors the autorun on demo boot).
  const c = pgClient();
  await c.connect();
  try {
    await c.query(readFileSync(MIGRATION, 'utf8'));
    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,$3,'active',$4,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'RedPmo Regression Project', SEED.USER_ID]
    );
    await c.query(
      `INSERT INTO initiatives (id, organization_id, name, status, program_id, business_value)
       VALUES ($1,$2,$3,'DRAFT', NULL, '12345') ON CONFLICT (id) DO NOTHING`,
      [INIT_ID, SEED.ORG_ID, 'RedPmo Regression Initiative']
    );
  } finally {
    await c.end();
  }

  token = mintToken();

  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { v8OrgGate } = await import('../../server/src/middleware/v8FeatureGate.middleware.js');
  const { v8MetricsMiddleware } = await import('../../server/src/middleware/v8Metrics.middleware.js');
  const initiatives = (await import('../../server/src/routes/pmo/initiatives.routes.js')).default;
  const execution = (await import('../../server/src/routes/pmo/execution.routes.js')).default;

  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/pmo/initiatives', verifyToken as any, initiatives);
  app.use('/api/execution', verifyToken as any, execution);
});

afterAll(cleanup);

const authGet = (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`);
const authPost = (p: string, body: any) =>
  request(app).post(p).set('Authorization', `Bearer ${token}`).send(body);

describe('RED-PMO schema-500 regressions (fixed)', () => {
  it('GET /initiatives/:id/watchers is not 5xx (was 42P01: initiative_watchers missing)', async () => {
    const res = await authGet(`/api/pmo/initiatives/${INIT_ID}/watchers`);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('watchers');
  });

  it('GET /initiatives/:id/history is not 5xx (was 42P01: initiative_history missing)', async () => {
    const res = await authGet(`/api/pmo/initiatives/${INIT_ID}/history`);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('events');
  });

  it('GET /initiatives/:id/comments is not 5xx (was 42P01: initiative_comments missing)', async () => {
    const res = await authGet(`/api/pmo/initiatives/${INIT_ID}/comments`);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('comments');
  });

  it('GET /initiatives/:id/stakeholders is not 5xx (was 42703: influence_level missing)', async () => {
    const res = await authGet(`/api/pmo/initiatives/${INIT_ID}/stakeholders`);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('stakeholders');
  });

  it('GET /execution/:projectId/blockers is not 5xx (was 42703: initiatives.blocked_reason missing)', async () => {
    const res = await authGet(`/api/execution/${PROJECT_ID}/blockers`);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /initiatives/portfolio/rollups is not 5xx (was 42804: business_value TEXT summed)', async () => {
    const res = await authGet(`/api/pmo/initiatives/portfolio/rollups`);
    expect(res.status).toBeLessThan(500);
    expect(res.body).toHaveProperty('programs');
  });

  it('write paths that depend on the new columns/tables succeed (201)', async () => {
    const w = await authPost(`/api/pmo/initiatives/${INIT_ID}/watchers`, { userId: SEED.USER_ID });
    expect(w.status).toBe(201); // exercises initiative_watchers + initiative_history INSERT
    const cm = await authPost(`/api/pmo/initiatives/${INIT_ID}/comments`, { content: 'redpmo' });
    expect(cm.status).toBe(201); // exercises initiative_comments INSERT
    const sh = await authPost(`/api/pmo/initiatives/${INIT_ID}/stakeholders`, {
      externalName: 'RedPmo SH', role: 'CONTRIBUTOR', raciType: 'R', influenceLevel: 4, interestLevel: 2,
    });
    expect(sh.status).toBe(201); // exercises influence_level / interest_level columns
  });
});
