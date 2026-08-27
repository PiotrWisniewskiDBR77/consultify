/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import initiativesRoutes from '../initiatives.routes.js';
import executionControlRoutes from '../../executionControl.routes.js';
import v8Router from '../../v8/index.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('Day 31 canonical writer mounted contract', () => {
  const tag = randomUUID();
  const organizationId = `day31-gate-${tag}`;
  const userId = `day31-owner-${tag}`;
  const viewerId = `day31-viewer-${tag}`;
  const foreignOrganizationId = `day31-foreign-${tag}`;
  const foreignUserId = `day31-foreign-owner-${tag}`;
  const projectId = `day31-project-${tag}`;
  const initiativeId = `day31-initiative-${tag}`;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  let client: Client;
  let token = '';
  let viewerToken = '';
  let foreignToken = '';
  let app: express.Express;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [
      organizationId,
      foreignOrganizationId,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active'),($4,$2,$5,'USER','active'),($6,$7,$8,'OWNER','active')`,
      [
        userId,
        organizationId,
        `${userId}@example.test`,
        viewerId,
        `${viewerId}@example.test`,
        foreignUserId,
        foreignOrganizationId,
        `${foreignUserId}@example.test`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$2,$5,'USER','ACTIVE'),($6,$7,$8,'OWNER','ACTIVE')`,
      [
        `membership-${userId}`,
        organizationId,
        userId,
        `membership-${viewerId}`,
        viewerId,
        `membership-${foreignUserId}`,
        foreignOrganizationId,
        foreignUserId,
      ]
    );
    await client.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      projectId,
      organizationId,
    ]);
    await client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative',$2,1,$3::jsonb)`,
      [organizationId, initiativeId, JSON.stringify({ initiativeId, projectId })]
    );

    token = jwt.sign(
      { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    viewerToken = jwt.sign(
      { id: viewerId, organizationId, role: 'USER', email: `${viewerId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    foreignToken = jwt.sign(
      {
        id: foreignUserId,
        organizationId: foreignOrganizationId,
        role: 'OWNER',
        email: `${foreignUserId}@example.test`,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
    app.use('/api/execution-control', executionControlRoutes);
    app.use('/api/v8', v8FeatureGate, v8Router);
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      for (const table of [
        'ie_aggregate_relations',
        'ie_command_receipts',
        'ie_audit_events',
        'ie_outbox_events',
        'ie_aggregate_state',
      ]) {
        await client.query(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
      }
      await client.query(`DELETE FROM initiative_dependencies WHERE organization_id = $1`, [
        organizationId,
      ]);
      await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
      await client.query(`DELETE FROM projects WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('mounts runtime reads instead of returning 404 without authentication', async () => {
    const response = await request(app).get('/api/initiatives/runtime-v1/execution-cases');
    expect([401, 403]).toContain(response.status);
  });

  it('serves all eight control KPI families for an active member', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth());
    expect(response.status).toBe(200);
    expect(response.body.families).toHaveLength(8);
  });

  it('lets a runtime-v1 mutation reach the canonical writer', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/management-signals/ingest')
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `signal-${tag}`,
        ruleId: 'day31-mounted-contract',
        sourceType: 'initiative',
        sourceId: initiativeId,
        sourceVersions: { initiative: 1 },
        severity: 'WARNING',
        occurredAt: '2026-08-26T12:00:00.000Z',
        evidenceRef: `evidence-${tag}`,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.status).toBe('APPLIED');
    expect(response.body.code).not.toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');
  });

  it('keeps legacy mutations behind the 409 boundary', async () => {
    const response = await request(app)
      .post('/api/v8/execution-control/risk-signals/dismiss')
      .set(auth())
      .send({ signalId: `signal-${tag}` });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' });
  });

  it('keeps the budget-delete exception outside the 409 boundary', async () => {
    const response = await request(app)
      .delete(`/api/v8/execution-control/budget/entries/missing-${tag}`)
      .set(auth());
    expect(response.status).not.toBe(409);
  });

  it('keeps legacy reads outside the 409 boundary', async () => {
    const response = await request(app).get('/api/v8/execution-control/risk-signals').set(auth());
    expect(response.status).not.toBe(409);
  });

  it('writes a budget entry with CAS, idempotency, audit and fail-closed access', async () => {
    const entryId = `budget-entry-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/budget-entries/${entryId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `budget-request-${tag}`,
      entryType: 'PLANNED',
      costType: 'OPEX',
      category: 'software',
      amount: 1250,
      currency: 'PLN',
      description: 'Day 31 canonical writer proof',
      periodMonth: 8,
      periodYear: 2026,
      source: 'MANUAL',
    };
    const first = await request(app).post(path).set(auth()).send(body);
    expect(first.status).toBe(201);
    const repeated = await request(app).post(path).set(auth()).send(body);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({
      status: 'REPLAYED',
      aggregateVersion: first.body.aggregateVersion,
      response: first.body.response,
    });

    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
      [organizationId, entryId]
    );
    const audit = await client.query(
      `SELECT aggregate_version FROM ie_audit_events
       WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
      [organizationId, entryId]
    );
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, amount: 1250 });
    expect(audit.rows).toEqual([{ aggregate_version: 1 }]);

    const conflict = await request(app)
      .post(path)
      .set(auth())
      .send({ ...body, clientRequestId: `budget-conflict-${tag}` });
    expect(conflict.status).toBe(409);
    expect(
      await client.query(
        `SELECT COUNT(*)::int AS count FROM ie_audit_events
         WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
        [organizationId, entryId]
      )
    ).toMatchObject({ rows: [{ count: 1 }] });

    const foreign = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
      .send({ ...body, organizationId });
    expect(foreign.status).toBe(404);
    const denied = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .send(body);
    expect(denied.status).toBe(404);
  });

  it('records a realization through the same CAS and receipt spine', async () => {
    const realizationId = `realization-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations/${realizationId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `realization-request-${tag}`,
      periodMonth: '2026-08',
      realizedRevenueDelta: 5000,
      realizedCostDelta: null,
      realizedSavings: 750,
      varianceNotes: 'Independent readback proof',
    };
    const first = await request(app).post(path).set(auth()).send(body);
    expect(first.status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='execution_realization' AND aggregate_id=$2`,
      [organizationId, realizationId]
    );
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, realizedSavings: 750 });
    const replay = await request(app).post(path).set(auth()).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.status).toBe('REPLAYED');
    const conflict = await request(app)
      .post(path)
      .set(auth())
      .send({ ...body, clientRequestId: `realization-conflict-${tag}` });
    expect(conflict.status).toBe(409);
    const foreign = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
      .send({ ...body, organizationId });
    expect(foreign.status).toBe(404);
    const denied = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .send(body);
    expect(denied.status).toBe(404);
  });

  it('records RAID mitigation through the canonical initiative identity', async () => {
    const raidItemId = `raid-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations/${raidItemId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `raid-request-${tag}`,
      mitigationPlan: 'Isolate the dependency and verify the owner',
      responseStrategy: 'MITIGATE',
      mitigationOwnerId: userId,
      mitigationDueDate: '2026-09-01T12:00:00.000Z',
      mitigationStatus: 'PLANNED',
    };
    expect((await request(app).post(path).set(auth()).send(body)).status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='raid_mitigation' AND aggregate_id=$2`,
      [organizationId, raidItemId]
    );
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, raidItemId });
    expect((await request(app).post(path).set(auth()).send(body)).body.status).toBe('REPLAYED');
    expect(
      (
        await request(app)
          .post(path)
          .set(auth())
          .send({ ...body, clientRequestId: `raid-conflict-${tag}` })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
          .send({ ...body, organizationId })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${viewerToken}` })
          .send(body)
      ).status
    ).toBe(404);
  });

  it('executes a manager lane action as a canonical audited command', async () => {
    const managerActionId = `manager-action-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-actions/${managerActionId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `manager-action-request-${tag}`,
      laneId: 'blocked',
      problemId: `problem-${tag}`,
      actionId: 'escalate-owner',
      rationale: 'Day 31 canonical action proof',
    };
    expect((await request(app).post(path).set(auth()).send(body)).status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='manager_execution_action' AND aggregate_id=$2`,
      [organizationId, managerActionId]
    );
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, laneId: 'blocked' });
    expect((await request(app).post(path).set(auth()).send(body)).body.status).toBe('REPLAYED');
    expect(
      (
        await request(app)
          .post(path)
          .set(auth())
          .send({ ...body, clientRequestId: `manager-action-conflict-${tag}` })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
          .send({ ...body, organizationId })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${viewerToken}` })
          .send(body)
      ).status
    ).toBe(404);
  });

  it('reviews a manager suggestion with an explicit approve or defer outcome', async () => {
    const suggestionId = `suggestion-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-suggestions/${suggestionId}/review`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `suggestion-request-${tag}`,
      laneId: 'blocked',
      outcome: 'DEFER',
      notes: 'Wait for governed evidence',
    };
    expect((await request(app).post(path).set(auth()).send(body)).status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='manager_suggestion_review' AND aggregate_id=$2`,
      [organizationId, suggestionId]
    );
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, outcome: 'DEFER' });
    expect((await request(app).post(path).set(auth()).send(body)).body.status).toBe('REPLAYED');
    expect(
      (
        await request(app)
          .post(path)
          .set(auth())
          .send({ ...body, clientRequestId: `suggestion-conflict-${tag}` })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
          .send({ ...body, organizationId })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${viewerToken}` })
          .send(body)
      ).status
    ).toBe(404);
  });

  it('exposes an additive execution write-capability contract per actor', async () => {
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/capabilities`;
    const owner = await request(app).get(path).set(auth());
    expect(owner.status).toBe(200);
    expect(owner.body.executionWrites).toMatchObject({
      budgetEntry: { available: true, denialAt: null, legacyDenialAt: 'BRAMKA_LEGACY' },
      realization: { available: true, denialAt: null },
      raidMitigation: { available: true, denialAt: null },
      managerAction: { available: true, denialAt: null },
      managerSuggestionReview: { available: true, denialAt: null },
    });
    const viewer = await request(app)
      .get(path)
      .set({ Authorization: `Bearer ${viewerToken}` });
    expect(viewer.status).toBe(404);
    const foreign = await request(app)
      .get(path)
      .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId });
    expect(foreign.status).toBe(404);
  });

  it('resolves the legacy 409 prefix to an exact reachable canonical command', async () => {
    const legacy = await request(app)
      .post('/api/v8/execution-control/budget/entries')
      .set(auth())
      .send({ initiativeId });
    expect(legacy.status).toBe(409);
    expect(legacy.body).toMatchObject({
      code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      canonicalWriter: '/api/initiatives/runtime-v1',
    });
    const mapping = await request(app)
      .get(`${legacy.body.canonicalWriter}/execution-write-map`)
      .set(auth());
    expect(mapping.status).toBe(200);
    expect(mapping.body.mappings).toContainEqual({
      legacyMethod: 'POST',
      legacyPath: '/api/v8/execution-control/budget/entries',
      canonicalCommand:
        'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/budget-entries/:entryId',
    });
  });

  it('reconstructs the exact P1 source version at an as-of instant without substituting current state', async () => {
    const sourceId = `asof-source-${tag}`;
    const reportRunId = `asof-run-${tag}`;
    const eventTimes = [
      '2026-08-20T10:00:00.000Z',
      '2026-08-21T10:00:00.000Z',
      '2026-08-22T10:00:00.000Z',
    ];
    await client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'asof_test_source',$2,3,$3::jsonb),($1,'report_run',$4,1,$5::jsonb)`,
      [
        organizationId,
        sourceId,
        JSON.stringify({ initiativeId, projectId, currentValue: 3 }),
        reportRunId,
        JSON.stringify({
          reportRunId,
          projectId,
          definitionRef: { definitionId: `definition-${tag}`, version: 1 },
          parentRunRef: null,
          status: 'DRAFT',
          tenantId: organizationId,
          audience: ['OWNER'],
          scopeRefs: [initiativeId],
          period: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T23:59:59.000Z' },
          asOf: '2026-08-22T10:00:00.000Z',
          sources: [
            {
              sourceType: 'asof_test_source',
              sourceId,
              version: 3,
              capturedAt: eventTimes[2],
              freshness: 'CURRENT',
              formula: null,
              unit: null,
              currency: null,
              window: null,
              confidence: 'HIGH',
              accessState: 'FULL',
              redactions: [],
            },
          ],
          ownerId: userId,
          approverId: userId,
          validationFindings: [],
          contentHash: null,
          frozenSnapshot: null,
          approval: null,
          exportPackage: null,
          distributionReceipts: [],
          followUpTaskRef: null,
          createdAt: eventTimes[0],
          updatedAt: eventTimes[2],
        }),
      ]
    );
    for (const [index, createdAt] of eventTimes.entries()) {
      const version = index + 1;
      await client.query(
        `INSERT INTO ie_audit_events(
           organization_id,actor_id,aggregate_type,aggregate_id,aggregate_version,
           command_type,client_request_id,correlation_id,policy_id,policy_version,payload_json,created_at
         ) VALUES($1,$2,'asof_test_source',$3,$4,'asof-test.update',$5,$5,'test',1,$6::jsonb,$7)`,
        [
          organizationId,
          userId,
          sourceId,
          version,
          `asof-${version}-${tag}`,
          JSON.stringify({ value: version }),
          createdAt,
        ]
      );
    }
    const before = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2`,
      [organizationId, reportRunId]
    );
    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/reconstruct`)
      .set(auth())
      .send({ asOf: '2026-08-21T12:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reconstructable: true,
      reconstructionLevel: 'P1_VERSION_AT_INSTANT',
      sources: [{ sourceType: 'asof_test_source', sourceId, version: 2 }],
      gaps: [],
    });
    const after = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2`,
      [organizationId, reportRunId]
    );
    expect(after.rows).toEqual(before.rows);

    const beforeHistory = await request(app)
      .post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/reconstruct`)
      .set(auth())
      .send({ asOf: '2026-08-19T12:00:00.000Z' });
    expect(beforeHistory.body).toMatchObject({
      reconstructable: false,
      sources: [],
      gaps: [{ sourceType: 'asof_test_source', sourceId, reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF' }],
    });
    expect(
      (
        await request(app)
          .post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/reconstruct`)
          .set(auth())
          .send({ asOf: '2999-01-01T00:00:00.000Z' })
      ).status
    ).toBe(400);
  });

  it('computes the five owner-independent KPI families from known tenant data', async () => {
    const secondInitiativeId = `day31-initiative-two-${tag}`;
    const caseId = `kpi-case-${tag}`;
    await client.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name)
       VALUES($1,$2,$3,$1),($4,$2,$3,$4)`,
      [initiativeId, organizationId, projectId, secondInitiativeId]
    );
    await client.query(
      `INSERT INTO initiative_dependencies(
         id,organization_id,project_id,from_initiative_id,to_initiative_id,source_id,created_at
       ) VALUES($1,$2,$3,$4,$5,'day31',$6)`,
      [
        `dependency-${tag}`,
        organizationId,
        projectId,
        initiativeId,
        secondInitiativeId,
        '2026-08-25T10:00:00.000Z',
      ]
    );
    const rows = [
      ['execution_case', caseId, 3, { initiativeId, projectId }],
      [
        'execution_task',
        `task-complete-${tag}`,
        2,
        { executionCaseId: caseId, status: 'COMPLETED', dueAt: '2026-08-26T12:00:00.000Z' },
      ],
      [
        'execution_task',
        `task-blocked-${tag}`,
        4,
        { executionCaseId: caseId, status: 'BLOCKED', dueAt: '2026-08-27T12:00:00.000Z' },
      ],
      [
        'execution_milestone',
        `milestone-achieved-${tag}`,
        2,
        { executionCaseId: caseId, status: 'ACHIEVED' },
      ],
      [
        'execution_milestone',
        `milestone-open-${tag}`,
        1,
        { executionCaseId: caseId, status: 'OPEN' },
      ],
      [
        'intervention_case',
        `intervention-effective-${tag}`,
        5,
        { initiativeId, projectId, verification: { outcome: 'EFFECTIVE' } },
      ],
      [
        'intervention_case',
        `intervention-partial-${tag}`,
        4,
        { initiativeId, projectId, verification: { outcome: 'PARTIAL' } },
      ],
    ] as const;
    for (const [aggregateType, aggregateId, version, payload] of rows) {
      await client.query(
        `INSERT INTO ie_aggregate_state(
           organization_id,aggregate_type,aggregate_id,version,payload_json,updated_at
         ) VALUES($1,$2,$3,$4,$5::jsonb,'2026-08-26T12:00:00.000Z')
         ON CONFLICT (organization_id,aggregate_type,aggregate_id)
         DO UPDATE SET version=EXCLUDED.version,payload_json=EXCLUDED.payload_json,updated_at=EXCLUDED.updated_at`,
        [organizationId, aggregateType, aggregateId, version, JSON.stringify(payload)]
      );
    }
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth());
    expect(response.status).toBe(200);
    const byFamily = Object.fromEntries(
      response.body.families.map((family: any) => [family.family, family])
    );
    expect(byFamily['plan-delivery']).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
    expect(byFamily['blocked-work']).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
    expect(byFamily.milestone).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
    expect(byFamily.dependency).toMatchObject({ numerator: 1, denominator: 1, value: 1 });
    expect(byFamily['intervention-effectiveness']).toMatchObject({
      numerator: 1,
      denominator: 2,
      value: 0.5,
    });
    expect(byFamily['plan-delivery']).toMatchObject({
      drillDown: { ids: [initiativeId] },
      sourceVersion: 4,
      scopeCompleteness: 'FULL',
      valueClass: 'CALCULATED',
    });
    expect(byFamily['initiative-risk']).toMatchObject({
      drillDown: { ids: [] },
      sourceVersion: 0,
      scopeCompleteness: 'NOT_CALCULABLE',
      valueClass: 'UNKNOWN',
    });
  });

  it('marks an empty KPI population as unknown instead of zero', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2030-01-07')
      .set(auth());
    expect(response.status).toBe(200);
    const planDelivery = response.body.families.find(
      (family: any) => family.family === 'plan-delivery'
    );
    expect(planDelivery).toMatchObject({
      numerator: null,
      denominator: null,
      value: null,
      drillDown: { ids: [] },
      sourceVersion: 0,
      scopeCompleteness: 'NO_POPULATION',
      valueClass: 'UNKNOWN',
    });
  });

  it('selects KPI populations by their business due date, not row modification time', async () => {
    const dueTaskId = `due-window-${randomUUID()}`;
    const invalidTaskId = `invalid-window-${randomUUID()}`;
    await client.query(
      `INSERT INTO ie_aggregate_state
        (organization_id,aggregate_type,aggregate_id,version,payload_json,updated_at)
       VALUES($1,'execution_task',$2,1,$3::jsonb,'2040-01-01T00:00:00Z'),
             ($1,'execution_task',$4,1,$5::jsonb,'2031-01-07T00:00:00Z')`,
      [
        organizationId,
        dueTaskId,
        JSON.stringify({
          executionCaseId: 'none',
          initiativeId,
          dueAt: '2031-01-07T12:00:00Z',
          status: 'OPEN',
        }),
        invalidTaskId,
        JSON.stringify({
          executionCaseId: 'none',
          initiativeId,
          dueAt: 'not-a-date',
          status: 'OPEN',
        }),
      ]
    );
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2031-01-06')
      .set(auth());
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(
      response.body.families.find((family: any) => family.family === 'plan-delivery')
    ).toMatchObject({
      denominator: 1,
      drillDown: { ids: [] },
    });
  });

  it('allows exactly one winner under concurrent CAS for every new execution command', async () => {
    const commands = [
      {
        aggregateType: 'execution_budget_entry',
        id: `parallel-budget-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/budget-entries/${id}`,
        payload: {
          entryType: 'PLANNED',
          costType: 'OPEX',
          category: 'parallel',
          amount: 1,
          currency: 'PLN',
          description: null,
          periodMonth: 8,
          periodYear: 2026,
          source: 'MANUAL',
        },
      },
      {
        aggregateType: 'execution_realization',
        id: `parallel-realization-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations/${id}`,
        payload: {
          periodMonth: '2026-08',
          realizedRevenueDelta: 1,
          realizedCostDelta: null,
          realizedSavings: null,
          varianceNotes: null,
        },
      },
      {
        aggregateType: 'raid_mitigation',
        id: `parallel-raid-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations/${id}`,
        payload: {
          mitigationPlan: 'Parallel CAS proof',
          responseStrategy: 'MITIGATE',
          mitigationOwnerId: userId,
          mitigationDueDate: null,
          mitigationStatus: 'PLANNED',
        },
      },
      {
        aggregateType: 'manager_execution_action',
        id: `parallel-manager-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-actions/${id}`,
        payload: {
          laneId: 'blocked',
          problemId: `parallel-problem-${tag}`,
          actionId: 'escalate-owner',
          rationale: null,
        },
      },
      {
        aggregateType: 'manager_suggestion_review',
        id: `parallel-suggestion-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-suggestions/${id}/review`,
        payload: { laneId: 'blocked', outcome: 'DEFER', notes: null },
      },
    ];
    for (const command of commands) {
      const attempts = await Promise.all(
        [1, 2].map((attempt) =>
          request(app)
            .post(command.path(command.id))
            .set(auth())
            .send({
              expectedVersion: 0,
              clientRequestId: `parallel-${command.aggregateType}-${attempt}-${tag}`,
              ...command.payload,
            })
        )
      );
      expect(attempts.map((attempt) => attempt.status).sort()).toEqual([201, 409]);
      const readback = await client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM ie_aggregate_state
             WHERE organization_id=$1 AND aggregate_type=$2 AND aggregate_id=$3) AS states,
           (SELECT COUNT(*)::int FROM ie_audit_events
             WHERE organization_id=$1 AND aggregate_type=$2 AND aggregate_id=$3) AS audits`,
        [organizationId, command.aggregateType, command.id]
      );
      expect(readback.rows).toEqual([{ states: 1, audits: 1 }]);
    }
  });

  it('updates every execution control aggregate from version one to version two', async () => {
    const commands = [
      {
        aggregateType: 'execution_budget_entry',
        id: `update-budget-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/budget-entries/${id}`,
        initial: {
          entryType: 'PLANNED',
          costType: 'OPEX',
          category: 'initial',
          amount: 1,
          currency: 'PLN',
          description: null,
          periodMonth: 8,
          periodYear: 2026,
          source: 'MANUAL',
        },
        changed: { category: 'changed' },
        changedField: 'category',
      },
      {
        aggregateType: 'execution_realization',
        id: `update-realization-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations/${id}`,
        initial: {
          periodMonth: '2026-08',
          realizedRevenueDelta: 1,
          realizedCostDelta: null,
          realizedSavings: null,
          varianceNotes: 'initial',
        },
        changed: { varianceNotes: 'changed' },
        changedField: 'varianceNotes',
      },
      {
        aggregateType: 'raid_mitigation',
        id: `update-raid-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations/${id}`,
        initial: {
          mitigationPlan: 'initial',
          responseStrategy: 'MITIGATE',
          mitigationOwnerId: userId,
          mitigationDueDate: null,
          mitigationStatus: 'PLANNED',
        },
        changed: { mitigationPlan: 'changed' },
        changedField: 'mitigationPlan',
      },
      {
        aggregateType: 'manager_execution_action',
        id: `update-manager-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-actions/${id}`,
        initial: {
          laneId: 'blocked',
          problemId: `update-problem-${tag}`,
          actionId: 'initial',
          rationale: null,
        },
        changed: { actionId: 'changed' },
        changedField: 'actionId',
      },
      {
        aggregateType: 'manager_suggestion_review',
        id: `update-suggestion-${tag}`,
        path: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-suggestions/${id}/review`,
        initial: { laneId: 'blocked', outcome: 'DEFER', notes: 'initial' },
        changed: { notes: 'changed' },
        changedField: 'notes',
      },
    ];

    for (const command of commands) {
      const created = await request(app)
        .post(command.path(command.id))
        .set(auth())
        .send({
          expectedVersion: 0,
          clientRequestId: `update-create-${command.aggregateType}-${tag}`,
          ...command.initial,
        });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const updated = await request(app)
        .post(command.path(command.id))
        .set(auth())
        .send({
          expectedVersion: 1,
          clientRequestId: `update-change-${command.aggregateType}-${tag}`,
          ...command.initial,
          ...command.changed,
        });
      expect(updated.status, JSON.stringify(updated.body)).toBe(201);
      const stale = await request(app)
        .post(command.path(command.id))
        .set(auth())
        .send({
          expectedVersion: 0,
          clientRequestId: `update-stale-${command.aggregateType}-${tag}`,
          ...command.initial,
        });
      expect(stale.status).toBe(409);
      const invalid = await request(app)
        .post(command.path(`${command.id}-invalid`))
        .set(auth())
        .send({
          expectedVersion: -1,
          clientRequestId: `update-invalid-${command.aggregateType}-${tag}`,
          ...command.initial,
        });
      expect(invalid.status).toBe(400);
      const readback = await client.query(
        `SELECT version,payload_json FROM ie_aggregate_state
          WHERE organization_id=$1 AND aggregate_type=$2 AND aggregate_id=$3`,
        [organizationId, command.aggregateType, command.id]
      );
      expect(readback.rows[0].version).toBe(2);
      expect(readback.rows[0].payload_json[command.changedField]).toBe('changed');
    }
  });

  it('projects the canonical budget lifecycle into the legacy read surface', async () => {
    const entryId = `budget-lifecycle-${randomUUID()}`;
    const writePath = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/budget-entries/${entryId}`;
    const readPath = `/api/execution-control/budget/entries/${initiativeId}`;
    const initial = {
      expectedVersion: 0,
      clientRequestId: `budget-lifecycle-create-${tag}`,
      entryType: 'ACTUAL',
      costType: 'OPEX',
      category: 'lifecycle',
      amount: 1,
      currency: 'PLN',
      description: null,
      periodMonth: 8,
      periodYear: 2026,
      source: 'MANUAL',
    };
    expect((await request(app).post(writePath).set(auth()).send(initial)).status).toBe(201);
    const createdRead = await request(app).get(readPath).set(auth());
    expect(createdRead.status).toBe(200);
    expect(createdRead.body.entries).toContainEqual(
      expect.objectContaining({ id: entryId, amount: 1, origin: 'CANONICAL', version: 1 })
    );

    expect(
      (
        await request(app)
          .post(writePath)
          .set(auth())
          .send({
            ...initial,
            expectedVersion: 1,
            clientRequestId: `budget-lifecycle-update-${tag}`,
            amount: 2,
          })
      ).status
    ).toBe(201);
    const updatedRead = await request(app).get(readPath).set(auth());
    expect(updatedRead.body.entries).toContainEqual(
      expect.objectContaining({ id: entryId, amount: 2, origin: 'CANONICAL', version: 2 })
    );

    const voided = await request(app)
      .post(`${writePath}/void`)
      .set(auth())
      .send({ expectedVersion: 2, clientRequestId: `budget-lifecycle-void-${tag}` });
    expect(voided.status).toBe(201);
    const finalRead = await request(app).get(readPath).set(auth());
    expect(finalRead.body.entries.map((entry: any) => entry.id)).not.toContain(entryId);
    expect(
      await client.query(
        `SELECT version,payload_json->>'status' status FROM ie_aggregate_state
          WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
        [organizationId, entryId]
      )
    ).toMatchObject({ rows: [{ version: 3, status: 'VOIDED' }] });
  });

  it('reads the four non-budget execution control writes through runtime projections', async () => {
    const suffix = randomUUID();
    const commands = [
      {
        id: `read-realization-${suffix}`,
        write: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations/${id}`,
        read: `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations`,
        idField: 'realizationId',
        payload: {
          periodMonth: '2026-08',
          realizedRevenueDelta: 1,
          realizedCostDelta: null,
          realizedSavings: null,
          varianceNotes: null,
        },
      },
      {
        id: `read-raid-${suffix}`,
        write: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations/${id}`,
        read: `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations`,
        idField: 'raidItemId',
        payload: {
          mitigationPlan: 'Read projection',
          responseStrategy: 'MITIGATE',
          mitigationOwnerId: userId,
          mitigationDueDate: null,
          mitigationStatus: 'PLANNED',
        },
      },
      {
        id: `read-manager-${suffix}`,
        write: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-actions/${id}`,
        read: `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-actions`,
        idField: 'managerActionId',
        payload: {
          laneId: 'blocked',
          problemId: `read-problem-${suffix}`,
          actionId: 'read-action',
          rationale: null,
        },
      },
      {
        id: `read-suggestion-${suffix}`,
        write: (id: string) =>
          `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-suggestions/${id}/review`,
        read: `/api/initiatives/runtime-v1/initiatives/${initiativeId}/manager-suggestion-reviews`,
        idField: 'suggestionId',
        payload: { laneId: 'blocked', outcome: 'DEFER', notes: null },
      },
    ];
    for (const command of commands) {
      const written = await request(app)
        .post(command.write(command.id))
        .set(auth())
        .send({
          expectedVersion: 0,
          clientRequestId: `read-${command.id}`,
          ...command.payload,
        });
      expect(written.status, JSON.stringify(written.body)).toBe(201);
      const read = await request(app).get(command.read).set(auth());
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.body.items.map((item: any) => item[command.idField])).toContain(command.id);
      const foreign = await request(app)
        .get(command.read)
        .set(auth())
        .set({
          Authorization: `Bearer ${foreignToken}`,
          'X-Organization-Id': organizationId,
        });
      expect(foreign.status).toBe(200);
      expect(foreign.body.items).toEqual([]);
    }
  });
});
