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

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { FINANCE_STATEMENTS_CUTOVER } from '../registry/financeStatements.js';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

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
    await cleanupLegacyCutoverTestIntents(pool, {
      organizationIds: [orgA, orgB],
      requestIdPrefix: prefix,
    });
    await pool.query(`DELETE FROM financial_ratio_benchmarks WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('retires FS-W02 by default and restores only that leaf with the exact rollback lever', async () => {
    const blocked = await request(app)
      .post('/api/finance-statements/upload-and-analyze')
      .set('x-request-id', `${prefix}-w02-blocked`);
    expect(blocked.status).toBe(410);
    expect(blocked.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'FS-W02',
      successor: '/api/v8/finance/statements/upload-and-analyze',
    });

    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'FS-W02';
    try {
      const restored = await request(app)
        .post('/api/finance-statements/upload-and-analyze')
        .set('x-request-id', `${prefix}-w02-restored`);
      expect(restored.status).toBe(400);
      expect(restored.body.error).toMatch(/File required/i);
    } finally {
      delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    }
  });

  it.each([
    ['FS-W03', 'post', 'detect', '/api/v8/finance/statements/:statementId/detect'],
    ['FS-W04', 'post', 'extract', '/api/v8/finance/statements/:statementId/extract'],
    ['FS-W05', 'post', 'map', '/api/v8/finance/statements/:statementId/map'],
    ['FS-W06', 'put', 'values', '/api/v8/finance/statements/:statementId/values'],
    ['FS-W07', 'post', 'validate', '/api/v8/finance/statements/:statementId/confirm'],
    ['FS-W08', 'post', 'confirm', '/api/v8/finance/statements/:statementId/confirm'],
  ] as const)(
    'retires %s by default and exposes its governed successor',
    async (writerId, method, action, successor) => {
      const statementId = `${prefix}-${writerId.toLowerCase()}`;
      const response = await request(app)
        [method](`/api/finance-statements/${statementId}/${action}`)
        .set('x-request-id', `${prefix}-${writerId.toLowerCase()}-blocked`)
        .send({});

      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        code: 'FINANCE_LEGACY_WRITER_DISABLED',
        writerId,
        successor,
      });
    }
  );

  it('restores only FS-W08 when its exact writer-scoped rollback lever is enabled', async () => {
    const statementId = `${prefix}-w08-rollback`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'FS-W08';
    try {
      const restored = await request(app)
        .post(`/api/finance-statements/${statementId}/confirm`)
        .set('x-request-id', `${prefix}-w08-restored`)
        .send({});
      expect(restored.status).not.toBe(410);
      expect(restored.status).toBe(400);

      const stillBlocked = await request(app)
        .post(`/api/finance-statements/${statementId}/extract`)
        .set('x-request-id', `${prefix}-w04-still-blocked`)
        .send({});
      expect(stillBlocked.status).toBe(410);
      expect(stillBlocked.body.writerId).toBe('FS-W04');
    } finally {
      delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    }
  });

  it('retires the orphan financial_statement_packs recompute writer (FS-W09)', async () => {
    const response = await request(app)
      .post(`/api/finance-statements/packs/${packId}/recompute`)
      .set('x-request-id', `${prefix}-recompute-1`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
      writerId: 'FS-W09',
    });
  });

  it('retires the unmounted benchmarks upsert writer (FS-W15)', async () => {
    const response = await request(app)
      .put('/api/finance-statements/benchmarks')
      .set('x-request-id', `${prefix}-benchmarks-1`)
      .send({ ratioCode: `${prefix}-roa`, median: 8.2 });
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'FS-W15',
      successor: null,
    });
  });

  it('retires the other unmounted statement mutations without reaching their leaves', async () => {
    const cases = [
      ['post', '/api/finance-statements/upload', 'FS-W01', 410],
      [
        'post',
        `/api/finance-statements/packs/${packId}/statements/missing-statement/assign`,
        'FS-W11',
        409,
      ],
      ['delete', `/api/finance-statements/packs/${packId}`, 'FS-W12', 409],
      ['delete', `/api/finance-statements/missing-statement`, 'FS-W13', 409],
    ] as const;
    for (const [method, route, writerId, status] of cases) {
      const response = await request(app)
        [method](route)
        .set('x-request-id', `${prefix}-${writerId.toLowerCase()}-blocked`)
        .send({});
      expect(response.status).toBe(status);
      expect(response.body.writerId).toBe(writerId);
    }
  });

  it('restores only FS-W15 with its exact writer-scoped rollback lever', async () => {
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'FS-W15';
    try {
      const restored = await request(app)
        .put('/api/finance-statements/benchmarks')
        .set('x-request-id', `${prefix}-w15-restored`)
        .send({ ratioCode: `${prefix}-rollback-roa`, median: 8.2 });
      expect(restored.status).toBe(200);

      const stillBlocked = await request(app)
        .post('/api/finance-statements/upload')
        .set('x-request-id', `${prefix}-w01-still-blocked`)
        .send({});
      expect(stillBlocked.status).toBe(410);
      expect(stillBlocked.body.writerId).toBe('FS-W01');
    } finally {
      delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    }
  });

  it('records one durable, tenant-scoped blocked row per writer', async () => {
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
        access_kind: 'legacy_identity_unmapped',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/finance-statements/packs/${packId}/recompute`,
        legacy_table: 'financial_statement_packs',
        legacy_id: packId,
        successor_path: null,
      },
      {
        writer_id: 'FS-W15',
        access_kind: 'legacy_writer_blocked',
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
      {
        access_kind: 'legacy_read',
        route_path: '/api/finance-statements/benchmarks',
        writer_id: null,
      },
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
