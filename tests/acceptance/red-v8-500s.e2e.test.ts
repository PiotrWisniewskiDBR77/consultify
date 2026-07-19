/**
 * RED-V8 schema-500 regression — rewir: routery server/src/routes/v8/*.
 *
 * Finding (odbiór 2026-07-19): `initiatives.actual_end_date` is referenced by 5
 * code paths (execution-control baseline-variance + timeline-update,
 * planningPortfolioReadService, delay/risk detection, initiativeLifecycleCanon)
 * but is ABSENT from the demo/parity schema. Because DbPromise.all() defaults to
 * `fallback=true`, the resulting Postgres 42703 (undefined_column) is swallowed
 * and the query resolves to `[]` — so the failure surfaces as a MASKED 404
 * ("Initiative not found") for an initiative that demonstrably exists, and as a
 * silent-undefined `actualEndDate` in the planning portfolio. i.e. a schema-500
 * hiding behind a 404 / empty field.
 *
 * Fix: additive idempotent migration
 * server/migrations/20260719_red_v8_initiatives_actual_end_date.sql
 * (ADD COLUMN IF NOT EXISTS actual_end_date TIMESTAMP). schema.mjs applies all
 * server/migrations/*.sql, so this harness DB has the column.
 *
 * Assertions below prove the FIXED contract (2xx + real data). Pre-fix, both
 * endpoints returned the masked 404 for an existing initiative.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const EC = '/api/v8/execution-control';
const INIT_ID = 'odbior--redv8--init-0001';
let token: string;

async function mountEC(): Promise<Express> {
  const { default: verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { default: router } = await import(
    '../../server/src/routes/v8/execution-control.routes.js'
  );
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(EC, verifyToken as any, requireV8OrgContext as any, attachV8Context as any, router);
  return app;
}

beforeAll(async () => {
  await seed();
  token = mintToken();
  const c = pgClient();
  await c.connect();
  try {
    // Guard: the whole point of the fix is this column existing. If a stale
    // schema is loaded without the migration, make the intent explicit.
    await c.query(
      `ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS actual_end_date TIMESTAMP WITHOUT TIME ZONE`
    );
    await c.query(
      `INSERT INTO initiatives (id, organization_id, name, status, progress,
         planned_start_date, planned_end_date, forecast_start_date, forecast_end_date)
       VALUES ($1, $2, 'RedV8 Baseline Initiative', 'EXECUTING', 40,
         '2026-06-01', '2026-08-01', '2026-06-05', '2026-08-15')
       ON CONFLICT (id) DO NOTHING`,
      [INIT_ID, SEED.ORG_ID]
    );
  } finally {
    await c.end();
  }
}, 60_000);

afterAll(async () => {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM execution_audit_log WHERE initiative_id = $1`, [INIT_ID]).catch(() => {});
    await c.query(`DELETE FROM initiatives WHERE id = $1`, [INIT_ID]).catch(() => {});
  } finally {
    await c.end();
  }
});

describe('RED-V8: initiatives.actual_end_date schema-500 (masked 404)', () => {
  it('GET /baseline-variance/:initiativeId — 200 (was masked 404 via swallowed 42703)', async () => {
    const app = await mountEC();
    const res = await request(app)
      .get(`${EC}/baseline-variance/${INIT_ID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.data?.initiativeId).toBe(INIT_ID);
    // Must NOT be the masked not-found path for an initiative that exists.
    expect(res.body?.code).not.toBe('EXECUTION_INITIATIVE_NOT_FOUND');
  }, 20_000);

  it("POST /timeline-update field='actual_end_date' — 200 write (was masked 404)", async () => {
    const app = await mountEC();
    const res = await request(app)
      .post(`${EC}/timeline-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({ initiativeId: INIT_ID, field: 'actual_end_date', value: '2026-09-01 00:00:00', reason: 'redv8-regression' });
    expect(res.status).toBe(200);
    expect(res.body?.data?.success).toBe(true);
    expect(res.body?.data?.field).toBe('actual_end_date');

    // Read-back proves the write landed in the real column, not a swallowed no-op.
    const c = pgClient();
    await c.connect();
    try {
      const r = await c.query(`SELECT actual_end_date FROM initiatives WHERE id = $1`, [INIT_ID]);
      expect(r.rows[0]?.actual_end_date).toBeTruthy();
    } finally {
      await c.end();
    }
  }, 20_000);
});
