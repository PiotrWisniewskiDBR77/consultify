/**
 * Budget routes — REAL Postgres parity test (fala 3, schema-drift, class 42703).
 *
 * server/src/routes/budget.routes.ts is mounted live at /api/budget (Gateway.ts) and its flat
 * CRUD (root + /summary) writes category/planned_amount/actual_amount columns that do not exist
 * on the real `budgets` table (redesigned into a header+lines model by migration
 * 570_finance_analysis_budgeting_t052_t053). The existing L3 unit test
 * (tests/integration/routes/budget.l3.test.ts) never catches this because it CREATEs its own
 * fantasy flat `budgets` table in SQLite — it gives zero coverage against the real Postgres shape.
 *
 * This test hits the real router against the real parity Postgres schema (after migration
 * 20260719_red_budget_routes_columns.sql, which adds the missing columns + a `title` default)
 * to prove the fix actually works end-to-end, not just via raw SQL.
 *
 * Run against parity Postgres:
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5443/consultinity \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true \
 *   JWT_SECRET=development_secret_key_change_in_production_abc123xyz \
 *   npx vitest run tests/integration/routes/budget.routes.parity.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';

const RUN_REAL_DB = process.env.RUN_DB_TESTS === '1';
const describeRealDb = RUN_REAL_DB ? describe : describe.skip;

describeRealDb('Budget routes (real Postgres parity)', () => {
  const orgId = `org-budget-parity-${Date.now()}`;
  let db: any;
  let resetConnection: () => Promise<void>;
  let app: express.Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'postgres';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();
    await db.query('SELECT 1');

    await db.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [orgId, 'Budget Parity Org']);

    const router = (await import('../../../server/src/routes/budget.routes.ts')).default;
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: 'test-user-id', organizationId: orgId, role: 'ADMIN' };
      next();
    });
    app.use('/api/budget', router);
  });

  afterAll(async () => {
    await db.query('DELETE FROM budgets WHERE organization_id = $1', [orgId]).catch(() => {});
    await db.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {});
    await resetConnection?.();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM budgets WHERE organization_id = $1', [orgId]);
  });

  it('POST / creates a budget against the real schema (no 42703)', async () => {
    const res = await request(app).post('/api/budget').send({
      category: 'capex',
      plannedAmount: 123,
      currency: 'USD',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({ success: true, id: expect.any(String) }));
  });

  it('POST / applies fallback period defaults when omitted (NOT NULL period_start/period_end)', async () => {
    const res = await request(app).post('/api/budget').send({});
    expect(res.status).toBe(201);
  });

  it('GET / lists budgets for the org', async () => {
    await request(app).post('/api/budget').send({ category: 'opex', plannedAmount: 50 });
    const res = await request(app).get('/api/budget');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /summary aggregates planned/actual totals (real SUM on real columns)', async () => {
    await request(app).post('/api/budget').send({ category: 'opex', plannedAmount: 100 });
    await request(app).post('/api/budget').send({ category: 'opex', plannedAmount: 50 });
    const res = await request(app).get('/api/budget/summary');
    expect(res.status).toBe(200);
    expect(Number(res.body.total_planned)).toBe(150);
    expect(Number(res.body.budget_count)).toBe(2);
  });

  it('PUT /:id and DELETE /:id update/remove against the real table', async () => {
    const created = await request(app).post('/api/budget').send({ category: 'opex', plannedAmount: 10 });
    const id = created.body.id;

    const updated = await request(app)
      .put(`/api/budget/${id}`)
      .send({ plannedAmount: 99, actualAmount: 33, category: 'updated' });
    expect(updated.status).toBe(200);

    const list = await request(app).get('/api/budget');
    const row = list.body.find((b: any) => b.id === id);
    expect(row).toEqual(
      expect.objectContaining({ planned_amount: 99, actual_amount: 33, category: 'updated' })
    );

    const del = await request(app).delete(`/api/budget/${id}`);
    expect(del.status).toBe(200);
  });
});
