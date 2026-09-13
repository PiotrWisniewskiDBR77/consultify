import { randomBytes } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../server/src/Gateway.js';
import config from '../../server/src/config/Config.js';
import {
  buildExecutionBankRows,
  type ExecutionBankCaseSource,
} from '../../src/components/Execution/executionBankModel.js';

const databaseConfig = (): ClientConfig => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('REAL_DB_REQUIRED');
  return {
    connectionString: databaseUrl,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 8_000,
  };
};

const token = (userId: string, organizationId: string) =>
  jwt.sign(
    {
      id: userId,
      organizationId,
      role: 'ADMIN',
      userRole: 'ADMIN',
      email: `${userId}@local.test`,
    },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  );

describe('E1b native accepted baseline through signed-JWT Gateway and PostgreSQL', () => {
  const suffix = `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const orgA = `org_e1b_baseline_a_${suffix}`;
  const orgB = `org_e1b_baseline_b_${suffix}`;
  const userA = `user_e1b_baseline_a_${suffix}`;
  const userB = `user_e1b_baseline_b_${suffix}`;
  const projectA = `project_e1b_baseline_a_${suffix}`;
  const initiativeId = `initiative_e1b_baseline_${suffix}`;
  const executionCaseId = `case_e1b_baseline_${suffix}`;
  const handoffPackageId = `handoff_e1b_baseline_${suffix}`;
  const decisionId = `decision_e1b_baseline_${suffix}`;
  const client = new Client(databaseConfig());
  let app: express.Express;
  let acceptedAt = '';

  beforeAll(async () => {
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
    process.env.E2E_MODE = 'false';
    await client.connect();
    await client.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES
       ($1,'E1b baseline A','enterprise','active'),
       ($2,'E1b baseline B','enterprise','active')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name) VALUES
       ($1,$2,$3,'unused','ADMIN','active','Baseline','Owner'),
       ($4,$5,$6,'unused','ADMIN','active','Baseline','Foreign')`,
      [userA, orgA, `${userA}@local.test`, userB, orgB, `${userB}@local.test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES
       ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE')`,
      [`member_${userA}`, orgA, userA, `member_${userB}`, orgB, userB]
    );
    await client.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'E1b native baseline project','active',$3)`,
      [projectA, orgA, userA]
    );
    await client.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'PROJECT_MANAGER')`,
      [`project_member_${userA}`, projectA, userA]
    );
    await client.query(
      `INSERT INTO ie_aggregate_state
       (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
       ($1,'initiative',$2,11,$3::jsonb),
       ($1,'handoff_package',$4,1,$5::jsonb)`,
      [
        orgA,
        initiativeId,
        JSON.stringify({
          initiativeId,
          title: 'Native accepted baseline',
          projectId: projectA,
          lifecycleState: 'SCHEDULED',
          executionState: 'HANDOFF_PENDING',
          handoffPackageId,
        }),
        handoffPackageId,
        JSON.stringify({
          handoffPackageId,
          version: 1,
          initiativeId,
          decisionId: `schedule_${decisionId}`,
          executionManagerId: userA,
          snapshot: {
            scope: { included: ['baseline projection'] },
            selectedOptions: { selected: 'same-id' },
            success: { criteria: ['visible accepted baseline'] },
            baseline: {
              plannedStartDate: '2028-02-01',
              plannedEndDate: '2028-03-15',
            },
            openWork: [],
            raid: [],
            outcomeRefs: [],
            sourceVersions: { initiative: 11 },
          },
          portfolio: { id: `portfolio_${suffix}`, version: 1 },
          plan: {
            id: `plan_${suffix}`,
            version: 1,
            windowUnit: 'WEEK',
            timezone: 'Europe/Warsaw',
            window: {
              earliest: '2028-01-01',
              target: '2028-01-15',
              latest: '2028-04-01',
            },
          },
          capacity: { id: `capacity_${suffix}`, version: 1 },
          commitmentVersions: {},
          createdAt: '2028-01-05T08:00:00.000Z',
        }),
      ]
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    try {
      await client.query(
        `DELETE FROM ie_aggregate_relations WHERE organization_id = ANY($1::text[])`,
        [[orgA, orgB]]
      );
      await client.query(
        `DELETE FROM ie_command_receipts WHERE organization_id = ANY($1::text[])`,
        [[orgA, orgB]]
      );
      await client.query(`DELETE FROM ie_audit_events WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await client.query(`DELETE FROM ie_outbox_events WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await client.query(`DELETE FROM project_members WHERE project_id=$1`, [projectA]);
      await client.query(`DELETE FROM projects WHERE id=$1`, [projectA]);
      await client.query(
        `DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`,
        [[orgA, orgB]]
      );
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [
        [orgA, orgB],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);
      const remaining = await client.query<{ category: string; count: number }>(
        `SELECT 'aggregate_state' category, COUNT(*)::int count FROM ie_aggregate_state
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'aggregate_relations', COUNT(*)::int FROM ie_aggregate_relations
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'command_receipts', COUNT(*)::int FROM ie_command_receipts
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'audit_events', COUNT(*)::int FROM ie_audit_events
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'outbox_events', COUNT(*)::int FROM ie_outbox_events
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'project_members', COUNT(*)::int FROM project_members WHERE project_id=$2
         UNION ALL SELECT 'projects', COUNT(*)::int FROM projects WHERE id=$2
         UNION ALL SELECT 'organization_members', COUNT(*)::int FROM organization_members
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'users', COUNT(*)::int FROM users
         WHERE organization_id = ANY($1::text[])
         UNION ALL SELECT 'organizations', COUNT(*)::int FROM organizations
         WHERE id = ANY($1::text[])`,
        [[orgA, orgB], projectA]
      );
      if (remaining.rows.some((row) => row.count !== 0)) {
        throw new Error('E1B_NATIVE_BASELINE_FIXTURE_CLEANUP_FAILED');
      }
    } finally {
      await client.end();
    }
  });

  it('returns the accepted snapshot and exact causal provenance for the visible same-ID Case', async () => {
    const bearer = `Bearer ${token(userA, orgA)}`;
    const handoffRequest = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/handoff/requests`)
      .set('Authorization', bearer)
      .send({
        expectedVersion: 11,
        clientRequestId: `request_${decisionId}`,
        decisionId,
        handoffPackageId,
        handoffPackageVersion: 1,
        executionCaseId,
        authorityId: userA,
        dueAt: '2028-01-20T12:00:00.000Z',
        rolloutChildren: { pilot: [], waves: [] },
      });
    expect(handoffRequest.status, JSON.stringify(handoffRequest.body)).toBe(201);
    const handoffDecision = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/handoff/decisions`)
      .set('Authorization', bearer)
      .send({
        expectedVersion: 12,
        clientRequestId: `accept_${decisionId}`,
        decisionId,
        outcome: 'ACCEPT',
        gaps: [],
        blockers: [],
        rationale: 'Exact typed baseline accepted for read projection proof.',
      });
    expect(handoffDecision.status, JSON.stringify(handoffDecision.body)).toBe(201);

    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', bearer);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    acceptedAt = response.body.cases[0]?.acceptedAt;
    expect(Number.isFinite(Date.parse(acceptedAt))).toBe(true);
    expect(response.body.cases).toEqual([
      expect.objectContaining({
        executionCaseId,
        initiativeId,
        initiativeTitle: 'Native accepted baseline',
        version: 1,
        handoffPackageId,
        handoffPackageVersion: 1,
        acceptedAt,
        acceptedBaseline: expect.objectContaining({
          baseline: {
            plannedStartDate: '2028-02-01',
            plannedEndDate: '2028-03-15',
          },
          scope: expect.any(Object),
        }),
      }),
    ]);
  });

  it('projects the Gateway response as known exact baseline without using the wider Plan window', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', `Bearer ${token(userA, orgA)}`);
    const [row] = buildExecutionBankRows(
      [{ id: initiativeId, name: 'Native accepted baseline', lifecycleStatus: 'IN_EXECUTION' }],
      response.body.cases as ExecutionBankCaseSource[],
      { asOf: new Date(Date.parse(acceptedAt) + 1_000).toISOString() }
    );

    expect(row.initiativeId).toBe(initiativeId);
    expect(row.executionCaseId).toBe(executionCaseId);
    expect(row.baselineStart).toMatchObject({
      status: 'KNOWN',
      value: '2028-02-01',
      meta: { source: `ie_aggregate_state:${executionCaseId}` },
    });
    expect(row.baselineFinish).toMatchObject({ status: 'KNOWN', value: '2028-03-15' });
  });

  it('keeps the accepted baseline unavailable before its persisted acceptance time', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', `Bearer ${token(userA, orgA)}`);
    const [row] = buildExecutionBankRows(
      [{ id: initiativeId, name: 'Native accepted baseline', lifecycleStatus: 'IN_EXECUTION' }],
      response.body.cases as ExecutionBankCaseSource[],
      { asOf: new Date(Date.parse(acceptedAt) - 1).toISOString() }
    );

    expect(row.baselineStart).toMatchObject({ status: 'UNKNOWN', reason: 'BASELINE_AFTER_AS_OF' });
    expect(row.baselineFinish).toMatchObject({
      status: 'UNKNOWN',
      reason: 'BASELINE_AFTER_AS_OF',
    });
  });

  it('returns no cross-tenant Case to another signed-in organization', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', `Bearer ${token(userB, orgB)}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.cases).toEqual([]);
  });

  it('rejects anonymous and invalid-signature reads', async () => {
    const [anonymous, invalid] = await Promise.all([
      request(app).get('/api/initiatives/runtime-v1/execution-cases'),
      request(app)
        .get('/api/initiatives/runtime-v1/execution-cases')
        .set('Authorization', `Bearer ${token(userA, orgA)}invalid`),
    ]);
    expect(anonymous.status).toBe(401);
    expect(invalid.status).toBe(401);
  });
});
