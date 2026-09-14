/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('F2_1_SLICE3_REAL_DB_REQUIRED');

describe('F2-1 E1 Slice 3 portfolio decision signed-JWT actual Gateway/PostgreSQL', () => {
  const suffix = randomUUID();
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const requesterId = randomUUID();
  const reviewerId = randomUUID();
  const foreignActorId = randomUUID();
  const projectId = randomUUID();
  const scenarioId = `f21-s3-scenario-${suffix}`;
  const analysisId = `f21-s3-analysis-${suffix}`;
  const initiativeIds = ['a', 'b', 'c', 'd'].map((key) => `f21-s3-initiative-${key}-${suffix}`);
  const selfDecisionId = `f21-s3-self-decision-${suffix}`;
  const decisionIds = Object.fromEntries(
    initiativeIds.map((initiativeId, index) => [initiativeId, `f21-s3-decision-${index}-${suffix}`])
  );
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  let app: express.Express;
  let requesterToken = '';
  let reviewerToken = '';
  let foreignToken = '';

  const cleanup = async () => {
    await pool.query('DELETE FROM ie_aggregate_relations WHERE organization_id=$1', [
      organizationId,
    ]);
    await pool.query('DELETE FROM ie_command_receipts WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM ie_audit_events WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM ie_outbox_events WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM ie_aggregate_state WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM ie_governance_policies WHERE organization_id=$1', [
      organizationId,
    ]);
    await pool.query(
      `DELETE FROM ie_governance_policies
       WHERE organization_id='*' AND scope_type='PRODUCT' AND scope_id='DEFAULT'
         AND policy_id='consultify-standard' AND version=1`
    );
    await pool.query('DELETE FROM project_members WHERE project_id=$1', [projectId]);
    await pool.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query('DELETE FROM users WHERE organization_id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query('DELETE FROM project_role_templates WHERE organization_id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
  };

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status)
       VALUES($1,'F2-1 Slice 3','enterprise','active'),
             ($2,'F2-1 Slice 3 foreign','enterprise','active')`,
      [organizationId, foreignOrganizationId]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','ADMIN','active'),
             ($4,$2,$5,'unused','ADMIN','active'),
             ($6,$7,$8,'unused','ADMIN','active')`,
      [
        requesterId,
        organizationId,
        `${requesterId}@local.test`,
        reviewerId,
        `${reviewerId}@local.test`,
        foreignActorId,
        foreignOrganizationId,
        `${foreignActorId}@local.test`,
      ]
    );
    for (const [orgId, userId] of [
      [organizationId, requesterId],
      [organizationId, reviewerId],
      [foreignOrganizationId, foreignActorId],
    ]) {
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
        [randomUUID(), orgId, userId]
      );
    }
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'F2-1 Slice 3 portfolio','active',$3)`,
      [projectId, organizationId, requesterId]
    );
    await pool.query(
      `INSERT INTO ie_governance_policies
       (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json)
       VALUES('*','PRODUCT','DEFAULT','consultify-standard',1,'STANDARD',2,$1::jsonb)`,
      [JSON.stringify({ separationOfDuties: true, selfApproval: false })]
    );
    await pool.query(
      `INSERT INTO ie_governance_policies
       (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json)
       VALUES($1,'PROJECT',$2,$3,1,'STANDARD',2,$4::jsonb)`,
      [
        organizationId,
        projectId,
        `f21-s3-policy-${suffix}`,
        JSON.stringify({ selfApproval: false }),
      ]
    );

    const memberships = initiativeIds.map((initiativeId, index) => ({
      initiativeId,
      initiativeVersion: 1,
      disposition: 'CONDITIONAL',
      rationale: `Governed portfolio membership ${index + 1}`,
    }));
    const scenario = {
      scenarioId,
      scenarioVersion: 1,
      status: 'PUBLISHED',
      scope: { portfolioId: projectId, goalIds: [], asOf: '2026-09-13T12:00:00.000Z' },
      model: { modelId: 'portfolio-model', version: 1 },
      memberships,
      decompositionKeys: ['priority'],
      createdBy: requesterId,
      updatedBy: requesterId,
      publishedBy: requesterId,
      publishedAt: '2026-09-13T12:00:00.000Z',
      previousPublishedVersion: null,
    };
    const initiatives = initiativeIds.map((initiativeId, index) => ({
      initiativeId,
      initiativeVersion: 1,
      projectId,
      source: 'CANONICAL',
      facts: { title: `Initiative ${index + 1}`, lifecycleState: 'READY_FOR_DECISION' },
      evidenceRefs: [`initiative:${initiativeId}:v1`],
    }));
    const dispositionKinds = ['IN', 'PARKING', 'ARCHIVE', 'IN'] as const;
    const items = initiativeIds.map((initiativeId, index) => ({
      itemId: `decision-${index + 1}`,
      position: index + 1,
      kind: 'DECISION',
      criterion: 'PRIORITY',
      initiativeIds: [initiativeId],
      rationale: `Human decision ${index + 1}`,
      evidence: [
        {
          initiativeId,
          field: 'facts.priority',
          source: 'initiativeUnifiedReader',
          sourceRef: `initiative:${initiativeId}:v1`,
        },
      ],
      confidence: 'HIGH',
      alternatives: [],
      missingData: [],
      proposedDisposition: {
        kind: dispositionKinds[index],
        reason: `Disposition reason ${index + 1}`,
        returnCondition: index === 0 || index === 3 ? null : `Return condition ${index + 1}`,
      },
    }));
    const analysis = {
      analysisId,
      aggregateVersion: 2,
      status: 'PENDING_REVIEW',
      rubricVersion: 'portfolio-consulting-v1',
      requestDigest: `digest-${suffix}`,
      requestedBy: requesterId,
      snapshot: {
        snapshotVersion: 1,
        organizationId,
        asOf: '2026-09-13T12:00:00.000Z',
        source: {
          system: 'initiativeUnifiedReader',
          version: 'runtime-v1',
          capturedAt: '2026-09-13T12:00:00.000Z',
        },
        portfolio: { scenarioId, aggregateVersion: 1, scenarioVersion: 1, facts: scenario },
        initiatives,
        decisionHistory: [],
        runningWork: [],
        organizationContext: {
          snapshotId: randomUUID(),
          version: 1,
          contentHash: 'a'.repeat(64),
          facts: {},
        },
      },
      model: {
        runId: `run-${suffix}`,
        provider: 'real-gateway-fixture',
        modelId: 'fixture-model',
        modelVersion: '1',
        promptVersion: 'portfolio-consulting-v1',
        generatedAt: '2026-09-13T12:01:00.000Z',
      },
      items,
    };

    for (const initiativeId of initiativeIds) {
      await pool.query(
        `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES($1,'initiative',$2,1,$3::jsonb)`,
        [
          organizationId,
          initiativeId,
          JSON.stringify({
            initiativeId,
            title: `Initiative ${initiativeId}`,
            projectId,
            initiativeOwnerId: requesterId,
            lifecycleState: 'READY_FOR_DECISION',
            cardRefs: {},
          }),
        ]
      );
    }
    await pool.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'portfolio_scenario',$2,1,$3::jsonb),
             ($1,'portfolio_analysis',$4,2,$5::jsonb)`,
      [organizationId, scenarioId, JSON.stringify(scenario), analysisId, JSON.stringify(analysis)]
    );

    requesterToken = jwt.sign(
      { id: requesterId, organizationId, role: 'ADMIN', email: `${requesterId}@local.test` },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );
    reviewerToken = jwt.sign(
      { id: reviewerId, organizationId, role: 'ADMIN', email: `${reviewerId}@local.test` },
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

    const { ApiGateway } = await import('../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  }, 120_000);

  const requestDecision = (initiativeId: string, decisionId: string, authorityId: string) =>
    request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/gates/portfolio/requests`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        expectedVersion: 1,
        clientRequestId: `request:${decisionId}`,
        decisionId,
        authorityId,
        scenarioId,
        scenarioVersion: 1,
        dueAt: '2026-09-20T23:59:59.000Z',
      });

  const decide = (
    initiativeId: string,
    decisionId: string,
    index: number,
    kind: 'IN' | 'PARKING' | 'ARCHIVE'
  ) =>
    request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/gates/portfolio/decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        expectedVersion: 2,
        clientRequestId: `decide:${decisionId}`,
        decisionId,
        outcome: kind === 'IN' ? 'APPROVED' : 'REJECTED',
        rationale: `Disposition reason ${index + 1}`,
        conditions: [],
        mergeTargetInitiativeId: null,
        disposition: {
          kind,
          reason: `Disposition reason ${index + 1}`,
          returnCondition: kind === 'IN' ? null : `Return condition ${index + 1}`,
          inputSnapshot: {
            analysisId,
            analysisVersion: 2,
            itemId: `decision-${index + 1}`,
            asOf: '2026-09-13T12:00:00.000Z',
          },
        },
      });

  it('rejects self-approval before any material write', async () => {
    const response = await requestDecision(initiativeIds[0], selfDecisionId, requesterId);
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    const writes = await pool.query(
      `SELECT count(*)::int AS count FROM ie_command_receipts
       WHERE organization_id=$1 AND client_request_id=$2`,
      [organizationId, `request:${selfDecisionId}`]
    );
    expect(writes.rows[0]?.count).toBe(0);
  });

  it('persists a single two-actor IN decision with exact frozen analysis input', async () => {
    const initiativeId = initiativeIds[0];
    const decisionId = decisionIds[initiativeId];
    const requested = await requestDecision(initiativeId, decisionId, reviewerId);
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    const decided = await decide(initiativeId, decisionId, 0, 'IN');
    expect(decided.status, JSON.stringify(decided.body)).toBe(201);

    const readback = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/gates/portfolio/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`);
    expect(readback.status, JSON.stringify(readback.body)).toBe(200);
    expect(readback.body).toMatchObject({
      version: 2,
      decision: {
        decisionId,
        requesterId,
        authorityId: reviewerId,
        status: 'APPROVED',
        disposition: {
          kind: 'IN',
          actorId: reviewerId,
          inputSnapshot: { analysisId, analysisVersion: 2, itemId: 'decision-1' },
          frozenInput: {
            initiative: { initiativeId, initiativeVersion: 1 },
            item: { itemId: 'decision-1', kind: 'DECISION' },
          },
        },
      },
    });
  });

  it('applies only two selected decisions and leaves the unselected Initiative unchanged', async () => {
    for (const [index, kind] of [
      [1, 'PARKING'],
      [2, 'ARCHIVE'],
    ] as const) {
      const initiativeId = initiativeIds[index];
      const decisionId = decisionIds[initiativeId];
      const requested = await requestDecision(initiativeId, decisionId, reviewerId);
      expect(requested.status, JSON.stringify(requested.body)).toBe(201);
      const decided = await decide(initiativeId, decisionId, index, kind);
      expect(decided.status, JSON.stringify(decided.body)).toBe(201);
    }

    const rows = await pool.query<{
      aggregate_id: string;
      version: number;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT aggregate_id,version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=ANY($2::text[])
       ORDER BY aggregate_id`,
      [organizationId, initiativeIds]
    );
    const byId = new Map(rows.rows.map((row) => [row.aggregate_id, row]));
    expect(byId.get(initiativeIds[1])).toMatchObject({
      version: 3,
      payload_json: { lifecycleState: 'READY_FOR_DECISION' },
    });
    expect(byId.get(initiativeIds[2])).toMatchObject({
      version: 3,
      payload_json: { lifecycleState: 'READY_FOR_DECISION' },
    });
    expect(byId.get(initiativeIds[3])).toMatchObject({
      version: 1,
      payload_json: { lifecycleState: 'READY_FOR_DECISION' },
    });
    const unselectedDecision = await pool.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_relations
       WHERE organization_id=$1 AND source_id=$2 AND relation_type='INITIATIVE_PORTFOLIO_DECISION'`,
      [organizationId, initiativeIds[3]]
    );
    expect(unselectedDecision.rows[0]?.count).toBe(0);
  });

  it('returns the same 404 for a foreign tenant and a missing Initiative', async () => {
    const foreign = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeIds[0]}/gates/portfolio/decision`)
      .set('Authorization', `Bearer ${foreignToken}`);
    const missing = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives/missing/gates/portfolio/decision')
      .set('Authorization', `Bearer ${requesterToken}`);
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it('cleans every owned fixture category and proves zero readback', async () => {
    await cleanup();
    const readback = await pool.query<{ total: number }>(
      `SELECT (
        (SELECT count(*) FROM ie_aggregate_relations WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_command_receipts WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_audit_events WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_outbox_events WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_aggregate_state WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_governance_policies WHERE organization_id=$1) +
        (SELECT count(*) FROM ie_governance_policies WHERE organization_id='*' AND policy_id='consultify-standard') +
        (SELECT count(*) FROM projects WHERE organization_id=$1) +
        (SELECT count(*) FROM organization_members WHERE organization_id=ANY($2::text[])) +
        (SELECT count(*) FROM users WHERE organization_id=ANY($2::text[])) +
        (SELECT count(*) FROM project_role_templates WHERE organization_id=ANY($2::text[])) +
        (SELECT count(*) FROM organizations WHERE id=ANY($2::text[]))
      )::int AS total`,
      [organizationId, [organizationId, foreignOrganizationId]]
    );
    expect(readback.rows[0]?.total).toBe(0);
  });
});
