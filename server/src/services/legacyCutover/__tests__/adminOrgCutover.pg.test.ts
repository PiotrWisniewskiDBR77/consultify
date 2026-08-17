/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — ADMIN_ORG domain guard.
 *
 * Proves the kernel, composed with the REAL admin-bulk and adminP32 routers in
 * an express app exactly like `server/src/Gateway.ts` mounts them
 * (`app.use('/api/admin', adminBulkRoutes); app.use('/api/admin', adminP32Routes);`,
 * `Gateway.ts:606-607`), does not block ADMIN_ORG-W05/W06/W07 while still
 * recording tenant-scoped, idempotent telemetry for each of them.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { ADMIN_ORG_CUTOVER } from '../registry/adminOrg.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// admin-bulk.routes.ts and adminP32.routes.ts both call the real verifyToken
// middleware internally (router.use(verifyToken) / router-level per route). No
// bearer token is sent here, so without the bypass every call would 401 before
// reaching the leaf handler and this suite would only prove the guard runs
// ahead of authentication, not that the writer itself stays reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `adminorg-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;

describe.skipIf(!REAL_PG)('ADMIN_ORG legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  function authenticate(req: any, _res: any, next: any): void {
    const organizationId = String(req.headers['x-test-org'] || orgA);
    req.user = {
      id: actor,
      organizationId,
      role: 'SUPERADMIN',
      isSuperAdmin: true,
    };
    req.userId = actor;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId: actor, userRole: 'SUPERADMIN' };
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

    const adminBulkRouter = (await import('../../../routes/admin-bulk.routes.js')).default;
    const adminP32Router = (await import('../../../routes/adminP32.routes.js')).default;

    app = express();
    app.use(express.json());
    // Mounted exactly as Gateway.ts does (two consecutive app.use calls at the
    // same base path), with the guard composed in front of each, matching how
    // the router-local path rules resolve regardless of which mount fires.
    app.use('/api/admin', authenticate, createLegacyCutoverGuard(ADMIN_ORG_CUTOVER), adminBulkRouter);
    app.use('/api/admin', authenticate, createLegacyCutoverGuard(ADMIN_ORG_CUTOVER), adminP32Router);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('does not block bulk-import (ADMIN_ORG-W06)', async () => {
    const response = await request(app)
      .post('/api/admin/users/bulk-import')
      .set('x-request-id', `${prefix}-bulk-import-1`)
      .send({ users: [{ email: `${prefix}-1@example.com`, role: 'USER' }] });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
  });

  it('does not block bulk-role (ADMIN_ORG-W07)', async () => {
    const response = await request(app)
      .post('/api/admin/users/bulk-role')
      .set('x-request-id', `${prefix}-bulk-role-1`)
      .send({ userIds: [`${prefix}-nonexistent-user`], role: 'ADMIN' });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
  });

  it('does not block admin/people (ADMIN_ORG-W05), reachable through both mounts', async () => {
    const response = await request(app)
      .post('/api/admin/people')
      .set('x-request-id', `${prefix}-people-1`)
      .send({ targetEmail: `${prefix}-nonexistent@example.com`, role: 'MEMBER' });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'admin_org' AND organization_id = $1
          AND request_id IN ($2, $3, $4)
        ORDER BY writer_id`,
      [orgA, `${prefix}-bulk-import-1`, `${prefix}-bulk-role-1`, `${prefix}-people-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'ADMIN_ORG-W05',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/admin/people',
      },
      {
        writer_id: 'ADMIN_ORG-W06',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/admin/users/bulk-import',
      },
      {
        writer_id: 'ADMIN_ORG-W07',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/admin/users/bulk-role',
      },
    ]);
  });

  it('is idempotent under a retried x-request-id, even across the double guard mount', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .post('/api/admin/users/bulk-role')
      .set('x-request-id', requestId)
      .send({ userIds: [`${prefix}-nonexistent-user`], role: 'ADMIN' });
    await request(app)
      .post('/api/admin/users/bulk-role')
      .set('x-request-id', requestId)
      .send({ userIds: [`${prefix}-nonexistent-user`], role: 'ADMIN' });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'admin_org' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .post('/api/admin/users/bulk-role')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ userIds: [`${prefix}-nonexistent-user`], role: 'ADMIN' });
    await request(app)
      .post('/api/admin/users/bulk-role')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ userIds: [`${prefix}-nonexistent-user`], role: 'ADMIN' });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'admin_org' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
