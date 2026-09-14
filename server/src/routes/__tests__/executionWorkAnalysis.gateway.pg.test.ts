/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { runExecutionWorkAnalysisSchedulerTick } from '../../cron/Scheduler.js';
import { ApiGateway } from '../../Gateway.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres');
const NO_RETRY = { retry: 0 } as const;

describe.skipIf(!REAL_PG)('F2-2 E2 weekly analysis + manager actions through Gateway/JWT/RealPG', NO_RETRY, () => {
  const org = randomUUID();
  const owner = randomUUID();
  const member = randomUUID();
  const project = randomUUID();
  const initiative = randomUUID();
  const executionCase = randomUUID();
  const task = randomUUID();
  let db: Client;
  let app: express.Express;
  let authorization: string;
  let memberAuthorization: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.ENABLE_EXECUTION_WORK_ANALYSIS = 'true';
    db = new Client({ connectionString: DATABASE_URL });
    await db.connect();
    await db.query(`INSERT INTO organizations(id,name,status) VALUES($1,'S4 proof','active')`, [org]);
    await db.query(`INSERT INTO users(id,organization_id,email,role,status,first_name,last_name) VALUES($1,$2,$3,'OWNER','active','S4','Owner')`, [owner, org, `${owner}@example.test`]);
    await db.query(`INSERT INTO users(id,organization_id,email,role,status,first_name,last_name) VALUES($1,$2,$3,'USER','active','S4','Member')`, [member, org, `${member}@example.test`]);
    await db.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [`membership-${owner}`, org, owner]);
    await db.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER','ACTIVE')`, [`membership-${member}`, org, member]);
    await db.query(`INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'North plant transformation','active',$3)`, [project, org, owner]);
    await db.query(`INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_execution_id) VALUES($1,$2,$3,'Commission line','IN_EXECUTION',$4)`, [initiative, org, project, owner]);
    await db.query(
      `INSERT INTO tasks(id,organization_id,project_id,initiative_id,title,status,due_date,assignee_id,estimated_hours)
       VALUES($1,$2,$3,$4,'Blocked commissioning','BLOCKED','2026-09-01',$5,NULL)`,
      [task, org, project, initiative, owner]
    );
    await db.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
       ($1,'initiative',$2,3,$3::jsonb),
       ($1,'execution_case',$4,2,$5::jsonb),
       ($1,'execution_task',$6,7,$7::jsonb)`,
      [
        org,
        initiative,
        JSON.stringify({ initiativeId: initiative, title: 'Commission line', projectId: project, lifecycleState: 'IN_EXECUTION' }),
        executionCase,
        JSON.stringify({ initiativeId: initiative, state: 'ACTIVE', executionManagerId: owner, handoffPackageId: 'handoff-proof' }),
        task,
        JSON.stringify({ executionCaseId: executionCase, title: 'Blocked commissioning', status: 'BLOCKED', assigneeId: owner, dueAt: '2026-09-01T12:00:00.000Z', priority: 'HIGH' }),
      ]
    );
    authorization = `Bearer ${jwt.sign({ id: owner, userId: owner, organizationId: org, organization_id: org, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    memberAuthorization = `Bearer ${jwt.sign({ id: member, userId: member, organizationId: org, organization_id: org, role: 'USER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (db) {
      await db.query(`DELETE FROM manager_action_audit_log WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM execution_report_snapshots WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM tasks WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM initiatives WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM projects WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
      await db.query(`DELETE FROM organizations WHERE id=$1`, [org]);
      await db.end();
    }
    delete process.env.ENABLE_EXECUTION_WORK_ANALYSIS;
  });

  const call = async (path: string, init?: { method?: 'POST'; body?: string; authorization?: string }) => {
    const agent = init?.method === 'POST' ? request(app).post(path) : request(app).get(path);
    const response = agent
      .set('Authorization', init?.authorization ?? authorization)
      .set('Content-Type', 'application/json');
    if (init?.body) response.send(JSON.parse(init.body));
    const completed = await response;
    return { status: completed.status, body: completed.body as any };
  };
  const unwrap = (body: any) => body?.data?.data ?? body?.data ?? body;

  it('returns the real project name and stores one idempotent weekly result', async () => {
    const cases = await call('/api/initiatives/runtime-v1/execution-cases');
    expect(cases.status, JSON.stringify(cases.body)).toBe(200);
    const caseRows = unwrap(cases.body).cases;
    if (!Array.isArray(caseRows)) throw new Error(`Unexpected cases envelope: ${JSON.stringify(cases.body)}`);
    expect(caseRows).toEqual(expect.arrayContaining([expect.objectContaining({ executionCaseId: executionCase, projectId: project, projectTitle: 'North plant transformation' })]));

    await runExecutionWorkAnalysisSchedulerTick();
    const scheduled = await call('/api/execution-reports/work-analysis/generate', { method: 'POST', body: JSON.stringify({ weekOf: '2026-09-14' }) });
    expect(scheduled.status, JSON.stringify(scheduled.body)).toBe(200);

    const first = await call('/api/execution-reports/work-analysis/generate', { method: 'POST', body: JSON.stringify({ weekOf: '2026-09-21' }) });
    const replay = await call('/api/execution-reports/work-analysis/generate', { method: 'POST', body: JSON.stringify({ weekOf: '2026-09-23' }) });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.id).toBe(first.body.id);
    expect(JSON.stringify(first.body.payload)).toContain('North plant transformation');
    const count = await db.query(`SELECT count(*)::int count FROM execution_report_snapshots WHERE organization_id=$1 AND definition_key='weekly-exec'`, [org]);
    expect(count.rows[0].count).toBe(2);

    process.env.ENABLE_EXECUTION_WORK_ANALYSIS = 'false';
    const disabled = await call('/api/execution-reports/work-analysis/generate', {
      method: 'POST', body: JSON.stringify({ weekOf: '2026-09-14' }),
    });
    expect(disabled.status, JSON.stringify(disabled.body)).toBe(404);
    process.env.ENABLE_EXECUTION_WORK_ANALYSIS = 'true';
  });

  it('executes resource change through managerActionExecutionService route and writes its audit', async () => {
    const problems = await call('/api/v8/execution-control/manager/lanes/workload/problems');
    expect(problems.status, JSON.stringify(problems.body)).toBe(200);
    const rows = unwrap(problems.body).problems;
    if (!Array.isArray(rows)) throw new Error(`Unexpected manager envelope: ${JSON.stringify(problems.body)}`);
    const problem = rows.find((row: any) => row.sourceEntityId === task && row.actions.some((action: any) => action.id === 'set_capacity'));
    expect(problem).toBeTruthy();
    const executed = await call('/api/v8/execution-control/manager/lanes/workload/problem-actions/execute', {
      method: 'POST', body: JSON.stringify({ problemId: problem.id, actionId: 'set_capacity' }),
    });
    expect(executed.status, JSON.stringify(executed.body)).toBe(200);
    const taskReadback = await db.query(`SELECT estimated_hours FROM tasks WHERE id=$1 AND organization_id=$2`, [task, org]);
    expect(Number(taskReadback.rows[0].estimated_hours)).toBe(8);
    const audit = await db.query(`SELECT action FROM manager_action_audit_log WHERE organization_id=$1 AND entity_id=$2`, [org, task]);
    expect(audit.rows.map((row) => row.action)).toContain('manager_set_capacity');

    const adjacent = await call('/api/v8/execution-control/manager/lanes/workload/suggestions/apply', {
      method: 'POST', body: JSON.stringify({ suggestionId: 'sug-wl:rebalance-top-overload' }),
    });
    expect(adjacent.status, JSON.stringify(adjacent.body)).toBe(409);
    expect(adjacent.body.code).toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');

    const forbidden = await call('/api/v8/execution-control/manager/lanes/workload/problem-actions/execute', {
      method: 'POST',
      body: JSON.stringify({ problemId: problem.id, actionId: 'set_capacity' }),
      authorization: memberAuthorization,
    });
    expect(forbidden.status, JSON.stringify(forbidden.body)).toBe(403);
  });
});
