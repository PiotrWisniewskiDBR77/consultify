/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — RESULTS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/v8/results` router
 * (`server/src/routes/v8/results.routes.ts`) in an express app, does not
 * block RESULTS-W01 (`POST /kpis`), refuses retired RESULTS-W33
 * (`POST /scorecards`) before mutation, and records tenant-scoped,
 * idempotent telemetry for each — and that a plain
 * GET is recorded as `legacy_read`, not a writer access.
 *
 * RESULTS has never had a cutover guard before this lane: mounting it here
 * is the first observation this router has ever had, which is why every
 * registered writer is `protected` or `observed`, never `disabled` (see
 * `../registry/results.ts`).
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { RESULTS_CUTOVER } from '../registry/results.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `results-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;

describe.skipIf(!REAL_PG)('RESULTS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  // results.routes.ts has no router-level auth middleware of its own (unlike
  // meeting.routes.ts) — it reads context via getV8Context(req), which reads
  // req.v8Context directly. So, exactly like financeSecondDoor.pg.test.ts,
  // this sets v8Context (and req.user for the P04-B role gate inside the
  // router) without needing any token bypass.
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
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
       VALUES($1,$2,$3,'unused','ADMIN','active',$4) ON CONFLICT(id) DO NOTHING`,
      [actor, orgA, `${actor}@test.invalid`, now]
    );
    for (const org of [orgA, orgB])
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'ADMIN','ACTIVE',$4) ON CONFLICT(organization_id,user_id) DO NOTHING`,
        [`${prefix}-${org}-membership`, org, actor, now]
      );

    const resultsRouter = (await import('../../../routes/v8/results.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(
      '/api/v8/results',
      authenticate,
      createLegacyCutoverGuard(RESULTS_CUTOVER),
      resultsRouter
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(
      `DELETE FROM kpi_metric_audit_log WHERE organization_id = ANY($1)`,
      [[orgA, orgB]]
    );
    // initiative_kpis.current_definition_version FKs into
    // kpi_definition_versions (fk_initiative_kpis_current_version) — the
    // referencing row must go first.
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(
      `DELETE FROM kpi_definition_versions WHERE organization_id = ANY($1)`,
      [[orgA, orgB]]
    );
    await pool.query(`DELETE FROM kpi_scorecards WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('does not block KPI create (RESULTS-W01)', async () => {
    const response = await request(app)
      .post('/api/v8/results/kpis')
      .set('x-request-id', `${prefix}-kpi-create-1`)
      .send({ name: `${prefix}-kpi` });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(201);
  });

  it('refuses retired scorecard create (RESULTS-W33) with its canonical successor', async () => {
    const response = await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', `${prefix}-scorecard-create-1`)
      .send({ name: `${prefix}-scorecard` });
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: 'RESULTS-W33',
      successor: '/api/vnext/results/kpi/scorecards',
    });

    const legacyRows = await pool.query(
      `SELECT id FROM kpi_scorecards WHERE organization_id = $1 AND name = $2`,
      [orgA, `${prefix}-scorecard`]
    );
    expect(legacyRows.rows).toHaveLength(0);
  });

  it.each([
    {
      writerId: 'RESULTS-W35',
      method: 'post' as const,
      path: '/api/v8/results/scorecards/legacy-card/kpis',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items',
      body: { kpiId: 'legacy-kpi' },
    },
    {
      writerId: 'RESULTS-W36',
      method: 'delete' as const,
      path: '/api/v8/results/scorecards/legacy-card/kpis/legacy-kpi',
      successor: '/api/vnext/results/kpi/scorecards/:scorecardId/items/:itemId',
      body: {},
    },
  ])('refuses retired scorecard item mutation $writerId before handler execution', async (entry) => {
    const requestId = `${prefix}-${entry.writerId.toLowerCase()}`;
    const response = await request(app)
      [entry.method](entry.path)
      .set('x-request-id', requestId)
      .send(entry.body);

    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      code: 'RESULTS_LEGACY_WRITER_DISABLED',
      writerId: entry.writerId,
      successor: entry.successor,
    });

    const mutationRows = await pool.query(
      `SELECT id FROM kpi_scorecard_items
        WHERE organization_id = $1 AND (scorecard_id = $2 OR kpi_id = $3)`,
      [orgA, 'legacy-card', 'legacy-kpi']
    );
    expect(mutationRows.rows).toHaveLength(0);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-kpi-create-1`, `${prefix}-scorecard-create-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'RESULTS-W01',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/v8/results/kpis',
      },
      {
        writer_id: 'RESULTS-W33',
        access_kind: 'legacy_writer_blocked',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/v8/results/scorecards',
      },
    ]);
  });

  it('records a GET as legacy_read, not a writer access', async () => {
    const response = await request(app)
      .get('/api/v8/results/kpis')
      .set('x-request-id', `${prefix}-kpi-list-1`);
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT access_kind, route_path FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-kpi-list-1`]
    );
    expect(rows.rows).toEqual([
      { access_kind: 'legacy_read', route_path: '/api/v8/results/kpis' },
    ]);
  });

  it('keeps the signed legacy scorecard list as an explicit read-only archive', async () => {
    const response = await request(app)
      .get('/api/v8/results/scorecards')
      .set('x-request-id', `${prefix}-scorecard-archive`);

    expect(response.status).toBe(200);
    expect(response.headers['x-consultify-archive-mode']).toBe('read-only');
    expect(response.body.meta).toMatchObject({ archiveMode: 'read_only' });
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .send({ name: `${prefix}-idempotent-scorecard` });
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .send({ name: `${prefix}-idempotent-scorecard` });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ name: `${prefix}-tenant-a-scorecard` });
    await request(app)
      .post('/api/v8/results/scorecards')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ name: `${prefix}-tenant-b-scorecard` });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'results' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
