/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import config from '../../../config/Config.js';
import { PostgresGovernancePolicyResolver } from '../../../domain/initiatives-execution/postgresGovernancePolicyResolver.js';
import { PostgresInitiativeReader } from '../../../domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import { validateOrgMembership, verifyToken } from '../../../middleware/auth.middleware.js';
import { requireOrgAccess } from '../../../middleware/rbac.middleware.js';
import {
  hasEffectiveCapability,
  resolveEffectiveAccess,
} from '../../../services/effectiveAccessService.js';
import { PostgresPortfolioConsultingAnalysisRuntimeService } from '../../../services/initiative/portfolioConsultingAnalysisRuntimeService.js';
import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('PORTFOLIO_ANALYSIS_REAL_DB_REQUIRED');

describe('Portfolio consulting analysis signed-JWT PostgreSQL vertical', () => {
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const actorId = randomUUID();
  const viewerId = randomUUID();
  const foreignActorId = randomUUID();
  const projectId = randomUUID();
  const scenarioId = `portfolio-analysis-scenario-${suffix}`;
  const analysisId = `portfolio-analysis-${suffix}`;
  const initiativeId = `portfolio-analysis-initiative-${suffix}`;
  const decisionId = `portfolio-analysis-decision-${suffix}`;
  const taskId = `portfolio-analysis-task-${suffix}`;
  const contextSnapshotId = randomUUID();
  const policyId = `portfolio-analysis-policy-${suffix}`;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const gateway = { analyze: vi.fn() };
  let app: express.Express;
  let token = '';
  let viewerToken = '';
  let foreignToken = '';
  let runtimeUow: PostgresMaterialCommandUnitOfWork;

  const cleanup = async () => {
    for (const aggregateId of [analysisId, scenarioId, initiativeId, decisionId, taskId]) {
      await pool.query(
        'DELETE FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',
        [organizationId, aggregateId]
      );
      await pool.query('DELETE FROM ie_audit_events WHERE organization_id=$1 AND aggregate_id=$2', [
        organizationId,
        aggregateId,
      ]);
      await pool.query(
        'DELETE FROM ie_outbox_events WHERE organization_id=$1 AND aggregate_id=$2',
        [organizationId, aggregateId]
      );
      await pool.query(
        'DELETE FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',
        [organizationId, aggregateId]
      );
    }
    await pool.query(
      'DELETE FROM organization_context_snapshot_versions WHERE organization_id=$1',
      [organizationId]
    );
    await pool.query('DELETE FROM ie_governance_policies WHERE organization_id=$1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM project_members WHERE project_id=$1', [projectId]);
    await pool.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
    for (const org of [organizationId, foreignOrganizationId]) {
      await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [org]);
      await pool.query('DELETE FROM users WHERE organization_id=$1', [org]);
      await pool.query('DELETE FROM project_role_templates WHERE organization_id=$1', [org]);
      await pool.query('DELETE FROM organizations WHERE id=$1', [org]);
    }
  };

  beforeAll(async () => {
    process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = 'true';
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status)
       VALUES($1,'Portfolio analysis runtime','enterprise','active'),
             ($2,'Portfolio analysis foreign','enterprise','active')`,
      [organizationId, foreignOrganizationId]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','ADMIN','active'),
             ($4,$2,$5,'unused','MEMBER','active'),
             ($6,$7,$8,'unused','ADMIN','active')`,
      [
        actorId,
        organizationId,
        `${actorId}@local.test`,
        viewerId,
        `${viewerId}@local.test`,
        foreignActorId,
        foreignOrganizationId,
        `${foreignActorId}@local.test`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'ADMIN','ACTIVE'),
             ($4,$2,$5,'MEMBER','ACTIVE'),
             ($6,$7,$8,'ADMIN','ACTIVE')`,
      [
        randomUUID(),
        organizationId,
        actorId,
        randomUUID(),
        viewerId,
        randomUUID(),
        foreignOrganizationId,
        foreignActorId,
      ]
    );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'Portfolio analysis project','active',$3)`,
      [projectId, organizationId, actorId]
    );
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'PROJECT_LEADER'),($4,$2,$5,'BUSINESS_OWNER')`,
      [randomUUID(), projectId, actorId, randomUUID(), viewerId]
    );
    await pool.query(
      `INSERT INTO ie_governance_policies
       (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json)
       VALUES($1,'PROJECT',$2,$3,1,'STANDARD',2,'{}'::jsonb)`,
      [organizationId, projectId, policyId]
    );
    const initiative = {
      initiativeId,
      title: 'Exact native portfolio evidence',
      projectId: null,
      initiativeOwnerId: actorId,
      lifecycleState: 'READY_FOR_DECISION',
      problem: 'Portfolio overlap needs a governed decision',
    };
    const scenario = {
      scenarioId,
      scenarioVersion: 1,
      status: 'PUBLISHED',
      scope: { portfolioId: projectId, goalIds: [], asOf: '2026-09-13T10:00:00.000Z' },
      model: { modelId: 'portfolio-model', version: 1 },
      memberships: [
        {
          initiativeId,
          initiativeVersion: 1,
          disposition: 'CONDITIONAL',
          rationale: 'Needs a return-condition decision',
        },
      ],
      decompositionKeys: ['priority'],
      createdBy: actorId,
      updatedBy: actorId,
      publishedBy: actorId,
      publishedAt: '2026-09-13T10:00:00.000Z',
      previousPublishedVersion: null,
    };
    const decision = {
      decisionId,
      initiativeId,
      status: 'APPROVED',
      disposition: {
        kind: 'PARKING',
        reason: 'Wait for customer contract',
        returnCondition: 'Customer contract signed',
      },
    };
    const task = { taskId, initiativeId, status: 'OPEN', title: 'Validate customer contract' };
    await pool.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative',$2,1,$3::jsonb),
             ($1,'portfolio_scenario',$4,1,$5::jsonb),
             ($1,'decision',$6,1,$7::jsonb),
             ($1,'task',$8,1,$9::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify(initiative),
        scenarioId,
        JSON.stringify(scenario),
        decisionId,
        JSON.stringify(decision),
        taskId,
        JSON.stringify(task),
      ]
    );
    const snapshotPayload = {
      organizationId,
      schemaVersion: 1,
      claims: [
        {
          claimId: `public-claim-${suffix}`,
          visibilityScope: 'organization',
          claimPath: 'strategy.publicPriority',
          value: 'PUBLIC_CONTEXT_MARKER',
        },
        {
          claimId: `restricted-claim-${suffix}`,
          visibilityScope: 'restricted',
          claimPath: 'strategy.confidentialAcquisition',
          value: 'RESTRICTED_CONTEXT_SECRET',
        },
      ],
    };
    const sourceRefs = [
      { claimId: `public-claim-${suffix}`, sourceDocId: null, fileHash: null },
      { claimId: `restricted-claim-${suffix}`, sourceDocId: null, fileHash: null },
    ];
    await pool.query(
      `INSERT INTO organization_context_snapshot_versions
       (id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by)
       VALUES($1,$2,1,1,$3,2,$4,$5,$6)`,
      [
        contextSnapshotId,
        organizationId,
        'a'.repeat(64),
        JSON.stringify(snapshotPayload),
        JSON.stringify(sourceRefs),
        actorId,
      ]
    );

    token = jwt.sign(
      { id: actorId, organizationId, role: 'ADMIN', email: `${actorId}@local.test` },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    viewerToken = jwt.sign(
      { id: viewerId, organizationId, role: 'MEMBER', email: `${viewerId}@local.test` },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    foreignToken = jwt.sign(
      {
        id: foreignActorId,
        organizationId: foreignOrganizationId,
        role: 'ADMIN',
        email: `${foreignActorId}@local.test`,
      },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const reader = new PostgresInitiativeReader(pool);
    const source = new PostgresPortfolioConsultingAnalysisRuntimeService(pool, reader);
    runtimeUow = new PostgresMaterialCommandUnitOfWork(pool);
    gateway.analyze.mockImplementation(async ({ rubricVersion, snapshot }) => {
      expect(JSON.stringify(snapshot)).toContain('PUBLIC_CONTEXT_MARKER');
      expect(JSON.stringify(snapshot)).not.toContain('RESTRICTED_CONTEXT_SECRET');
      expect(snapshot.organizationContext.facts.sourceRefs).toEqual([
        expect.objectContaining({ claimId: `public-claim-${suffix}` }),
      ]);
      const sourceRef = snapshot.initiatives[0].evidenceRefs[0];
      const evidence = [
        { initiativeId, field: 'facts.problem', source: 'initiativeUnifiedReader', sourceRef },
      ];
      return {
        provenance: {
          runId: `model-run-${suffix}`,
          provider: 'test-bound-configured-gateway',
          modelId: 'portfolio-stub',
          modelVersion: '1',
          promptVersion: rubricVersion,
          generatedAt: new Date().toISOString(),
        },
        output: {
          items: [
            {
              itemId: 'observation-1',
              position: 1,
              kind: 'OBSERVATION',
              criterion: 'DECISION_HISTORY',
              initiativeIds: [initiativeId],
              rationale: 'Public context and the parking decision require return-condition review.',
              evidence,
              confidence: 'HIGH',
              alternatives: [],
              missingData: [],
              proposedDisposition: null,
            },
            {
              itemId: 'recommendation-1',
              position: 2,
              kind: 'RECOMMENDATION',
              criterion: 'PRIORITY',
              initiativeIds: [initiativeId],
              rationale: 'Verify the return condition before portfolio inclusion.',
              evidence,
              confidence: 'MEDIUM',
              alternatives: ['Keep parked'],
              missingData: [],
              proposedDisposition: null,
            },
            {
              itemId: 'decision-1',
              position: 3,
              kind: 'DECISION',
              criterion: 'PRIORITY',
              initiativeIds: [initiativeId],
              rationale: 'A human must decide whether the return condition is satisfied.',
              evidence,
              confidence: 'MEDIUM',
              alternatives: ['PARKING'],
              missingData: [],
              proposedDisposition: {
                kind: 'IN',
                reason: 'Contract evidence is required',
                returnCondition: null,
              },
            },
          ],
        },
      };
    });
    const router = createInitiativesExecutionRuntimeRouter({
      unitOfWork: runtimeUow,
      reader,
      authorize: async (actor, targetProjectId, capability) =>
        hasEffectiveCapability(
          await resolveEffectiveAccess({
            userId: actor.userId,
            organizationId: actor.organizationId,
            applicationRole: actor.applicationRole,
            projectId: targetProjectId,
            isImpersonating: actor.isImpersonating,
          }),
          capability
        ),
      resolvePolicy: (org, targetProjectId, targetInitiativeId) =>
        new PostgresGovernancePolicyResolver(pool).resolve(
          org,
          targetProjectId,
          targetInitiativeId
        ),
      portfolioAnalysis: {
        buildSnapshot: (input) => source.buildSnapshot(input),
        reader: source,
        contextReader: source,
        gateway,
      },
    });
    app = express();
    app.use(express.json());
    app.use(verifyToken, validateOrgMembership, requireOrgAccess());
    app.use('/api/initiatives/runtime-v1', router);
  }, 120_000);

  afterAll(async () => {
    delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
    await cleanup();
    await pool.end();
  }, 120_000);

  it('captures, analyzes outside the transaction, persists and reads the exact same tenant-scoped analysis', async () => {
    const body = {
      analysisId,
      scenarioId,
      contextSnapshotId,
      contextVersion: 1,
      expectedVersion: 0,
      clientRequestId: `capture-${suffix}`,
      rubricVersion: 'portfolio-consulting-v1',
    };
    const created = await request(app)
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Correlation-ID', `correlation-${suffix}`)
      .send(body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(JSON.stringify(created.body)).toContain('PUBLIC_CONTEXT_MARKER');
    expect(JSON.stringify(created.body)).not.toContain('RESTRICTED_CONTEXT_SECRET');
    expect(created.body.analysis).toMatchObject({
      analysisId,
      aggregateVersion: 2,
      status: 'PENDING_REVIEW',
      snapshot: {
        organizationId,
        portfolio: { scenarioId, aggregateVersion: 1, scenarioVersion: 1 },
        initiatives: [{ initiativeId, initiativeVersion: 1, projectId: null }],
        decisionHistory: [
          {
            decisionId,
            facts: {
              disposition: { kind: 'PARKING', returnCondition: 'Customer contract signed' },
            },
          },
        ],
        runningWork: [{ aggregateType: 'task', aggregateId: taskId }],
        organizationContext: { snapshotId: contextSnapshotId, version: 1 },
      },
      model: { runId: `model-run-${suffix}`, provider: 'test-bound-configured-gateway' },
    });
    expect(gateway.analyze).toHaveBeenCalledTimes(1);

    const replay = await request(app)
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.analysis.model.runId).toBe(`model-run-${suffix}`);
    expect(gateway.analyze).toHaveBeenCalledTimes(1);

    const read = await request(app)
      .get(`/api/initiatives/runtime-v1/portfolio-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    expect(read.body.version).toBe(2);
    expect(read.body.analysis.requestDigest).toBe(created.body.analysis.requestDigest);

    const viewerRead = await request(app)
      .get(`/api/initiatives/runtime-v1/portfolio-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerRead.status, JSON.stringify(viewerRead.body)).toBe(200);
    expect(JSON.stringify(viewerRead.body)).toContain('PUBLIC_CONTEXT_MARKER');
    expect(JSON.stringify(viewerRead.body)).not.toContain('RESTRICTED_CONTEXT_SECRET');

    const gatewayApp = express();
    gatewayApp.use(express.json());
    const { ApiGateway } = await import('../../../Gateway.js');
    ApiGateway.getInstance().initializeRoutes(gatewayApp);
    const mountedRead = await request(gatewayApp)
      .get(`/api/initiatives/runtime-v1/portfolio-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(mountedRead.status, JSON.stringify(mountedRead.body)).toBe(200);
    expect(mountedRead.body.analysis.requestDigest).toBe(created.body.analysis.requestDigest);

    const persisted = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='portfolio_analysis' AND aggregate_id=$2`,
      [organizationId, analysisId]
    );
    expect(persisted.rows[0]).toMatchObject({ version: 2 });
    expect(persisted.rows[0].payload_json.model.runId).toBe(`model-run-${suffix}`);
    expect(JSON.stringify(persisted.rows[0].payload_json)).toContain('PUBLIC_CONTEXT_MARKER');
    expect(JSON.stringify(persisted.rows[0].payload_json)).not.toContain(
      'RESTRICTED_CONTEXT_SECRET'
    );
    const receipts = await pool.query(
      `SELECT command_type,aggregate_version FROM ie_command_receipts
       WHERE organization_id=$1 AND aggregate_id=$2 ORDER BY aggregate_version`,
      [organizationId, analysisId]
    );
    expect(receipts.rows).toEqual([
      { command_type: 'portfolio.analysis.capture', aggregate_version: 1 },
      { command_type: 'portfolio.analysis.finalize', aggregate_version: 2 },
    ]);
    const publicArtifacts = await pool.query<{ serialized: string }>(
      `SELECT payload_json::text AS serialized FROM ie_audit_events
        WHERE organization_id=$1 AND aggregate_id=$2
       UNION ALL
       SELECT payload_json::text AS serialized FROM ie_outbox_events
        WHERE organization_id=$1 AND aggregate_id=$2
       UNION ALL
       SELECT response_json::text AS serialized FROM ie_command_receipts
        WHERE organization_id=$1 AND aggregate_id=$2`,
      [organizationId, analysisId]
    );
    expect(publicArtifacts.rows.length).toBeGreaterThan(0);
    expect(
      publicArtifacts.rows.some((row) => row.serialized.includes('PUBLIC_CONTEXT_MARKER'))
    ).toBe(true);
    expect(
      publicArtifacts.rows.some((row) => row.serialized.includes('RESTRICTED_CONTEXT_SECRET'))
    ).toBe(false);
  });

  it('returns the same 404 for a foreign tenant and an unknown analysis identity', async () => {
    const foreign = await request(app)
      .get(`/api/initiatives/runtime-v1/portfolio-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${foreignToken}`);
    const missing = await request(app)
      .get('/api/initiatives/runtime-v1/portfolio-analyses/missing-analysis')
      .set('Authorization', `Bearer ${token}`);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('removes every owned RealPG fixture category and proves zero readback', async () => {
    await cleanup();
    const readback = await pool.query<{ total: number }>(
      `SELECT (
        (SELECT count(*) FROM ie_command_receipts WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_audit_events WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_outbox_events WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_aggregate_state WHERE organization_id=$1) +
        (SELECT count(*) FROM organization_context_snapshot_versions WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_governance_policies WHERE organization_id=$1) +
        (SELECT count(*) FROM projects WHERE organization_id=$1) +
        (SELECT count(*) FROM organization_members WHERE organization_id = ANY($2::text[])) +
        (SELECT count(*) FROM users WHERE organization_id = ANY($2::text[])) +
        (SELECT count(*) FROM project_role_templates WHERE organization_id = ANY($2::text[])) +
        (SELECT count(*) FROM organizations WHERE id = ANY($2::text[]))
      )::int AS total`,
      [organizationId, [organizationId, foreignOrganizationId]]
    );
    expect(readback.rows[0]?.total).toBe(0);
  });
});
