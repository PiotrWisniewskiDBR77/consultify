/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — the second door to a "retired" Finance writer.
 *
 * FIN-MVP-CUTOVER-001 reported `POST /api/v8/finance/models/:id/approve` as
 * safely retired (1 of 30). It is retired on that mount. But the identical
 * write — the same `approveModel()` in `financialModelingService.ts` — is also
 * reachable at `POST /api/financial-modeling/models/:id/approve`
 * (`server/src/routes/financial-modeling.routes.ts:538`), which had no cutover
 * guard at all, and which two live UI surfaces call directly:
 *   src/components/Economics/hooks/useFinanceRowActions.ts:45
 *   src/components/Economics/FinancePreviewPanel.tsx:73
 *
 * These tests pin both halves of that finding:
 *  - the retired door still refuses, and
 *  - the second door is disabled under its own writer id after both live
 *    clients moved to the canonical successor.
 *
 * The mounted signed-JWT suite owns mapped identity and rollback coverage;
 * this file retains the compact unmapped second-door contract.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { FINANCE_MODELING_CUTOVER, FINANCE_CUTOVER } from '../registry.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `fin2-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const user = `${prefix}-user`;
const modelId = `${prefix}-model`;

describe.skipIf(!REAL_PG)('Finance approve — both doors (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let v8App: express.Express;
  let modelingApp: express.Express;

  function authenticate(request_: any, _res: any, next: any): void {
    request_.user = { id: user, organizationId: org, role: 'ADMIN' };
    request_.userId = user;
    request_.organizationId = org;
    request_.v8Context = { organizationId: org, userId: user, userRole: 'ADMIN' };
    next();
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
       VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
      [org, org, now]
    );

    const financeRouter = (await import('../../../routes/v8/finance.routes.js')).default;
    v8App = express();
    v8App.use(express.json());
    v8App.use(authenticate);
    // The production Finance guard refactor is a separate tranche. Compose the
    // new kernel here to prove its first-door contract without changing that
    // existing service in this commit.
    v8App.use('/api/v8/finance', createLegacyCutoverGuard(FINANCE_CUTOVER), financeRouter);

    // Composed exactly as server/src/Gateway.ts mounts it: the guard sits
    // between authentication and the frozen router, so the router file itself
    // is never edited.
    const modelingRouter = (await import('../../../routes/financial-modeling.routes.js')).default;
    modelingApp = express();
    modelingApp.use(express.json());
    modelingApp.use(authenticate);
    modelingApp.use(
      '/api/financial-modeling',
      createLegacyCutoverGuard(FINANCE_MODELING_CUTOVER),
      modelingRouter
    );
    modelingApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [org], requestIdPrefix: prefix });
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = $1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    await pool.end();
  });

  it('registers the two doors as two distinct writers sharing one successor', () => {
    const first = FINANCE_CUTOVER.writers.find((writer) => writer.writerId === 'FIN-W01');
    const second = FINANCE_MODELING_CUTOVER.writers.find((writer) => writer.writerId === 'FIN-W02');
    expect(first?.successor).toBe(second?.successor);
    expect(first?.legacyTable).toBe(second?.legacyTable);
    expect(first?.state).toBe('disabled');
    expect(second?.state).toBe('disabled');
  });

  it('still refuses the retired first door', async () => {
    const response = await request(v8App)
      .post(`/api/v8/finance/models/${modelId}/approve`)
      .set('x-request-id', `${prefix}-door-1`)
      .send({});
    // No alias exists for this model, so the honest answer is 409 (the record
    // has no canonical counterpart) rather than 410 (use the successor).
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
      writerId: 'FIN-W01',
    });
  });

  it('refuses an unmapped second-door id under its own writer id', async () => {
    const response = await request(modelingApp)
      .post(`/api/financial-modeling/models/${modelId}/approve`)
      .set('x-request-id', `${prefix}-door-2`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
      writerId: 'FIN-W02',
    });

    const rows = await pool.query(
      `SELECT writer_id, access_kind, route_path, organization_id, tenant_resolution,
              legacy_table, legacy_id, identity_status, successor_path
         FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND request_id = $2`,
      [org, `${prefix}-door-2`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'FIN-W02',
        access_kind: 'legacy_identity_unmapped',
        route_path: `/api/financial-modeling/models/${modelId}/approve`,
        organization_id: org,
        tenant_resolution: 'resolved',
        legacy_table: 'financial_models',
        legacy_id: modelId,
        identity_status: 'not_migrated',
        successor_path: '/api/v8/finance-v2/models/:artifactId/approve',
      },
    ]);
  });

  it('keeps the two doors separable in telemetry rather than merging them', async () => {
    const rows = await pool.query(
      `SELECT DISTINCT writer_id, route_path
         FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND writer_id IN ('FIN-W01','FIN-W02')
        ORDER BY writer_id`,
      [org]
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].route_path).not.toBe(rows.rows[1].route_path);
  });
});
