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
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createArtifact } from '../../finance/canonical/artifactVersionService.js';
import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { ECONOMICS_CUTOVER } from '../registry/economics.js';
import { exportsDir } from '../../../utils/storagePaths.js';

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

  it('blocks discard, depth, compute, negotiation pack, PPTX export, typed assumptions and peers legacy doors before mutation with exact telemetry', async () => {
    const before = await pool.query(
      `SELECT status,assumptions,peers,negotiation_pack,export_path,exported_at,
        (SELECT count(*)::int FROM valuation_snapshots WHERE valuation_id=$1) AS snapshot_count
       FROM valuations WHERE id=$1`,
      [mappedValuationId]
    );
    const discard = await request(app)
      .delete(`/api/economics/valuations/${mappedValuationId}`)
      .set('x-request-id', `${prefix}-wave12-discard`);
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
    const pptx = await request(app)
      .post(`/api/economics/valuations/${mappedValuationId}/export/pptx`)
      .set('x-request-id', `${prefix}-wave11-pptx`)
      .send({ language: 'en', theme: 'corporate', confidentiality: 'internal' });
    expect(assumptions.status).toBe(410);
    expect(peers.status).toBe(410);
    expect(depth.status).toBe(410);
    expect(compute.status).toBe(410);
    expect(negotiation.status).toBe(410);
    expect(pptx.status).toBe(410);
    expect(discard.status).toBe(410);
    expect(discard.body).toMatchObject({
      writerId: 'ECO-W32',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId',
    });
    expect(depth.body).toMatchObject({
      writerId: 'ECO-W23',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/depth',
    });
    expect(compute.body).toMatchObject({
      writerId: 'ECO-W26',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/compute',
    });
    expect(negotiation.body).toMatchObject({
      writerId: 'ECO-W29',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/negotiation-pack',
    });
    expect(pptx.body).toMatchObject({
      writerId: 'ECO-W31',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/export/pptx',
    });
    expect(assumptions.body).toMatchObject({
      writerId: 'ECO-W24',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/assumptions',
    });
    expect(peers.body).toMatchObject({
      writerId: 'ECO-W25',
      successor: '/api/v8/finance-v2/valuation/legacy/:legacyId/peers',
    });
    const after = await pool.query(
      `SELECT status,assumptions,peers,negotiation_pack,export_path,exported_at,
        (SELECT count(*)::int FROM valuation_snapshots WHERE valuation_id=$1) AS snapshot_count
       FROM valuations WHERE id=$1`,
      [mappedValuationId]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('restores only ECO-W32 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const rollbackId = `${prefix}-wave12-rollback`;
    const requestId = `${prefix}-wave12-discard-rollback`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W32';
    try {
      await pool.query(
        `INSERT INTO valuations(id,organization_id,title,source_type,currency,status,created_by)
         VALUES($1,$2,'Wave12 rollback only','manual','PLN','DRAFT',$3)`,
        [rollbackId, orgA, actor]
      );
      await pool.query(
        `INSERT INTO valuation_snapshots(id,valuation_id,version,snapshot_data,approved_by)
         VALUES($1,$2,1,'{}'::jsonb,$3)`,
        [randomUUID(), rollbackId, actor]
      );
      const response = await request(app)
        .delete(`/api/economics/valuations/${rollbackId}`)
        .set('x-request-id', requestId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, deleted: rollbackId });
      expect(
        (await pool.query(`SELECT id FROM valuations WHERE id=$1`, [rollbackId])).rows
      ).toHaveLength(0);
      expect(
        (await pool.query(`SELECT id FROM valuation_snapshots WHERE valuation_id=$1`, [rollbackId]))
          .rows
      ).toHaveLength(0);
      expect(
        (
          await pool.query(
            `SELECT idempotency_key FROM finance_valuation_discard_receipts WHERE organization_id=$1 AND legacy_valuation_id=$2`,
            [orgA, rollbackId]
          )
        ).rows
      ).toHaveLength(0);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([
        {
          writer_id: 'ECO-W32',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance-v2/valuation/legacy/:legacyId',
        },
      ]);
    } finally {
      await pool.query(`DELETE FROM valuation_snapshots WHERE valuation_id=$1`, [rollbackId]);
      await pool.query(`DELETE FROM valuations WHERE organization_id=$1 AND id=$2`, [
        orgA,
        rollbackId,
      ]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('retires ECO-W33 create with no budget aggregate mutation', async () => {
    const requestId = `${prefix}-budget-create-retired`;
    const before = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM budgets WHERE organization_id=$1) budgets,
        (SELECT count(*)::int FROM budget_lines WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)) lines,
        (SELECT count(*)::int FROM budget_scenarios WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)) scenarios`,
      [orgA]
    );
    const response = await request(productionMountedApp)
      .post('/api/economics/budgets')
      .set('x-request-id', requestId)
      .send({ title: 'Blocked budget', periodStart: '2028-01-01', periodEnd: '2028-12-31' });
    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      writerId: 'ECO-W33',
      successor: '/api/v8/finance/budgets',
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
    });
    expect(
      (
        await pool.query(
          `SELECT
        (SELECT count(*)::int FROM budgets WHERE organization_id=$1) budgets,
        (SELECT count(*)::int FROM budget_lines WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)) lines,
        (SELECT count(*)::int FROM budget_scenarios WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id=$1)) scenarios`,
          [orgA]
        )
      ).rows
    ).toEqual(before.rows);
    expect(
      (
        await pool.query(
          `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
        WHERE organization_id=$1 AND request_id=$2`,
          [orgA, requestId]
        )
      ).rows
    ).toEqual([
      {
        writer_id: 'ECO-W33',
        access_kind: 'legacy_writer_blocked',
        successor_path: '/api/v8/finance/budgets',
      },
    ]);
  });

  it('restores only ECO-W33 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const requestId = `${prefix}-budget-create-rollback`;
    let budgetId = '';
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W33';
    try {
      const response = await request(productionMountedApp)
        .post('/api/economics/budgets')
        .set('x-request-id', requestId)
        .send({ title: 'Rollback budget', periodStart: '2028-01-01', periodEnd: '2028-12-31' });
      expect(response.status).toBe(201);
      budgetId = String(response.body.budget?.id || '');
      expect(budgetId).toBeTruthy();
      expect(
        (
          await pool.query(`SELECT count(*)::int count FROM budget_lines WHERE budget_id=$1`, [
            budgetId,
          ])
        ).rows[0].count
      ).toBe(15);
      expect(
        (
          await pool.query(`SELECT count(*)::int count FROM budget_scenarios WHERE budget_id=$1`, [
            budgetId,
          ])
        ).rows[0].count
      ).toBe(3);
      expect(
        (
          await pool.query(
            `SELECT count(*)::int count FROM finance_budget_registration_receipts WHERE organization_id=$1 AND budget_id=$2`,
            [orgA, budgetId]
          )
        ).rows[0].count
      ).toBe(0);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([
        {
          writer_id: 'ECO-W33',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance/budgets',
        },
      ]);
    } finally {
      if (budgetId) {
        await pool.query(`DELETE FROM budget_lines WHERE budget_id=$1`, [budgetId]);
        await pool.query(`DELETE FROM budget_scenarios WHERE budget_id=$1`, [budgetId]);
        await pool.query(`DELETE FROM budgets WHERE organization_id=$1 AND id=$2`, [
          orgA,
          budgetId,
        ]);
      }
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('retires ECO-W34 line update before the legacy row can mutate', async () => {
    const budgetId = `${prefix}-line-retired-budget`;
    const lineId = `${prefix}-line-retired`;
    const requestId = `${prefix}-line-update-retired`;
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Retired line budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_lines(id,budget_id,line_code,line_name,statement_type,source,baseline_value)
       VALUES($1,$2,'REVENUE','Revenue','P&L','manual',10)`,
      [lineId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .put(`/api/economics/budgets/${budgetId}/lines/${lineId}`)
        .set('x-request-id', requestId)
        .send({ baselineValue: 99 });
      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        writerId: 'ECO-W34',
        successor: '/api/v8/finance/budgets/:budgetId/lines/:lineId',
      });
      expect(
        (await pool.query(`SELECT baseline_value::text FROM budget_lines WHERE id=$1`, [lineId]))
          .rows
      ).toEqual([{ baseline_value: '10' }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([
        {
          writer_id: 'ECO-W34',
          access_kind: 'legacy_writer_blocked',
          successor_path: '/api/v8/finance/budgets/:budgetId/lines/:lineId',
        },
      ]);
    } finally {
      await pool.query(`DELETE FROM budget_lines WHERE id=$1`, [lineId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
    }
  });

  it('restores only ECO-W34 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const budgetId = `${prefix}-line-rollback-budget`;
    const lineId = `${prefix}-line-rollback`;
    const requestId = `${prefix}-line-update-rollback`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W34';
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Rollback line budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_lines(id,budget_id,line_code,line_name,statement_type,source,baseline_value)
       VALUES($1,$2,'REVENUE','Revenue','P&L','manual',10)`,
      [lineId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .put(`/api/economics/budgets/${budgetId}/lines/${lineId}`)
        .set('x-request-id', requestId)
        .send({ baselineValue: 99 });
      expect(response.status).toBe(200);
      expect(
        (await pool.query(`SELECT baseline_value::text FROM budget_lines WHERE id=$1`, [lineId]))
          .rows
      ).toEqual([{ baseline_value: '99' }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([{ writer_id: 'ECO-W34', access_kind: 'rollback_writer' }]);
    } finally {
      await pool.query(`DELETE FROM budget_lines WHERE id=$1`, [lineId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('retires ECO-W35 projection before the legacy scenario can mutate', async () => {
    const budgetId = `${prefix}-projection-retired-budget`;
    const scenarioId = `${prefix}-projection-retired`;
    const requestId = `${prefix}-projection-retired-request`;
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Retired projection budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_scenarios(id,budget_id,scenario_type,name,adjustments,projections,summary_metrics)
       VALUES($1,$2,'base','Base','{}','{}','{}')`,
      [scenarioId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .post(`/api/economics/budgets/${budgetId}/scenarios/${scenarioId}/project`)
        .set('x-request-id', requestId)
        .send({});
      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        writerId: 'ECO-W35',
        successor: '/api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/project',
      });
      expect(
        (await pool.query(`SELECT projections FROM budget_scenarios WHERE id=$1`, [scenarioId]))
          .rows
      ).toEqual([{ projections: {} }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([
        {
          writer_id: 'ECO-W35',
          access_kind: 'legacy_writer_blocked',
          successor_path: '/api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/project',
        },
      ]);
    } finally {
      await pool.query(`DELETE FROM budget_scenarios WHERE id=$1`, [scenarioId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
    }
  });

  it('restores only ECO-W35 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const budgetId = `${prefix}-projection-rollback-budget`;
    const scenarioId = `${prefix}-projection-rollback`;
    const requestId = `${prefix}-projection-rollback-request`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W35';
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Rollback projection budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_lines(id,budget_id,line_code,line_name,statement_type,source,baseline_value)
       VALUES($1,$2,'REVENUE','Revenue','P&L','manual',10)`,
      [`${prefix}-projection-line`, budgetId]
    );
    await pool.query(
      `INSERT INTO budget_scenarios(id,budget_id,scenario_type,name,adjustments,projections,summary_metrics)
       VALUES($1,$2,'base','Base','{}','{}','{}')`,
      [scenarioId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .post(`/api/economics/budgets/${budgetId}/scenarios/${scenarioId}/project`)
        .set('x-request-id', requestId)
        .send({});
      expect(response.status).toBe(200);
      expect(response.body.scenario?.projections?.periods).toHaveLength(12);
      expect(
        (
          await pool.query(
            `SELECT jsonb_array_length(projections->'periods') period_count
               FROM budget_scenarios WHERE id=$1`,
            [scenarioId]
          )
        ).rows
      ).toEqual([{ period_count: 12 }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([{ writer_id: 'ECO-W35', access_kind: 'rollback_writer' }]);
    } finally {
      await pool.query(`DELETE FROM budget_lines WHERE budget_id=$1`, [budgetId]);
      await pool.query(`DELETE FROM budget_scenarios WHERE id=$1`, [scenarioId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('retires ECO-W36 adjustments before the legacy scenario can mutate', async () => {
    const budgetId = `${prefix}-adjustment-retired-budget`;
    const scenarioId = `${prefix}-adjustment-retired`;
    const requestId = `${prefix}-adjustment-retired-request`;
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Retired adjustment budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_scenarios(id,budget_id,scenario_type,name,adjustments,projections,summary_metrics)
       VALUES($1,$2,'base','Base','{}','{}','{}')`,
      [scenarioId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .put(`/api/economics/budgets/${budgetId}/scenarios/${scenarioId}/adjustments`)
        .set('x-request-id', requestId)
        .send({ revenueGrowth: 7 });
      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        writerId: 'ECO-W36',
        successor: '/api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/adjustments',
      });
      expect(
        (await pool.query(`SELECT adjustments FROM budget_scenarios WHERE id=$1`, [scenarioId]))
          .rows
      ).toEqual([{ adjustments: {} }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([
        {
          writer_id: 'ECO-W36',
          access_kind: 'legacy_writer_blocked',
          successor_path: '/api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/adjustments',
        },
      ]);
    } finally {
      await pool.query(`DELETE FROM budget_scenarios WHERE id=$1`, [scenarioId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
    }
  });

  it('restores only ECO-W36 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const budgetId = `${prefix}-adjustment-rollback-budget`;
    const scenarioId = `${prefix}-adjustment-rollback`;
    const requestId = `${prefix}-adjustment-rollback-request`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W36';
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version)
       VALUES($1,$2,'Rollback adjustment budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1)`,
      [budgetId, orgA]
    );
    await pool.query(
      `INSERT INTO budget_scenarios(id,budget_id,scenario_type,name,adjustments,projections,summary_metrics)
       VALUES($1,$2,'base','Base','{}','{}','{}')`,
      [scenarioId, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .put(`/api/economics/budgets/${budgetId}/scenarios/${scenarioId}/adjustments`)
        .set('x-request-id', requestId)
        .send({ revenueGrowth: 8, costReduction: 2 });
      expect(response.status).toBe(200);
      expect(
        (await pool.query(`SELECT adjustments FROM budget_scenarios WHERE id=$1`, [scenarioId]))
          .rows
      ).toEqual([{ adjustments: { revenueGrowth: 8, costReduction: 2 } }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([{ writer_id: 'ECO-W36', access_kind: 'rollback_writer' }]);
    } finally {
      await pool.query(`DELETE FROM budget_scenarios WHERE id=$1`, [scenarioId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('retires ECO-W37 approval before snapshot or status mutation', async () => {
    const budgetId = `${prefix}-approval-retired-budget`;
    const requestId = `${prefix}-approval-retired-request`;
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version,created_by)
       VALUES($1,$2,'Retired approval budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1,$3)`,
      [budgetId, orgA, actor]
    );
    try {
      const response = await request(productionMountedApp)
        .post(`/api/economics/budgets/${budgetId}/approve`)
        .set('x-request-id', requestId)
        .send({});
      expect(response.status).toBe(410);
      expect(response.body).toMatchObject({
        writerId: 'ECO-W37',
        successor: '/api/v8/finance/budgets/:budgetId/approve',
      });
      expect(
        (
          await pool.query(
            `SELECT status,version,
              (SELECT count(*)::int FROM budget_snapshots WHERE budget_id=$1) snapshot_count
             FROM budgets WHERE id=$1`,
            [budgetId]
          )
        ).rows
      ).toEqual([{ status: 'DRAFT', version: 1, snapshot_count: 0 }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([{ writer_id: 'ECO-W37', access_kind: 'legacy_writer_blocked' }]);
    } finally {
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
    }
  });

  it('restores only ECO-W37 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const budgetId = `${prefix}-approval-rollback-budget`;
    const requestId = `${prefix}-approval-rollback-request`;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W37';
    await pool.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,granularity,currency,version,created_by)
       VALUES($1,$2,'Rollback approval budget','DRAFT','2028-01-01','2028-12-31','monthly','PLN',1,$3)`,
      [budgetId, orgA, actor]
    );
    await pool.query(
      `INSERT INTO budget_lines(id,budget_id,line_code,line_name,statement_type,source,baseline_value)
       VALUES($1,$2,'CAPEX','CAPEX','P&L','manual',10)`,
      [`${prefix}-approval-capex`, budgetId]
    );
    try {
      const response = await request(productionMountedApp)
        .post(`/api/economics/budgets/${budgetId}/approve`)
        .set('x-request-id', requestId)
        .send({});
      expect(response.status).toBe(200);
      expect(
        (
          await pool.query(
            `SELECT status,version,
              (SELECT count(*)::int FROM budget_snapshots WHERE budget_id=$1) snapshot_count
             FROM budgets WHERE id=$1`,
            [budgetId]
          )
        ).rows
      ).toEqual([{ status: 'APPROVED', version: 2, snapshot_count: 1 }]);
      expect(
        (
          await pool.query(
            `SELECT writer_id,access_kind FROM legacy_cutover_usage_events
              WHERE organization_id=$1 AND request_id=$2`,
            [orgA, requestId]
          )
        ).rows
      ).toEqual([{ writer_id: 'ECO-W37', access_kind: 'rollback_writer' }]);
    } finally {
      await pool.query(`DELETE FROM budget_snapshots WHERE budget_id=$1`, [budgetId]);
      await pool.query(`DELETE FROM budget_lines WHERE budget_id=$1`, [budgetId]);
      await pool.query(`DELETE FROM budgets WHERE id=$1`, [budgetId]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('restores only ECO-W31 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    const requestId = `${prefix}-wave11-pptx-rollback`;
    const exportFile = path.join(exportsDir('valuations'), `${mappedValuationId}.pptx`);
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W31';
    try {
      await pool.query(
        `UPDATE valuations SET status='APPROVED',export_path=NULL,exported_at=NULL,
          results=$3::jsonb WHERE organization_id=$1 AND id=$2`,
        [
          orgA,
          mappedValuationId,
          JSON.stringify({
            dcf: {
              enterpriseValue: 1000,
              equityValue: 900,
              discountRatePercent: 11,
              terminalMethod: 'gordon',
              terminalGrowthPercent: 2,
              pvExplicit: 400,
              pvTerminal: 600,
            },
          }),
        ]
      );
      const response = await request(app)
        .post(`/api/economics/valuations/${mappedValuationId}/export/pptx`)
        .set('x-request-id', requestId)
        .send({ language: 'en', theme: 'corporate', confidentiality: 'internal' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      expect(fs.readFileSync(exportFile).subarray(0, 2).toString()).toBe('PK');
      const legacy = await pool.query(
        `SELECT export_path,exported_at FROM valuations WHERE organization_id=$1 AND id=$2`,
        [orgA, mappedValuationId]
      );
      expect(legacy.rows[0].export_path).toBe(`/exports/valuations/${mappedValuationId}.pptx`);
      expect(legacy.rows[0].exported_at).toBeTruthy();
      const event = await pool.query(
        `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events
          WHERE organization_id=$1 AND request_id=$2`,
        [orgA, requestId]
      );
      expect(event.rows).toEqual([
        {
          writer_id: 'ECO-W31',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance-v2/valuation/legacy/:legacyId/export/pptx',
        },
      ]);
      const canonical = await pool.query(
        `SELECT e.export_receipt_id FROM finance_valuation_pptx_exports e
          WHERE e.organization_id=$1 AND e.legacy_valuation_id=$2`,
        [orgA, mappedValuationId]
      );
      expect(canonical.rows).toHaveLength(0);
    } finally {
      fs.rmSync(exportFile, { force: true });
      await pool.query(
        `UPDATE valuations SET status='DRAFT',export_path=NULL,exported_at=NULL
          WHERE organization_id=$1 AND id=$2`,
        [orgA, mappedValuationId]
      );
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
    }
  });

  it('restores only ECO-W29 through the writer-scoped rollback lever', async () => {
    const previous = process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
    process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = 'ECO-W29';
    try {
      await pool.query(
        `UPDATE valuations SET status='APPROVED',negotiation_pack=NULL,results=$3::jsonb WHERE organization_id=$1 AND id=$2`,
        [
          orgA,
          mappedValuationId,
          JSON.stringify({
            dcf: { enterpriseValue: 1000, discountRatePercent: 11, terminalMethod: 'gordon' },
            tornado: [{ driver: 'WACC' }],
          }),
        ]
      );
      const requestId = `${prefix}-wave10-negotiation-rollback`;
      const response = await request(app)
        .post(`/api/economics/valuations/${mappedValuationId}/negotiation-pack`)
        .set('x-request-id', requestId)
        .send({});
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      const legacy = await pool.query(
        `SELECT negotiation_pack FROM valuations WHERE organization_id=$1 AND id=$2`,
        [orgA, mappedValuationId]
      );
      expect(legacy.rows[0].negotiation_pack).toMatchObject({ valuationId: mappedValuationId });
      const event = await pool.query(
        `SELECT writer_id,access_kind,successor_path FROM legacy_cutover_usage_events WHERE organization_id=$1 AND request_id=$2`,
        [orgA, requestId]
      );
      expect(event.rows).toEqual([
        {
          writer_id: 'ECO-W29',
          access_kind: 'rollback_writer',
          successor_path: '/api/v8/finance-v2/valuation/legacy/:legacyId/negotiation-pack',
        },
      ]);
      const canonical = await pool.query(
        `SELECT idempotency_key FROM finance_valuation_negotiation_pack_receipts WHERE organization_id=$1 AND legacy_valuation_id=$2`,
        [orgA, mappedValuationId]
      );
      expect(canonical.rows).toHaveLength(0);
    } finally {
      await pool.query(`UPDATE valuations SET status='DRAFT' WHERE organization_id=$1 AND id=$2`, [
        orgA,
        mappedValuationId,
      ]);
      if (previous === undefined) delete process.env.FINANCE_LEGACY_ROLLBACK_WRITERS;
      else process.env.FINANCE_LEGACY_ROLLBACK_WRITERS = previous;
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
