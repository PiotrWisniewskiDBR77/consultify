/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — MEETINGS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/meeting` router
 * (`server/src/routes/meeting.routes.ts`) in an express app, does not block
 * MEETINGS-W01 (`POST /`, meeting create) or MEETINGS-W05 (`POST
 * /:id/decisions`, the ungoverned manual-decision writer that is this
 * domain's split-brain pair against `meeting_notes.decisions_json`) while
 * recording tenant-scoped, idempotent telemetry for each.
 *
 * meeting.routes.ts mounts its own `verifyToken`/`isAuthenticated`/`betaGate`
 * chain internally (lines 72-77), unlike results.routes.ts. No bearer token
 * is sent here, so `ENABLE_TEST_AUTH_BYPASS` is required — `verifyToken`
 * preserves a `req.user` already set by an earlier middleware instead of
 * overwriting it (see `server/src/middleware/auth.middleware.ts:1136-1158`),
 * which is exactly what the `authenticate` middleware below relies on.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { MEETINGS_CUTOVER } from '../registry/meetings.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// meeting.routes.ts calls the real verifyToken/isAuthenticated middleware
// internally (router.use, meeting.routes.ts:72-73). No bearer token is sent
// here, so without the bypass every call would 401 before reaching the leaf
// handler and this suite would only prove the guard runs ahead of
// authentication, not that the writer itself stays reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `meetings-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;

describe.skipIf(!REAL_PG)('MEETINGS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;
  let meetingIdOrgA: string;

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

    const meetingRouter = (await import('../../../routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', authenticate, createLegacyCutoverGuard(MEETINGS_CUTOVER), meetingRouter);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );

    // Fixture meeting for the decisions/follow-ups writers below, created
    // through the same guarded app so it is org-scoped identically.
    const created = await request(app)
      .post('/api/meeting')
      .set('x-request-id', `${prefix}-fixture-meeting`)
      .send({ title: `${prefix}-fixture`, startAt: now });
    meetingIdOrgA = created.body?.meeting?.id;
    expect(meetingIdOrgA).toBeTruthy();
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(`DELETE FROM meeting_follow_ups WHERE meeting_id IN (
      SELECT id FROM meetings WHERE organization_id = ANY($1)
    )`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM meetings WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('does not block meeting create (MEETINGS-W01)', async () => {
    const response = await request(app)
      .post('/api/meeting')
      .set('x-request-id', `${prefix}-meeting-create-1`)
      .send({ title: `${prefix}-meeting-1`, startAt: new Date().toISOString() });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(201);
  });

  it('does not block the ungoverned manual-decision writer (MEETINGS-W05)', async () => {
    const response = await request(app)
      .post(`/api/meeting/${meetingIdOrgA}/decisions`)
      .set('x-request-id', `${prefix}-decision-1`)
      .send({ decision: `${prefix}-decision text` });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(201);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'meetings' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-meeting-create-1`, `${prefix}-decision-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'MEETINGS-W01',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        // Root-mounted routes ('/') carry req.path === '/', so the kernel's
        // recorded path is `baseUrl + routePath` = '/api/meeting' + '/'.
        route_path: '/api/meeting/',
      },
      {
        writer_id: 'MEETINGS-W05',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/meeting/${meetingIdOrgA}/decisions`,
      },
    ]);
  });

  it('records a GET as legacy_read, not a writer access', async () => {
    const response = await request(app)
      .get('/api/meeting')
      .set('x-request-id', `${prefix}-meeting-list-1`);
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT access_kind, route_path FROM legacy_cutover_usage_events
        WHERE domain = 'meetings' AND organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-meeting-list-1`]
    );
    expect(rows.rows).toEqual([{ access_kind: 'legacy_read', route_path: '/api/meeting/' }]);
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .post(`/api/meeting/${meetingIdOrgA}/decisions`)
      .set('x-request-id', requestId)
      .send({ decision: `${prefix}-idempotent decision` });
    await request(app)
      .post(`/api/meeting/${meetingIdOrgA}/decisions`)
      .set('x-request-id', requestId)
      .send({ decision: `${prefix}-idempotent decision` });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'meetings' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .post('/api/meeting')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ title: `${prefix}-tenant-a-meeting`, startAt: new Date().toISOString() });
    await request(app)
      .post('/api/meeting')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ title: `${prefix}-tenant-b-meeting`, startAt: new Date().toISOString() });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'meetings' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
