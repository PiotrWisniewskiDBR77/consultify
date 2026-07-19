/**
 * RED-PMO2 — regression guard for schema-500s in the "PMO pozostałe" rewir
 * (governance · roadmap · decisions · raid · capacity · stakeholders ·
 *  portfolio-optimization · pmo-roles · workstreams · stage-gates …),
 * explicitly EXCLUDING initiatives.routes + execution.routes (swept in RED-A).
 *
 * ŁOWCA RED (2026-07-19). A discovery probe over all 53 GET endpoints of the
 * rewir (real routers + real verifyToken + real Postgres PARITY :5443, zero
 * mocks) surfaced four 500s, all 42P01 schema drift — three PMO tables that
 * live only in the migrations-v2 baseline dump and were never created on
 * demo/parity by the live migration runner (it only matches
 * /^(7\d{2}|\d{8})_.*\.sql$/, and the baseline dump is not that runner):
 *
 *   endpoint                              code    root cause
 *   GET /governance/change-requests       42P01   change_requests missing
 *   GET /governance/policies              42P01   governance_policies missing
 *   GET /roadmap/:projectId/waves         42P01   roadmap_waves missing
 *   GET /roadmap/:projectId/summary       42P01   roadmap_waves missing
 *
 * All four are fixed by the additive, idempotent migration
 *   server/migrations/20260719_red_pmo2_missing_governance_roadmap_tables.sql
 * (column shapes copied verbatim from the baseline dump).
 *
 * A fifth finding — GET /api/project-members/:projectId returning 503
 * "not_configured" — is NOT fixed here: it is a masked 42703 code bug (the
 * SELECT references project_members.role / .joined_at, but the live table has
 * project_role / created_at). It is reported as RED, not migrated, because the
 * fix is a controller SELECT-contract change, not schema drift. See RAPORT RED.
 *
 * This test applies the migration idempotently, then asserts every previously
 * red endpoint is now non-5xx and that the write paths that INSERT into the new
 * tables succeed (201). Reverting the migration turns these back into 5xx.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--redpmo2--';
const PROJECT_ID = `${PREFIX}project-0001`;

let token: string;
let app: Express;

const MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../server/migrations/20260719_red_pmo2_missing_governance_roadmap_tables.sql'
);

async function cleanup(): Promise<void> {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM roadmap_waves WHERE project_id = $1`, [PROJECT_ID]).catch(() => {});
    await c
      .query(`DELETE FROM change_requests WHERE requester_id = $1 AND title LIKE $2`, [
        SEED.USER_ID,
        `${PREFIX}%`,
      ])
      .catch(() => {});
    await c.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => {});
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  await seed();

  // Apply the RED-PMO2 migration idempotently (mirrors the autorun on demo boot).
  const c = pgClient();
  await c.connect();
  try {
    await c.query(readFileSync(MIGRATION, 'utf8'));
    await c.query(
      `INSERT INTO projects (id, organization_id, name, status, owner_id, created_at)
       VALUES ($1,$2,$3,'active',$4,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING`,
      [PROJECT_ID, SEED.ORG_ID, 'RedPmo2 Regression Project', SEED.USER_ID]
    );
  } finally {
    await c.end();
  }

  token = mintToken();

  const governance = (await import('../../server/src/routes/pmo/governance.routes.js')).default;
  const roadmap = (await import('../../server/src/routes/pmo/roadmap.routes.js')).default;

  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/governance', governance);
  app.use('/api/roadmap', roadmap);
});

afterAll(cleanup);

const authGet = (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`);
const authPost = (p: string, body: any) =>
  request(app).post(p).set('Authorization', `Bearer ${token}`).send(body);

describe('RED-PMO2 schema-500 regressions (fixed by migration)', () => {
  it('GET /governance/change-requests is not 5xx (was 42P01: change_requests missing)', async () => {
    const res = await authGet(`/api/governance/change-requests`);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /governance/policies is not 5xx (was 42P01: governance_policies missing)', async () => {
    const res = await authGet(`/api/governance/policies`);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /roadmap/:projectId/waves is not 5xx (was 42P01: roadmap_waves missing)', async () => {
    const res = await authGet(`/api/roadmap/${PROJECT_ID}/waves`);
    expect(res.status).toBeLessThan(500);
  });

  it('GET /roadmap/:projectId/summary is not 5xx (was 42P01: roadmap_waves missing)', async () => {
    const res = await authGet(`/api/roadmap/${PROJECT_ID}/summary`);
    expect(res.status).toBeLessThan(500);
  });

  it('write paths that INSERT into the new tables succeed (201)', async () => {
    const wave = await authPost(`/api/roadmap/${PROJECT_ID}/waves`, {
      name: `${PREFIX}Wave 1`,
      description: 'redpmo2',
      sequenceOrder: 1,
    });
    expect(wave.status).toBe(201); // exercises roadmap_waves INSERT (all columns present)

    const cr = await authPost(`/api/governance/change-requests`, {
      title: `${PREFIX}CR 1`,
      description: 'redpmo2',
      reason: 'regression',
      impact: 'low',
    });
    expect(cr.status).toBe(201); // exercises change_requests INSERT (all columns present)
  });
});
