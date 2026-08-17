/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — AUDITS domain guard.
 *
 * Two things are proven here, matching the two halves of registry/audits.ts:
 *
 *  1. The already-retired `audit_programs` CRUD trio
 *     (`audit-programs.routes.ts`) still refuses when this guard is composed
 *     in front of the REAL router — the guard's own `disabled` state agrees
 *     with the domain's independent `isLegacyProgramWriteEnabled()`
 *     kill-switch rather than contradicting it.
 *  2. The never-retired `audits` table writers (`audit.routes.ts`) are NOT
 *     blocked by the guard, and produce tenant-scoped, idempotent telemetry —
 *     one row per call, one row per retried `x-request-id`, one row per
 *     tenant when two tenants share a request id.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { AUDITS_CUTOVER } from '../registry/audits.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `audits-${randomUUID().slice(0, 8)}`;
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

describe.skipIf(!REAL_PG)('AUDITS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let programsApp: express.Express;
  let auditsApp: express.Express;

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

    // AUDITS-W03..W06: the already-retired audit-programs.routes.ts CRUD
    // trio. The guard is mounted BEFORE the router, so a disabled writer is
    // refused before ever reaching the router's own
    // apiAuthRateLimiter/verifyToken/requireOrgAccess stack.
    const auditProgramsRouter = (await import('../../../routes/audit-programs.routes.js')).default;
    programsApp = express();
    programsApp.use(express.json());
    programsApp.use(
      '/api/audit',
      authenticateAs(orgA),
      createLegacyCutoverGuard(AUDITS_CUTOVER),
      auditProgramsRouter
    );
    programsApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );

    // AUDITS-W01/W02: the never-retired `audits` table writers.
    const auditRoutes = (await import('../../../routes/audit.routes.js')).default;
    auditsApp = express();
    auditsApp.use(express.json());
    auditsApp.use('/api/audit', (req: any, res, next) => {
      // Per-request tenant selection via header, so the same mounted app can
      // serve both tenants in the isolation test below (mirrors
      // adminOrgCutover.pg.test.ts's x-test-org pattern).
      const organizationId = String(req.headers['x-test-org'] || orgA);
      authenticateAs(organizationId)(req, res, next);
    });
    auditsApp.use('/api/audit', createLegacyCutoverGuard(AUDITS_CUTOVER), auditRoutes);
    auditsApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it(
    'does not gate the already-retired audit_programs CRUD trio a second time ' +
      '(AUDITS-W03/W04/W05/W06 are `enforcedBy: domain` — the kernel observes, ' +
      "it does not re-block behind a lever that cannot restore the route)",
    async () => {
      const create = await request(programsApp)
        .post('/api/audit/programs')
        .set('x-request-id', `${prefix}-w03`)
        .send({ name: 'Rehearsal program' });
      // Not the kernel's own refusal shape — whatever status comes back is the
      // real router's (here: 401 from its own verifyToken, since this test's
      // fake auth carries no real JWT). The point is the kernel did not answer
      // with ITS OWN 410/AUDITS_LEGACY_WRITER_DISABLED body.
      expect(create.body.code).not.toBe('AUDITS_LEGACY_WRITER_DISABLED');

      const update = await request(programsApp)
        .patch(`/api/audit/programs/${prefix}-model`)
        .set('x-request-id', `${prefix}-w04`)
        .send({ name: 'x' });
      expect(update.body.code).not.toBe('AUDITS_LEGACY_WRITER_DISABLED');

      const del = await request(programsApp)
        .delete(`/api/audit/programs/${prefix}-model`)
        .set('x-request-id', `${prefix}-w05`);
      expect(del.body.code).not.toBe('AUDITS_LEGACY_WRITER_DISABLED');

      const generate = await request(programsApp)
        .post(`/api/audit/programs/${prefix}-model/generate-surveys`)
        .set('x-request-id', `${prefix}-w06`)
        .send({});
      expect(generate.body.code).not.toBe('AUDITS_LEGACY_WRITER_DISABLED');

      const rows = await pool.query(
        `SELECT writer_id, access_kind, tenant_resolution, organization_id
           FROM legacy_cutover_usage_events
          WHERE domain = 'audits' AND organization_id = $1
            AND request_id IN ($2, $3, $4, $5)
          ORDER BY writer_id`,
        [orgA, `${prefix}-w03`, `${prefix}-w04`, `${prefix}-w05`, `${prefix}-w06`]
      );
      // Recorded, tenant-resolved, and NOT `legacy_writer_blocked` — the kernel
      // never decided to refuse these, matching `enforcedBy: 'domain'`.
      expect(rows.rows).toEqual([
        { writer_id: 'AUDITS-W03', access_kind: 'legacy_uncovered_writer', tenant_resolution: 'resolved', organization_id: orgA },
        { writer_id: 'AUDITS-W04', access_kind: 'legacy_uncovered_writer', tenant_resolution: 'resolved', organization_id: orgA },
        { writer_id: 'AUDITS-W05', access_kind: 'legacy_uncovered_writer', tenant_resolution: 'resolved', organization_id: orgA },
        { writer_id: 'AUDITS-W06', access_kind: 'legacy_uncovered_writer', tenant_resolution: 'resolved', organization_id: orgA },
      ]);
    }
  );

  it('does not block AUDITS-W01 (POST) or AUDITS-W02 (PUT) on the never-retired `audits` table', async () => {
    const created = await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', `${prefix}-w01-basic`)
      .set('x-test-org', orgA)
      .send({ name: 'Rehearsal audit' });
    expect(created.status).not.toBe(410);
    expect(created.status).not.toBe(409);

    const updated = await request(auditsApp)
      .put(`/api/audit/${prefix}-audit`)
      .set('x-request-id', `${prefix}-w02-basic`)
      .set('x-test-org', orgA)
      .send({ status: 'completed' });
    expect(updated.status).not.toBe(410);
    expect(updated.status).not.toBe(409);
  });

  it('records one durable, tenant-scoped observation row per writer, right access_kind for write vs. read', async () => {
    // A write (POST /api/audit, AUDITS-W01) ...
    await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', `${prefix}-telemetry-write`)
      .set('x-test-org', orgA)
      .send({ name: 'Telemetry rehearsal' });

    // ... and a GET, which the kernel classifies as legacy_read regardless of
    // whether a writer rule matched (no reader is registered in
    // AUDITS_CUTOVER, so writer_id is honestly null here).
    await request(auditsApp)
      .get('/api/audit')
      .set('x-request-id', `${prefix}-telemetry-read`)
      .set('x-test-org', orgA);

    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'audits' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY access_kind`,
      [orgA, `${prefix}-telemetry-write`, `${prefix}-telemetry-read`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: null,
        access_kind: 'legacy_read',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        // Root of the mounted router: baseUrl ('/api/audit') + router-local
        // path ('/') concatenates to a trailing slash, confirmed empirically.
        route_path: '/api/audit/',
      },
      {
        writer_id: 'AUDITS-W01',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/audit/',
      },
    ]);
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ name: 'Retry rehearsal' });
    await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ name: 'Retry rehearsal' });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'audits' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ name: 'Tenant A rehearsal' });
    await request(auditsApp)
      .post('/api/audit')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ name: 'Tenant B rehearsal' });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'audits' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
