/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — ECONOMICS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/economics` router, blocks
 * ECO-W16/W17 before their legacy handlers mutate anything, while it does not block ECO-W27
 * (`POST /valuations/:id/approve`, the inventory's fourth independent
 * "approve" writer with no protection at all) or ECO-W42 (`PUT
 * /finance-settings`, a collection-level writer) while recording tenant-scoped,
 * idempotent telemetry for each.
 *
 * economics.routes.ts calls the real `verifyToken` middleware internally on
 * every route. No bearer token is sent here, so `ENABLE_TEST_AUTH_BYPASS` is
 * required — `verifyToken` preserves a `req.user` already set by an earlier
 * middleware instead of overwriting it (see
 * `server/src/middleware/auth.middleware.ts:1136-1158`), which is exactly what
 * the `authenticate` middleware below relies on.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createArtifact } from '../../finance/canonical/artifactVersionService.js';
import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { ECONOMICS_CUTOVER } from '../registry/economics.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// economics.routes.ts calls the real verifyToken middleware internally on
// every route. No bearer token is sent here, so without the bypass every call
// would 401 before reaching the leaf handler and this suite would only prove
// the guard runs ahead of authentication, not that the writer itself stays
// reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `econ-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const valuationId = `${prefix}-valuation-1`;
const mappedAnalysisId = `${prefix}-mapped-analysis`;

describe.skipIf(!REAL_PG)('ECONOMICS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;
  let mappedArtifactId: string;
  let mappedBusinessVersionId: string;

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
    const canonical = await createArtifact({
      organizationId: orgA,
      artifactType: 'HISTORICAL_ANALYSIS',
      naturalKey: `cutover-${mappedAnalysisId}`,
      createdBy: actor,
    });
    mappedArtifactId = canonical.artifact.artifact_id;
    mappedBusinessVersionId = canonical.businessVersion.business_version_id;
    await pool.query(
      `INSERT INTO finance_artifact_aliases
        (legacy_table,legacy_id,legacy_version,artifact_id,organization_id,
         business_version_id,mapping_confidence,mapping_reason)
       VALUES('financial_analyses',$1,NULL,$2,$3,$4,'AUTO_MIGRATE','wave2 realPG readback')`,
      [mappedAnalysisId, mappedArtifactId, orgA, mappedBusinessVersionId]
    );

    const economicsRouter = (await import('../../../routes/economics.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(
      '/api/economics',
      authenticate,
      createLegacyCutoverGuard(ECONOMICS_CUTOVER),
      economicsRouter
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, { organizationIds: [orgA, orgB], requestIdPrefix: prefix });
    await pool.query(
      `DELETE FROM organization_settings WHERE organization_id = ANY($1) AND setting_key = 'finance'`,
      [[orgA, orgB]]
    );
    await pool.query('BEGIN');
    await pool.query(`SET LOCAL session_replication_role = replica`);
    await pool.query(`DELETE FROM finance_artifact_aliases WHERE artifact_id=$1`, [mappedArtifactId]);
    await pool.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id=$1`, [mappedArtifactId]);
    await pool.query(
      `UPDATE finance_business_versions SET source_working_revision_id=NULL WHERE artifact_id=$1`,
      [mappedArtifactId]
    );
    await pool.query(`DELETE FROM finance_working_revisions WHERE artifact_id=$1`, [mappedArtifactId]);
    await pool.query(`DELETE FROM finance_business_versions WHERE artifact_id=$1`, [mappedArtifactId]);
    await pool.query(`DELETE FROM finance_artifacts WHERE artifact_id=$1`, [mappedArtifactId]);
    await pool.query(`SET LOCAL session_replication_role = origin`);
    await pool.query('COMMIT');
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('blocks ECO-W16/W17 before either legacy analysis mutation can run', async () => {
    const legacyId = `${prefix}-unmapped-analysis`;
    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );

    const runResponse = await request(app)
      .post(`/api/economics/financial-analyses/${legacyId}/run`)
      .set('x-request-id', `${prefix}-analysis-run-blocked`)
      .send({});
    const approveResponse = await request(app)
      .post(`/api/economics/financial-analyses/${legacyId}/approve`)
      .set('x-request-id', `${prefix}-analysis-approve-blocked`)
      .send({});

    expect(runResponse.status).toBe(409);
    expect(runResponse.body).toMatchObject({
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
      writerId: 'ECO-W16',
    });
    expect(approveResponse.status).toBe(409);
    expect(approveResponse.body).toMatchObject({
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
      writerId: 'ECO-W17',
    });

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );
    expect(after.rows).toEqual(before.rows);

    const usage = await pool.query(
      `SELECT writer_id,access_kind,legacy_table,legacy_id
         FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id IN ($2,$3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-analysis-run-blocked`, `${prefix}-analysis-approve-blocked`]
    );
    expect(usage.rows).toEqual([
      {
        writer_id: 'ECO-W16',
        access_kind: 'legacy_identity_unmapped',
        legacy_table: 'financial_analyses',
        legacy_id: legacyId,
      },
      {
        writer_id: 'ECO-W17',
        access_kind: 'legacy_identity_unmapped',
        legacy_table: 'financial_analyses',
        legacy_id: legacyId,
      },
    ]);
  });

  it('cold-resolves the mapped canonical artifact/BV and still performs zero legacy mutation', async () => {
    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );
    const runResponse = await request(app)
      .post(`/api/economics/financial-analyses/${mappedAnalysisId}/run`)
      .set('x-request-id', `${prefix}-mapped-run`)
      .send({});
    const approveResponse = await request(app)
      .post(`/api/economics/financial-analyses/${mappedAnalysisId}/approve`)
      .set('x-request-id', `${prefix}-mapped-approve`)
      .send({});

    expect(runResponse.status).toBe(410);
    expect(approveResponse.status).toBe(410);
    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );
    expect(after.rows).toEqual(before.rows);

    const coldReadback = await pool.query(
      `SELECT writer_id,access_kind,canonical_artifact_id,canonical_business_version_id
         FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id IN ($2,$3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-mapped-run`, `${prefix}-mapped-approve`]
    );
    expect(coldReadback.rows).toEqual([
      {
        writer_id: 'ECO-W16',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedArtifactId,
        canonical_business_version_id: mappedBusinessVersionId,
      },
      {
        writer_id: 'ECO-W17',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedArtifactId,
        canonical_business_version_id: mappedBusinessVersionId,
      },
    ]);
  });

  it('does not block the valuation approve writer (ECO-W27)', async () => {
    const response = await request(app)
      .post(`/api/economics/valuations/${valuationId}/approve`)
      .set('x-request-id', `${prefix}-approve-1`)
      .send({});
    // No valuation exists for this id, so the leaf handler answers 404 — the
    // point of this assertion is only that the guard let the request through.
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(404);
  });

  it('does not block the finance-settings writer (ECO-W42)', async () => {
    const response = await request(app)
      .put('/api/economics/finance-settings')
      .set('x-request-id', `${prefix}-settings-1`)
      .send({ defaultCurrency: 'EUR' });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
    expect(response.body?.defaultCurrency).toBe('EUR');
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path,
              legacy_table, legacy_id, successor_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND organization_id = $1
          AND request_id IN ($2, $3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-approve-1`, `${prefix}-settings-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'ECO-W27',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/economics/valuations/${valuationId}/approve`,
        legacy_table: 'valuations',
        legacy_id: valuationId,
        successor_path: null,
      },
      {
        writer_id: 'ECO-W42',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/economics/finance-settings',
        legacy_table: null,
        legacy_id: null,
        successor_path: null,
      },
    ]);
  });

  it('records a GET as legacy_read, not a writer access', async () => {
    const response = await request(app)
      .get('/api/economics/finance-settings')
      .set('x-request-id', `${prefix}-settings-get-1`);
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT access_kind, route_path, writer_id FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-settings-get-1`]
    );
    expect(rows.rows).toEqual([
      { access_kind: 'legacy_read', route_path: '/api/economics/finance-settings', writer_id: null },
    ]);
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .put('/api/economics/finance-settings')
      .set('x-request-id', requestId)
      .send({ defaultWacc: 11 });
    await request(app)
      .put('/api/economics/finance-settings')
      .set('x-request-id', requestId)
      .send({ defaultWacc: 11 });

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
      .put('/api/economics/finance-settings')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ defaultCurrency: 'PLN' });
    await request(app)
      .put('/api/economics/finance-settings')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ defaultCurrency: 'PLN' });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'finance' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
