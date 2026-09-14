/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Q1 P3 workload through ApiGateway/JWT/RealPG', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const foreignProjectId = randomUUID();
  const initiativeId = randomUUID();
  const foreignInitiativeId = randomUUID();
  const runningInitiativeId = randomUUID();
  const availableUserId = randomUUID();
  const zeroCapacityUserId = randomUUID();
  const scopedTaskId = randomUUID();
  const runningTaskId = randomUUID();
  let sql: Client;
  let app: Express;
  let authorization: string;
  let approverAuthorization: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const [{ default: config }, { ApiGateway }, { get: dbGet }] = await Promise.all([
      import('../../config/Config.js'),
      import('../../Gateway.js'),
      import('../../utils/DbPromise.js'),
    ]);
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id,name,plan,status,is_active,created_at)
       VALUES ($1,'Q1 workload','enterprise','active',1,now()),
              ($2,'Q1 workload foreign','enterprise','active',1,now())`,
      [organizationId, foreignOrganizationId]
    );
    await sql.query(
      `INSERT INTO users
         (id,organization_id,email,password,first_name,last_name,role,status,weekly_capacity_hours,availability_percent,created_at)
       VALUES ($1,$2,$3,'x','Anna','Capacity','ADMIN','active',20,100,now()),
              ($4,$2,$5,'x','Ola','Available','USER','active',40,100,now()),
              ($6,$2,$7,'x','Zen','Zero','USER','active',0,100,now())`,
      [
        userId,
        organizationId,
        `${userId}@example.test`,
        availableUserId,
        `${availableUserId}@example.test`,
        zeroCapacityUserId,
        `${zeroCapacityUserId}@example.test`,
      ]
    );
    await sql.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE',now()),($4,$2,$5,'ADMIN','ACTIVE',now())`,
      [randomUUID(), organizationId, userId, randomUUID(), availableUserId]
    );
    expect(
      (
        await sql.query(
          'SELECT status FROM organization_members WHERE organization_id=$1 AND user_id=$2',
          [organizationId, userId]
        )
      ).rows[0]?.status
    ).toBe('ACTIVE');
    expect(
      await dbGet<{ status: string }>(
        'SELECT status FROM organization_members WHERE organization_id = ? AND user_id = ?',
        [organizationId, userId],
        { fallback: false }
      )
    ).toMatchObject({ status: 'ACTIVE' });
    await sql.query(
      `INSERT INTO projects (id,organization_id,name,status,created_at)
       VALUES ($1,$2,'Apollo','active',now()),($3,$2,'Other','active',now())`,
      [projectId, organizationId, foreignProjectId]
    );
    await sql.query(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status,created_at,updated_at)
       VALUES ($1,$2,$3,'Apollo initiative','PENDING_APPROVAL',now(),now()),
              ($4,$2,$5,'Other initiative','APPROVED',now(),now()),
              ($6,$2,$3,'Running initiative','IN_EXECUTION',now(),now())`,
      [
        initiativeId,
        organizationId,
        projectId,
        foreignInitiativeId,
        foreignProjectId,
        runningInitiativeId,
      ]
    );
    await sql.query(
      `INSERT INTO tasks
         (id,organization_id,project_id,initiative_id,title,status,assignee_id,estimated_hours,due_date,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'Scoped demand','todo',$5,30,current_date + 2,now(),now()),
              ($6,$2,$7,$8,'Excluded demand','todo',$5,10,current_date + 2,now(),now()),
              ($9,$2,$7,$4,'Canonical project wins','todo',$10,8,current_date + 2,now(),now()),
              ($11,$2,$3,$12,'Running demand','todo',$5,12,current_date + 2,now(),now())`,
      [
        scopedTaskId,
        organizationId,
        projectId,
        initiativeId,
        userId,
        randomUUID(),
        foreignProjectId,
        foreignInitiativeId,
        randomUUID(),
        zeroCapacityUserId,
        runningTaskId,
        runningInitiativeId,
      ]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30m' }
    )}`;
    approverAuthorization = `Bearer ${jwt.sign(
      {
        id: availableUserId,
        userId: availableUserId,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM ie_aggregate_state WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM tasks WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM initiatives WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM users WHERE id IN ($1,$2,$3)', [
      userId,
      availableUserId,
      zeroCapacityUserId,
    ]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1,$2)', [
      organizationId,
      foreignOrganizationId,
    ]);
    await sql.end();
    delete process.env.ENABLE_INITIATIVES_WORKLOAD;
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    delete process.env.RUN_DB_TESTS;
    delete process.env.MOCK_DB;
  });

  it('rejects an unauthenticated read and returns only the selected canonical project/status', async () => {
    const path = `/api/execution-control/capacity/initiative-workload?weeks=1&projectId=${projectId}&initiativeStatuses=PENDING_APPROVAL`;
    expect((await request(app).get(path)).status).toBe(401);

    const response = await request(app).get(path).set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.people).toHaveLength(3);
    expect(response.body.rows).toHaveLength(3);
    expect(
      response.body.rows.find((row: { userId: string }) => row.userId === userId)
    ).toMatchObject({
      userId,
      demandHours: 30,
      supplyHours: 20,
      utilizationPercent: 150,
    });
    expect(
      response.body.rows.find((row: { userId: string }) => row.userId === availableUserId)
    ).toMatchObject({ userId: availableUserId, demandHours: 0, utilizationPercent: 0 });
    expect(
      response.body.rows.find((row: { userId: string }) => row.userId === zeroCapacityUserId)
    ).toMatchObject({
      userId: zeroCapacityUserId,
      demandHours: 8,
      supplyHours: 0,
      capacityExceeded: true,
    });
    expect(response.body.summary.overloadedCount).toBe(2);

    const invalidStatus = await request(app)
      .get(`/api/execution-control/capacity/initiative-workload?initiativeStatuses=PLANNING`)
      .set('Authorization', authorization);
    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body.code).toBe('INVALID_INITIATIVE_STATUS');

    process.env.ENABLE_INITIATIVES_WORKLOAD = 'false';
    const offResponse = await request(app).get(path).set('Authorization', authorization);
    expect(offResponse.status).toBe(404);
    expect(offResponse.body.code).toBe('INITIATIVES_WORKLOAD_DISABLED');
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';
  });

  it('persists availability, proposes planning moves without mutation, and freezes a shared-engine workload report', async () => {
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'false';
    const disabledProposal = await request(app)
      .post('/api/initiatives/runtime-v1/workload-proposals')
      .set('Authorization', authorization)
      .send({ weeks: 1, projectId });
    expect(disabledProposal.status).toBe(404);
    expect(disabledProposal.body.error?.code).toBe('FEATURE_DISABLED');
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';

    const capacity = await request(app)
      .patch(`/api/users/${availableUserId}/capacity`)
      .set('Authorization', approverAuthorization)
      .send({ weeklyCapacityHours: 32, availabilityPercent: 50 });
    expect(capacity.status, JSON.stringify(capacity.body)).toBe(200);
    expect(capacity.body).toMatchObject({
      userId: availableUserId,
      weeklyCapacityHours: 32,
      availabilityPercent: 50,
    });
    expect(
      (
        await sql.query(
          'SELECT weekly_capacity_hours,availability_percent FROM users WHERE id=$1',
          [availableUserId]
        )
      ).rows[0]
    ).toMatchObject({ weekly_capacity_hours: '32.00', availability_percent: 50 });

    const beforeAssignee = (
      await sql.query('SELECT assignee_id FROM tasks WHERE id=$1', [scopedTaskId])
    ).rows[0]?.assignee_id;
    const beforeRunningAssignee = (
      await sql.query('SELECT assignee_id FROM tasks WHERE id=$1', [runningTaskId])
    ).rows[0]?.assignee_id;
    const proposal = await request(app)
      .post('/api/initiatives/runtime-v1/workload-proposals')
      .set('Authorization', authorization)
      .send({ weeks: 1, projectId, initiativeStatuses: ['PENDING_APPROVAL'] });
    expect(proposal.status, JSON.stringify(proposal.body)).toBe(200);
    expect(proposal.body).toMatchObject({
      mode: 'RULE_BASED_AI',
      planningOnly: true,
      applied: false,
    });
    expect(proposal.body.proposals.length).toBeGreaterThan(0);
    expect(
      proposal.body.proposals.some((item: { taskId: string }) => item.taskId === runningTaskId)
    ).toBe(false);
    expect(
      (await sql.query('SELECT assignee_id FROM tasks WHERE id=$1', [scopedTaskId])).rows[0]
        ?.assignee_id
    ).toBe(beforeAssignee);
    expect(
      (await sql.query('SELECT assignee_id FROM tasks WHERE id=$1', [runningTaskId])).rows[0]
        ?.assignee_id
    ).toBe(beforeRunningAssignee);

    const definitionId = randomUUID();
    const reportRunId = randomUUID();
    const createDefinition = await request(app)
      .post(`/api/initiatives/runtime-v1/report-definitions/${definitionId}`)
      .set('Authorization', authorization)
      .send({
        name: 'Workload capacity',
        purpose: 'Capacity planning review',
        audience: ['capacity@example.test'],
        cadence: 'ON_DEMAND',
        scope: {
          type: 'PROJECT',
          refs: [`project:${projectId}`],
          projectIds: [projectId],
          generalBacklogAllowed: false,
        },
        outputSchema: { kind: 'initiative_workload_report', templateId: 'WORKLOAD_CAPACITY' },
        sections: [{ sectionId: 'WORKLOAD', title: 'Workload', mandatory: true }],
        sourceBindings: [
          {
            bindingId: 'workload',
            sourceType: 'initiative_workload',
            required: true,
            scope: 'tenant',
          },
        ],
        formulas: [],
        units: ['hours'],
        currencies: [],
        windows: [{ windowId: 'horizon', duration: 'P8W', timezone: 'UTC' }],
        access: { audienceRoles: ['ADMIN'], classification: 'INTERNAL' },
        redaction: { rules: ['TENANT_BOUND'], defaultState: 'FULL' },
        freshnessThresholdMinutes: 60,
        confidenceThreshold: 'HIGH',
        ownerId: userId,
        approverId: availableUserId,
        expectedVersion: 0,
        clientRequestId: randomUUID(),
      });
    expect(createDefinition.status, JSON.stringify(createDefinition.body)).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/initiatives/runtime-v1/report-definitions/${definitionId}/transitions`)
          .set('Authorization', authorization)
          .send({ action: 'VALIDATE', expectedVersion: 1, clientRequestId: randomUUID() })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/initiatives/runtime-v1/report-definitions/${definitionId}/transitions`)
          .set('Authorization', approverAuthorization)
          .send({
            action: 'PUBLISH',
            rationale: 'Independent workload definition approval',
            expectedVersion: 2,
            clientRequestId: randomUUID(),
          })
      ).status
    ).toBe(200);

    const createRunPayload = {
        definitionRef: { definitionId, version: 1 },
        parentRunRef: null,
        audience: ['capacity@example.test'],
        scopeRefs: [`project:${projectId}`],
        period: { start: '2026-09-14T00:00:00.000Z', end: '2026-11-09T00:00:00.000Z' },
        asOf: '2026-09-14T09:00:00.000Z',
        workReport: {
          title: 'Workload capacity',
          templateId: 'WORKLOAD_CAPACITY',
          cadence: 'ON_DEMAND',
          projectIds: [projectId],
        },
        sources: [],
        ownerId: userId,
        approverId: availableUserId,
        expectedVersion: 0,
        clientRequestId: randomUUID(),
      };
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'false';
    const disabledRun = await request(app)
      .post(`/api/initiatives/runtime-v1/report-runs/${randomUUID()}`)
      .set('Authorization', authorization)
      .send(createRunPayload);
    expect(disabledRun.status).toBe(404);
    expect(disabledRun.body.error?.code).toBe('FEATURE_DISABLED');
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';

    const createRun = await request(app)
      .post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}`)
      .set('Authorization', authorization)
      .send({ ...createRunPayload, clientRequestId: randomUUID() });
    expect(createRun.status, JSON.stringify(createRun.body)).toBe(201);
    for (const [action, expectedVersion] of [
      ['VALIDATE', 1],
      ['FREEZE', 2],
    ] as const) {
      const transition = await request(app)
        .post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/transitions`)
        .set('Authorization', authorization)
        .send({
          action,
          profile: 'initiative_work_report',
          expectedVersion,
          clientRequestId: randomUUID(),
        });
      expect(transition.status, JSON.stringify(transition.body)).toBe(200);
    }
    const stored = (
      await sql.query(
        `SELECT payload_json FROM ie_aggregate_state
         WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2`,
        [organizationId, reportRunId]
      )
    ).rows[0]?.payload_json;
    expect(stored).toMatchObject({
      status: 'FROZEN',
      workReport: { templateId: 'WORKLOAD_CAPACITY' },
      frozenSnapshot: { workReport: { content: { workload: { overloadedCount: 2 } } } },
    });
  });
});
