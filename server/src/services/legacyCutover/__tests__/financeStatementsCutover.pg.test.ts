/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — FINANCE-STATEMENTS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/finance-statements` router
 * (`server/src/routes/finance-statements.routes.ts` — a full unguarded
 * duplicate of `/api/v8/finance/statements/*`, see `registry/financeStatements.ts`),
 * does not block FS-W09 (`POST /packs/:id/recompute`, a bridge-known
 * `financial_statement_packs` writer) or FS-W15 (`PUT /benchmarks`, a
 * collection-level writer) while recording tenant-scoped, idempotent
 * telemetry for each.
 *
 * finance-statements.routes.ts calls the real `verifyToken`/`isAuthenticated`
 * middleware internally on every route. No bearer token is sent here, so
 * `ENABLE_TEST_AUTH_BYPASS` is required — `verifyToken` preserves a `req.user`
 * already set by an earlier middleware instead of overwriting it (see
 * `server/src/middleware/auth.middleware.ts:1136-1158`), which is exactly what
 * the `authenticate` middleware below relies on.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { FINANCE_STATEMENTS_CUTOVER } from '../registry/financeStatements.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// finance-statements.routes.ts calls the real verifyToken/isAuthenticated
// middleware internally on every route. No bearer token is sent here, so
// without the bypass every call would 401 before reaching the leaf handler
// and this suite would only prove the guard runs ahead of authentication, not
// that the writer itself stays reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `finstmt-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const packId = `${prefix}-pack-1`;

describe.skipIf(!REAL_PG)('FINANCE-STATEMENTS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  function authenticate(req: any, _res: any, next: any): void {
    const organizationId = String(req.headers['x-test-org'] || orgA);
    req.user = { id: actor, organizationId, role: 'admin' };
    req.userId = actor;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId: actor, userRole: 'admin' };
    next();
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const now = new Date().toISOString();
    for (const org of [orgA, orgB]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
        [org, org, now]
      );
    }

    const financeStatementsRouter = (await import('../../../routes/finance-statements.routes.js'))
      .default;
    app = express();
    app.use(express.json());
    app.use(
      '/api/finance-statements',
      authenticate,
      createLegacyCutoverGuard(FINANCE_STATEMENTS_CUTOVER),
      financeStatementsRouter
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(`DELETE FROM financial_ratio_benchmarks WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('does not block the financial_statement_packs recompute writer (FS-W09)', async () => {
    const response = await request(app)
      .post(`/api/finance-statements/packs/${packId}/recompute`)
      .set('x-request-id', `${prefix}-recompute-1`)
      .send({});
    // No pack exists for this id, so the leaf handler answers 404 — the point
    // of this assertion is only that the guard let the request through.
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(404);
  });

  it('does not block the benchmarks upsert writer (FS-W15)', async () => {
    const response = await request(app)
      .put('/api/finance-statements/benchmarks')
      .set('x-request-id', `${prefix}-benchmarks-1`)
      .send({ ratioCode: `${prefix}-roa`, median: 8.2 });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path,
              legacy_table, legacy_id, successor_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-recompute-1`, `${prefix}-benchmarks-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'FS-W09',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/finance-statements/packs/${packId}/recompute`,
        legacy_table: 'financial_statement_packs',
        legacy_id: packId,
        successor_path: null,
      },
      {
        writer_id: 'FS-W15',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/finance-statements/benchmarks',
        legacy_table: null,
        legacy_id: null,
        successor_path: null,
      },
    ]);
  });

  it('records a GET as legacy_read, not a writer access', async () => {
    const response = await request(app)
      .get('/api/finance-statements/benchmarks')
      .set('x-request-id', `${prefix}-benchmarks-get-1`);
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT access_kind, route_path, writer_id FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-benchmarks-get-1`]
    );
    expect(rows.rows).toEqual([
      { access_kind: 'legacy_read', route_path: '/api/finance-statements/benchmarks', writer_id: null },
    ]);
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .put('/api/finance-statements/benchmarks')
      .set('x-request-id', requestId)
      .send({ ratioCode: `${prefix}-idempotent-ratio` });
    await request(app)
      .put('/api/finance-statements/benchmarks')
      .set('x-request-id', requestId)
      .send({ ratioCode: `${prefix}-idempotent-ratio` });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .post(`/api/finance-statements/packs/${packId}/recompute`)
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({});
    await request(app)
      .post(`/api/finance-statements/packs/${packId}/recompute`)
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({});

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
