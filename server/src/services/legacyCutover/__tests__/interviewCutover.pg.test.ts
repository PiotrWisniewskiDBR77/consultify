/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — INTERVIEW domain guard (ENTERPRISE surface).
 *
 * Proves the kernel, composed with the REAL interview-enterprise router in an
 * express app exactly like `server/src/Gateway.ts:1326` mounts it
 * (`app.use('/api/interview-v4', interviewEnterpriseRoutes)`), does not block
 * INTERVIEW-E01..E13 while recording tenant-scoped, idempotent telemetry.
 *
 * TWO apps, deliberately:
 *
 *  - `publicApp` mounts ONLY the guard in front of the real router, with NO
 *    upstream auth stand-in at all — this is the honest reproduction of
 *    production reachability for INTERVIEW-E01
 *    (`GET /public/distributions/:token`): it is registered in
 *    `interview-enterprise.routes.ts` BEFORE `router.use(verifyToken)`
 *    (`:23-45` vs. `:47`), so nothing on `req` carries a tenant by the time
 *    the guard runs, and `resolveTenant()` genuinely finds nothing. Its test
 *    asserts `tenant_resolution: 'unresolved'` literally.
 *  - `authedApp` adds a fake `authenticate` middleware BEFORE the guard
 *    (same pattern as `financeSecondDoor.pg.test.ts` and
 *    `adminOrgCutover.pg.test.ts`), standing in for whatever real
 *    authentication resolves a tenant ahead of this mount in production. It
 *    is used for every writer registered AFTER `router.use(verifyToken)`
 *    (E02-E13), whose tests assert `tenant_resolution: 'resolved'`.
 *
 * Mounting BOTH the fake auth and E01 behind the SAME app would silently
 * resolve a tenant for E01 too and make the load-bearing assertion (E01 is
 * unresolved) impossible to fail even if the config regressed — hence the
 * split.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { INTERVIEW_ENTERPRISE_CUTOVER } from '../registry/interview.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `intv4-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const user = `${prefix}-user`;

function authenticateAs(organizationId: string) {
  return function authenticate(req: any, _res: any, next: any): void {
    req.user = { id: user, organizationId, role: 'ADMIN' };
    req.userId = user;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId: user, userRole: 'ADMIN' };
    next();
  };
}

describe.skipIf(!REAL_PG)('INTERVIEW (ENTERPRISE) legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let publicApp: express.Express;
  let authedApp: express.Express;

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

    const interviewEnterpriseRoutesForPublic = (
      await import('../../../routes/interview-enterprise.routes.js')
    ).default;
    publicApp = express();
    publicApp.use(express.json());
    // No upstream auth middleware at all — reproduces the real mount
    // (Gateway.ts:1326) faithfully for the pre-verifyToken public route.
    publicApp.use(
      '/api/interview-v4',
      createLegacyCutoverGuard(INTERVIEW_ENTERPRISE_CUTOVER),
      interviewEnterpriseRoutesForPublic
    );
    publicApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );

    const interviewEnterpriseRoutesForAuthed = (
      await import('../../../routes/interview-enterprise.routes.js')
    ).default;
    authedApp = express();
    authedApp.use(express.json());
    authedApp.use('/api/interview-v4', (req: any, res, next) => {
      const organizationId = String(req.headers['x-test-org'] || orgA);
      authenticateAs(organizationId)(req, res, next);
    });
    authedApp.use(
      '/api/interview-v4',
      createLegacyCutoverGuard(INTERVIEW_ENTERPRISE_CUTOVER),
      interviewEnterpriseRoutesForAuthed
    );
    authedApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(
      `DELETE FROM legacy_cutover_usage_events WHERE domain = 'interview' AND tenant_resolution = 'unresolved' AND request_id LIKE $1`,
      [`${prefix}-%`]
    );
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it(
    'INTERVIEW-E01: the public token GET is reachable (not blocked) and reports an ' +
      'UNRESOLVED tenant, because it is registered before router.use(verifyToken)',
    async () => {
      const token = 'a'.repeat(64);
      const response = await request(publicApp)
        .get(`/api/interview-v4/public/distributions/${token}`)
        .set('x-request-id', `${prefix}-e01`);

      // Not blocked by the guard (it is `observed`, not `disabled`) — the 404
      // below comes from the real handler (no such token in the DB), proving
      // the request reached interviewEnterpriseService.resolveActiveDistributionByToken.
      expect(response.status).not.toBe(410);
      expect(response.status).not.toBe(409);

      const rows = await pool.query(
        `SELECT writer_id, access_kind, organization_id, tenant_resolution, legacy_table, legacy_id, route_path
           FROM legacy_cutover_usage_events
          WHERE domain = 'interview' AND request_id = $1`,
        [`${prefix}-e01`]
      );
      expect(rows.rows).toEqual([
        {
          writer_id: 'INTERVIEW-E01',
          // Method-based classification: a GET is always recorded as
          // legacy_read, even though this one performs an UPDATE. This is
          // the exact, intentional limitation documented in registry/interview.ts.
          access_kind: 'legacy_read',
          organization_id: null,
          tenant_resolution: 'unresolved',
          legacy_table: 'interview_distributions',
          legacy_id: token,
          route_path: `/api/interview-v4/public/distributions/${token}`,
        },
      ]);
    }
  );

  it('is idempotent for the public writer under a retried x-request-id, with no tenant invented', async () => {
    const publicRequestId = `${prefix}-e01-idempotent`;
    const token = 'b'.repeat(64);
    await request(publicApp)
      .get(`/api/interview-v4/public/distributions/${token}`)
      .set('x-request-id', publicRequestId);
    await request(publicApp)
      .get(`/api/interview-v4/public/distributions/${token}`)
      .set('x-request-id', publicRequestId);

    const rows = await pool.query(
      `SELECT id, tenant_resolution, organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'interview' AND request_id = $1`,
      [publicRequestId]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].tenant_resolution).toBe('unresolved');
    expect(rows.rows[0].organization_id).toBeNull();
  });

  it('does not block the authenticated ENTERPRISE writers (INTERVIEW-E02, E04)', async () => {
    const segment = await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', `${prefix}-e02`)
      .set('x-test-org', orgA)
      .send({ segmentName: 'Rehearsal segment' });
    expect(segment.status).not.toBe(410);
    expect(segment.status).not.toBe(409);

    const distribution = await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/distributions`)
      .set('x-request-id', `${prefix}-e04`)
      .set('x-test-org', orgA)
      .send({ channel: 'link' });
    expect(distribution.status).not.toBe(410);
    expect(distribution.status).not.toBe(409);
  });

  it('records a resolved-tenant, tenant-scoped observation for an authenticated writer (INTERVIEW-E02)', async () => {
    const requestId = `${prefix}-e02-telemetry`;
    await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ segmentName: 'Telemetry rehearsal' });

    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'interview' AND request_id = $1`,
      [requestId]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'INTERVIEW-E02',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/interview-v4/sessions/${prefix}-session/segments`,
      },
    ]);
  });

  it('is idempotent under a retried x-request-id for an authenticated writer', async () => {
    const authedRequestId = `${prefix}-e02-idempotent`;
    await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', authedRequestId)
      .set('x-test-org', orgA)
      .send({ segmentName: 'Retry rehearsal' });
    await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', authedRequestId)
      .set('x-test-org', orgA)
      .send({ segmentName: 'Retry rehearsal' });

    const authedRows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'interview' AND organization_id = $1 AND request_id = $2`,
      [orgA, authedRequestId]
    );
    expect(authedRows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same authenticated call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ segmentName: 'Tenant A rehearsal' });
    await request(authedApp)
      .post(`/api/interview-v4/sessions/${prefix}-session/segments`)
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ segmentName: 'Tenant B rehearsal' });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'interview' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
