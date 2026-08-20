/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — ECONOMICS domain guard.
 *
 * Proves the kernel, composed with the REAL `/api/economics` router, blocks
 * ECO-W16/W17 and the canonicalized valuation governance writers ECO-W27/W28
 * before their legacy handlers mutate anything. Unmapped identities fail 409;
 * mapped identities fail 410 with exact successor telemetry. ECO-W42 remains
 * observed and reachable because it has no proven canonical successor.
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
const mappedValuationId = `${prefix}-mapped-valuation`;

describe.skipIf(!REAL_PG)('ECONOMICS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;
  let productionMountedApp: express.Express;
  let mappedArtifactId: string;
  let mappedBusinessVersionId: string;
  let mappedValuationArtifactId: string;
  let mappedValuationBusinessVersionId: string;

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
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Cutover','Actor','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
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
    const valuationCanonical = await createArtifact({
      organizationId: orgA,
      artifactType: 'VALUATION_CASE',
      naturalKey: `cutover-${mappedValuationId}`,
      createdBy: actor,
    });
    mappedValuationArtifactId = valuationCanonical.artifact.artifact_id;
    mappedValuationBusinessVersionId = valuationCanonical.businessVersion.business_version_id;
    await pool.query(
      `INSERT INTO valuations(id,organization_id,title,source_type,currency,status,created_by) VALUES($1,$2,'Wave4 protected','manual','PLN','DRAFT',$3)`,
      [mappedValuationId, orgA, actor]
    );
    await pool.query(
      `UPDATE valuations SET assumptions=$1::jsonb WHERE organization_id=$2 AND id=$3`,
      [
        JSON.stringify({
          horizonYears: 5,
          waccPercent: 10,
          terminalMethod: 'gordon',
          terminalGrowthPercent: 2,
          netDebt: 0,
          manualForecast: {
            years: [
              { year: 2027, fcff: 100 },
              { year: 2028, fcff: 105 },
              { year: 2029, fcff: 110 },
              { year: 2030, fcff: 115 },
              { year: 2031, fcff: 120 },
            ],
          },
        }),
        orgA,
        mappedValuationId,
      ]
    );
    await pool.query(
      `INSERT INTO finance_artifact_aliases
        (legacy_table,legacy_id,legacy_version,artifact_id,organization_id,
         business_version_id,mapping_confidence,mapping_reason)
       VALUES('valuations',$1,NULL,$2,$3,$4,'AUTO_MIGRATE','wave3 valuation cutover')`,
      [mappedValuationId, mappedValuationArtifactId, orgA, mappedValuationBusinessVersionId]
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
    productionMountedApp = express();
    productionMountedApp.use(express.json());
    productionMountedApp.use('/api/economics', authenticate, economicsRouter);
    productionMountedApp.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, {
      organizationIds: [orgA, orgB],
      requestIdPrefix: prefix,
    });
    await pool.query(
      `DELETE FROM organization_settings WHERE organization_id = ANY($1) AND setting_key = 'finance'`,
      [[orgA, orgB]]
    );
    await pool.query('BEGIN');
    await pool.query(`SET LOCAL session_replication_role = replica`);
    await pool.query(`DELETE FROM finance_artifact_aliases WHERE artifact_id = ANY($1)`, [
      [mappedArtifactId, mappedValuationArtifactId],
    ]);
    await pool.query(`DELETE FROM artifact_lifecycle_events WHERE artifact_id = ANY($1)`, [
      [mappedArtifactId, mappedValuationArtifactId],
    ]);
    await pool.query(
      `UPDATE finance_business_versions SET source_working_revision_id=NULL WHERE artifact_id = ANY($1)`,
      [[mappedArtifactId, mappedValuationArtifactId]]
    );
    await pool.query(`DELETE FROM finance_working_revisions WHERE artifact_id = ANY($1)`, [
      [mappedArtifactId, mappedValuationArtifactId],
    ]);
    await pool.query(`DELETE FROM finance_business_versions WHERE artifact_id = ANY($1)`, [
      [mappedArtifactId, mappedValuationArtifactId],
    ]);
    await pool.query(`DELETE FROM finance_artifacts WHERE artifact_id = ANY($1)`, [
      [mappedArtifactId, mappedValuationArtifactId],
    ]);
    await pool.query(`SET LOCAL session_replication_role = origin`);
    await pool.query('COMMIT');
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [actor]);
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

  it('retires duplicate analysis create, update and delete doors before legacy handlers run', async () => {
    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );

    const createResponse = await request(app)
      .post('/api/economics/financial-analyses')
      .set('x-request-id', `${prefix}-analysis-create-retired`)
      .send({ title: 'Must not be created' });
    const deleteResponse = await request(app)
      .delete(`/api/economics/financial-analyses/${mappedAnalysisId}`)
      .set('x-request-id', `${prefix}-analysis-delete-retired`);
    const updateResponse = await request(app)
      .put(`/api/economics/financial-analyses/${mappedAnalysisId}`)
      .set('x-request-id', `${prefix}-analysis-update-retired`)
      .send({ title: 'Must not be updated' });

    expect(createResponse.status).toBe(410);
    expect(createResponse.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'ECO-W14',
      successor: '/api/v8/finance/analyses',
    });
    expect(deleteResponse.status).toBe(410);
    expect(deleteResponse.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'ECO-W21',
      successor: '/api/v8/finance/analyses/:analysisId',
    });
    expect(updateResponse.status).toBe(410);
    expect(updateResponse.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      writerId: 'ECO-W15',
      successor: '/api/v8/finance/analyses/:analysisId',
    });

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM financial_analyses WHERE organization_id=$1`,
      [orgA]
    );
    expect(after.rows).toEqual(before.rows);

    const usage = await pool.query(
      `SELECT writer_id,access_kind,canonical_artifact_id,canonical_business_version_id,successor_path
         FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id IN ($2,$3,$4)
        ORDER BY writer_id`,
      [
        orgA,
        `${prefix}-analysis-create-retired`,
        `${prefix}-analysis-delete-retired`,
        `${prefix}-analysis-update-retired`,
      ]
    );
    expect(usage.rows).toEqual([
      {
        writer_id: 'ECO-W14',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: null,
        canonical_business_version_id: null,
        successor_path: '/api/v8/finance/analyses',
      },
      {
        writer_id: 'ECO-W15',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedArtifactId,
        canonical_business_version_id: mappedBusinessVersionId,
        successor_path: '/api/v8/finance/analyses/:analysisId',
      },
      {
        writer_id: 'ECO-W21',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedArtifactId,
        canonical_business_version_id: mappedBusinessVersionId,
        successor_path: '/api/v8/finance/analyses/:analysisId',
      },
    ]);
  });

  it('fails closed for unmapped ECO-W27/W28 before either valuation legacy mutation', async () => {
    const approve = await request(app)
      .post(`/api/economics/valuations/${valuationId}/approve`)
      .set('x-request-id', `${prefix}-approve-1`)
      .send({});
    const advisor = await request(app)
      .post(`/api/economics/valuations/${valuationId}/advisory`)
      .set('x-request-id', `${prefix}-advisor-1`)
      .send({});
    expect(approve.status).toBe(409);
    expect(approve.body).toMatchObject({
      writerId: 'ECO-W27',
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
    });
    expect(advisor.status).toBe(409);
    expect(advisor.body).toMatchObject({
      writerId: 'ECO-W28',
      code: 'FINANCE_LEGACY_IDENTITY_UNMAPPED',
    });
  });

  it('retires ECO-W22 valuation creation before any legacy or canonical identity is written', async () => {
    const requestId = `${prefix}-valuation-create-retired`;
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM valuations WHERE organization_id=$1) valuations,
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='VALUATION_CASE') artifacts`,
      [orgA]
    );
    const response = await request(productionMountedApp)
      .post('/api/economics/valuations')
      .set('x-request-id', requestId)
      .send({ title: 'Must not be created', sourceType: 'manual' });
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      writerId: 'ECO-W22',
      successor: '/api/v8/finance-v2/valuation/registrations',
    });
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM valuations WHERE organization_id=$1) valuations,
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='VALUATION_CASE') artifacts`,
      [orgA]
    );
    expect(after.rows).toEqual(before.rows);
    const usage = await pool.query(
      `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id=$2`,
      [orgA, requestId]
    );
    expect(usage.rows).toEqual([
      {
        writer_id: 'ECO-W22',
        access_kind: 'legacy_writer_blocked',
        successor_path: '/api/v8/finance-v2/valuation/registrations',
      },
    ]);
  });

  it('restores exactly one ECO-W22 registration through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const requestId = `${prefix}-valuation-create-rollback`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W22';
    let createdId = '';
    try {
      const response = await request(productionMountedApp)
        .post('/api/economics/valuations')
        .set('x-request-id', requestId)
        .set('idempotency-key', requestId)
        .send({ title: 'Rollback valuation', sourceType: 'manual', horizonYears: 5 });
      expect(response.status).toBe(201);
      createdId = String(response.body.id || '');
      expect(createdId).toBeTruthy();

      const receipt = await pool.query<{
        artifact_id: string;
        business_version_id: string;
        working_revision_id: string;
      }>(
        `SELECT artifact_id,business_version_id,working_revision_id
           FROM finance_valuation_registration_command_receipts
          WHERE organization_id=$1 AND idempotency_key=$2`,
        [orgA, requestId]
      );
      expect(receipt.rowCount).toBe(1);
      expect(
        await pool.query(`SELECT id FROM valuations WHERE organization_id=$1 AND id=$2`, [
          orgA,
          createdId,
        ])
      ).toHaveProperty('rowCount', 1);
      const usage = await pool.query(
        `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
          WHERE organization_id=$1 AND request_id=$2`,
        [orgA, requestId]
      );
      expect(usage.rows).toEqual([{ writer_id: 'ECO-W22', access_kind: 'rollback_writer' }]);

      const { artifact_id: artifactId, business_version_id: businessVersionId } = receipt.rows[0];
      const cleanupClient = await pool.connect();
      let caseIds: string[] = [];
      try {
        await cleanupClient.query('BEGIN');
        await cleanupClient.query(`SET LOCAL session_replication_role=replica`);
        await cleanupClient.query(
          `DELETE FROM finance_valuation_registration_command_receipts
            WHERE organization_id=$1 AND idempotency_key=$2`,
          [orgA, requestId]
        );
        await cleanupClient.query(
          `DELETE FROM finance_artifact_aliases WHERE organization_id=$1 AND artifact_id=$2`,
          [orgA, artifactId]
        );
        await cleanupClient.query(
          `DELETE FROM artifact_lifecycle_events WHERE organization_id=$1 AND artifact_id=$2`,
          [orgA, artifactId]
        );
        const cases = await cleanupClient.query<{ case_id: string }>(
          `SELECT case_id FROM finance_valuation_variants WHERE organization_id=$1 AND business_version_id=$2`,
          [orgA, businessVersionId]
        );
        caseIds = cases.rows.map((row) => row.case_id);
        await cleanupClient.query(
          `DELETE FROM finance_valuation_variants WHERE organization_id=$1 AND business_version_id=$2`,
          [orgA, businessVersionId]
        );
        for (const caseId of caseIds) {
          await cleanupClient.query(
            `DELETE FROM finance_valuation_cases WHERE organization_id=$1 AND case_id=$2`,
            [orgA, caseId]
          );
        }
        await cleanupClient.query(
          `DELETE FROM finance_working_revisions WHERE organization_id=$1 AND artifact_id=$2`,
          [orgA, artifactId]
        );
        await cleanupClient.query(
          `DELETE FROM finance_business_versions WHERE organization_id=$1 AND artifact_id=$2`,
          [orgA, artifactId]
        );
        await cleanupClient.query(
          `DELETE FROM finance_artifacts WHERE organization_id=$1 AND artifact_id=$2`,
          [orgA, artifactId]
        );
        await cleanupClient.query(`DELETE FROM valuations WHERE organization_id=$1 AND id=$2`, [
          orgA,
          createdId,
        ]);
        await cleanupClient.query(`SET LOCAL session_replication_role=origin`);
        await cleanupClient.query('COMMIT');
      } catch (error) {
        await cleanupClient.query('ROLLBACK');
        throw error;
      } finally {
        cleanupClient.release();
      }
      const residue = await pool.query(
        `SELECT
          (SELECT count(*)::int FROM valuations WHERE organization_id=$1 AND id=$2) valuations,
          (SELECT count(*)::int FROM finance_valuation_registration_command_receipts WHERE organization_id=$1 AND idempotency_key=$3) receipts,
          (SELECT count(*)::int FROM finance_artifact_aliases WHERE organization_id=$1 AND artifact_id=$4) aliases,
          (SELECT count(*)::int FROM finance_artifacts WHERE organization_id=$1 AND artifact_id=$4) artifacts,
          (SELECT count(*)::int FROM finance_business_versions WHERE organization_id=$1 AND artifact_id=$4) versions,
          (SELECT count(*)::int FROM finance_working_revisions WHERE organization_id=$1 AND artifact_id=$4) revisions,
          (SELECT count(*)::int FROM finance_valuation_variants WHERE organization_id=$1 AND business_version_id=$5) variants,
          (SELECT count(*)::int FROM finance_valuation_cases WHERE organization_id=$1 AND case_id=ANY($6::text[])) cases,
          (SELECT count(*)::int FROM artifact_lifecycle_events WHERE organization_id=$1 AND artifact_id=$4) lifecycle_events`,
        [orgA, createdId, requestId, artifactId, businessVersionId, caseIds]
      );
      expect(residue.rows[0]).toEqual({
        valuations: 0,
        receipts: 0,
        aliases: 0,
        artifacts: 0,
        versions: 0,
        revisions: 0,
        variants: 0,
        cases: 0,
        lifecycle_events: 0,
      });
    } finally {
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('cold-resolves mapped valuation identity and retires both legacy governance writers', async () => {
    const approve = await request(app)
      .post(`/api/economics/valuations/${mappedValuationId}/approve`)
      .set('x-request-id', `${prefix}-mapped-valuation-approve`)
      .send({});
    const advisor = await request(app)
      .post(`/api/economics/valuations/${mappedValuationId}/advisory`)
      .set('x-request-id', `${prefix}-mapped-valuation-advisor`)
      .send({});
    expect(approve.status).toBe(410);
    expect(advisor.status).toBe(410);

    const rows = await pool.query(
      `SELECT writer_id,access_kind,canonical_artifact_id,canonical_business_version_id,successor_path
         FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id IN ($2,$3)
        ORDER BY writer_id`,
      [orgA, `${prefix}-mapped-valuation-approve`, `${prefix}-mapped-valuation-advisor`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'ECO-W27',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedValuationArtifactId,
        canonical_business_version_id: mappedValuationBusinessVersionId,
        successor_path: '/api/v8/finance-v2/models/:artifactId/approve',
      },
      {
        writer_id: 'ECO-W28',
        access_kind: 'legacy_writer_blocked',
        canonical_artifact_id: mappedValuationArtifactId,
        canonical_business_version_id: mappedValuationBusinessVersionId,
        successor_path: '/api/v8/finance-v2/valuation/variants/:businessVersionId/advisor/generate',
      },
    ]);
  });

  it('blocks depth, compute, negotiation pack, typed assumptions and peers legacy doors before mutation with exact telemetry', async () => {
    const before = await pool.query(`SELECT assumptions,peers,negotiation_pack FROM valuations WHERE id=$1`, [
      mappedValuationId,
    ]);
    const assumptions = await request(app)
      .put(`/api/economics/valuations/${mappedValuationId}/assumptions`)
      .set('x-request-id', `${prefix}-wave4-assumptions`)
      .send({ waccPercent: 99 });
    const peers = await request(app)
      .put(`/api/economics/valuations/${mappedValuationId}/peers`)
      .set('x-request-id', `${prefix}-wave4-peers`)
      .send({ peerSet: ['MUTATION'] });
    const depth = await request(app)
      .put(`/api/economics/valuations/${mappedValuationId}/depth`)
      .set('x-request-id', `${prefix}-wave8-depth`)
      .send({ depth: 'managerial' });
    const compute = await request(app)
      .post(`/api/economics/valuations/${mappedValuationId}/compute`)
      .set('x-request-id', `${prefix}-wave9-compute`)
      .send({});
    const negotiation = await request(app)
      .post(`/api/economics/valuations/${mappedValuationId}/negotiation-pack`)
      .set('x-request-id', `${prefix}-wave10-negotiation`)
      .send({});
    expect(assumptions.status).toBe(410);
    expect(peers.status).toBe(410);
    expect(depth.status).toBe(410);
    expect(compute.status).toBe(410);
    expect(negotiation.status).toBe(410);
    expect(depth.body).toMatchObject({
      writerId: 'ECO-W23',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/depth',
    });
    expect(compute.body).toMatchObject({
      writerId: 'ECO-W26',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/compute',
    });
    expect(negotiation.body).toMatchObject({writerId:'ECO-W29',successor:'/api/v8/finance-v2/valuation/legacy/:legacyId/negotiation-pack'});
    expect(assumptions.body).toMatchObject({
      writerId: 'ECO-W24',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/assumptions',
    });
    expect(peers.body).toMatchObject({
      writerId: 'ECO-W25',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/peers',
    });
    const after = await pool.query(`SELECT assumptions,peers,negotiation_pack FROM valuations WHERE id=$1`, [
      mappedValuationId,
    ]);
    expect(after.rows).toEqual(before.rows);
  });

  it('restores only ECO-W29 through the writer-scoped rollback lever',async()=>{
    const previous=process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS='ECO-W29';
    try{
      await pool.query(`UPDATE valuations SET status='APPROVED',negotiation_pack=NULL,results=$3::jsonb WHERE organization_id=$1 AND id=$2`,[orgA,mappedValuationId,JSON.stringify({dcf:{enterpriseValue:1000,discountRatePercent:11,terminalMethod:'gordon'},tornado:[{driver:'WACC'}]})]);
      const requestId=`${prefix}-wave10-negotiation-rollback`;
      const response=await request(app).post(`/api/economics/valuations/${mappedValuationId}/negotiation-pack`).set('x-request-id',requestId).send({});
      expect(response.status).toBe(200);expect(response.body).toMatchObject({success:true});
      const legacy=await pool.query(`SELECT negotiation_pack FROM valuations WHERE organization_id=$1 AND id=$2`,[orgA,mappedValuationId]);
      expect(legacy.rows[0].negotiation_pack).toMatchObject({valuationId:mappedValuationId});
      const event=await pool.query(`SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events WHERE organization_id=$1 AND request_id=$2`,[orgA,requestId]);
      expect(event.rows).toEqual([{writer_id:'ECO-W29',access_kind:'rollback_writer',successor_path:'/api/v8/finance-v2/valuation/legacy/:legacyId/negotiation-pack'}]);
      const canonical=await pool.query(`SELECT idempotency_key FROM finance_valuation_negotiation_pack_receipts WHERE organization_id=$1 AND legacy_valuation_id=$2`,[orgA,mappedValuationId]);expect(canonical.rows).toHaveLength(0);
    }finally{
      await pool.query(`UPDATE valuations SET status='DRAFT' WHERE organization_id=$1 AND id=$2`,[orgA,mappedValuationId]);
      if(previous===undefined)delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS=previous;
    }
  });

  it('restores only ECO-W23 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W23';
    try {
      const response = await request(app)
        .put(`/api/economics/valuations/${mappedValuationId}/depth`)
        .set('x-request-id', `${prefix}-wave8-depth-rollback`)
        .send({ depth: 'banking' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true, depth: 'banking' });
      const legacy = await pool.query(
        `SELECT assumptions FROM valuations WHERE organization_id=$1 AND id=$2`,
        [orgA, mappedValuationId]
      );
      expect(legacy.rows[0].assumptions.depth).toBe('banking');
      const event = await pool.query(
        `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
          WHERE organization_id=$1 AND request_id=$2`,
        [orgA, `${prefix}-wave8-depth-rollback`]
      );
      expect(event.rows).toEqual([
        {
          writer_id: 'ECO-W23',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance-v2/valuation/legacy/:legacyId/depth',
        },
      ]);
      const canonical = await pool.query(
        `SELECT idempotency_key FROM finance_valuation_depth_command_receipts
          WHERE organization_id=$1 AND legacy_valuation_id=$2`,
        [orgA, mappedValuationId]
      );
      expect(canonical.rows).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('restores only ECO-W26 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W26';
    try {
      const response = await request(app)
        .post(`/api/economics/valuations/${mappedValuationId}/compute`)
        .set('x-request-id', `${prefix}-wave9-compute-rollback`)
        .send({});
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      const legacy = await pool.query(
        `SELECT results FROM valuations WHERE organization_id=$1 AND id=$2`,
        [orgA, mappedValuationId]
      );
      expect(legacy.rows[0].results).toBeTruthy();
      const event = await pool.query(
        `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
          WHERE organization_id=$1 AND request_id=$2`,
        [orgA, `${prefix}-wave9-compute-rollback`]
      );
      expect(event.rows).toEqual([
        {
          writer_id: 'ECO-W26',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance-v2/valuation/legacy/:legacyId/compute',
        },
      ]);
      const canonical = await pool.query(
        `SELECT idempotency_key FROM finance_valuation_compute_command_receipts
          WHERE organization_id=$1 AND business_version_id=$2`,
        [orgA, mappedValuationBusinessVersionId]
      );
      expect(canonical.rows).toHaveLength(0);
    } finally {
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
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
          AND request_id IN ($2, $3, $4)
        ORDER BY writer_id`,
      [orgA, `${prefix}-approve-1`, `${prefix}-advisor-1`, `${prefix}-settings-1`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'ECO-W27',
        access_kind: 'legacy_identity_unmapped',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/economics/valuations/${valuationId}/approve`,
        legacy_table: 'valuations',
        legacy_id: valuationId,
        successor_path: '/api/v8/finance-v2/models/:artifactId/approve',
      },
      {
        writer_id: 'ECO-W28',
        access_kind: 'legacy_identity_unmapped',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: `/api/economics/valuations/${valuationId}/advisory`,
        legacy_table: 'valuations',
        legacy_id: valuationId,
        successor_path: '/api/v8/finance-v2/valuation/variants/:businessVersionId/advisor/generate',
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
      {
        access_kind: 'legacy_read',
        route_path: '/api/economics/finance-settings',
        writer_id: null,
      },
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
