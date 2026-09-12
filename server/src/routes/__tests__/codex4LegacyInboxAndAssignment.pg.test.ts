/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { errorHandlerMiddleware } from '../../utils/ErrorHandler.js';

describe('CODEX4 E1 legacy inbox and projectless assignment', { retry: 0 }, () => {
  const org = randomUUID();
  const foreignOrg = randomUUID();
  const owner = randomUUID();
  const assignee = randomUUID();
  const foreign = randomUUID();
  const task = randomUUID();
  const blockedTask = randomUUID();
  const projectTask = randomUUID();
  const project = randomUUID();
  const decision = randomUUID();
  const notification = randomUUID();
  let sql: Client;
  let app: Express;
  const auth = (id = owner, organizationId = org) =>
    `Bearer ${jwt.sign({ id, userId: id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { expiresIn: '10m' })}`;
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/cx4_/);
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    sql = new Client({ connectionString: process.env.DATABASE_URL });
    await sql.connect();
    await sql.query(
      "INSERT INTO organizations(id,name,status) VALUES($1,'C4 local','active'),($2,'C4 foreign','active')",
      [org, foreignOrg]
    );
    for (const [id, oid] of [
      [owner, org],
      [assignee, org],
      [foreign, foreignOrg],
    ]) {
      await sql.query(
        "INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused-local','OWNER','active')",
        [id, oid, `${id}@test.invalid`]
      );
      await sql.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",
        [randomUUID(), oid, id]
      );
    }
    await sql.query(
      "INSERT INTO tasks(id,organization_id,title,status,task_type,owner_id,assignee_id,created_by) VALUES($1,$2,'C4 visible task','todo','personal',$3,$3,$3)",
      [task, org, owner]
    );
    await sql.query(
      "INSERT INTO tasks(id,organization_id,title,status,task_type,owner_id,assignee_id,blocked_at) VALUES($1,$2,'C4 blocked task','blocked','personal',$3,$3,CURRENT_TIMESTAMP)",
      [blockedTask, org, owner]
    );
    await sql.query(
      "INSERT INTO decisions(id,organization_id,title,status,decision_maker_id,created_at) VALUES($1,$2,'C4 pending decision','pending',$3,CURRENT_TIMESTAMP)",
      [decision, org, owner]
    );
    await sql.query(
      "INSERT INTO notifications(id,user_id,organization_id,type,title,read,created_at) VALUES($1,$2,$3,'system','C4 notification',0,CURRENT_TIMESTAMP)",
      [notification, owner, org]
    );
    await sql.query(
      "INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'C4 assignment project',$3)",
      [project, org, owner]
    );
    await sql.query(
      "INSERT INTO project_members(id,project_id,user_id,project_role) VALUES($1,$2,$3,'TASK_ASSIGNEE')",
      [randomUUID(), project, assignee]
    );
    await sql.query(
      "INSERT INTO tasks(id,organization_id,project_id,title,status,owner_id) VALUES($1,$2,$3,'C4 project task','todo',$4)",
      [projectTask, org, project, owner]
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    app.use((err: any, _req: any, _res: any, next: any) => {
      console.error('C4_RUNTIME_ERROR', err.stack);
      next(err);
    });
    app.use(errorHandlerMiddleware);
  }, 30000);
  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM notifications WHERE id=$1', [notification]);
    await sql.query('DELETE FROM decisions WHERE id=$1', [decision]);
    await sql.query('DELETE FROM tasks WHERE organization_id=$1', [org]);
    await sql.query('DELETE FROM project_members WHERE project_id=$1', [project]);
    await sql.query('DELETE FROM projects WHERE id=$1', [project]);
    await sql.query('DELETE FROM organization_members WHERE organization_id IN ($1,$2)', [
      org,
      foreignOrg,
    ]);
    await sql.query('DELETE FROM users WHERE organization_id IN ($1,$2)', [org, foreignOrg]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1,$2)', [org, foreignOrg]);
    await sql.end();
  });
  for (const status of ['open', 'done', 'saved', 'all']) {
    it(`legacy inbox ${status}: 200 with fallback shape`, async () => {
      const r = await request(app)
        .get(`/api/my-work/inbox?limit=200&status=${status}`)
        .set('Authorization', auth());
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(Array.isArray(r.body.items)).toBe(true);
      expect(r.body.summary).toBeTypeOf('object');
      expect(r.body.summary.newToday).toBe(4);
      for (const item of r.body.items) expect(item.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      if (status === 'open' || status === 'all')
        expect(r.body.items.map((x: any) => x.title).sort()).toEqual(
          ['C4 visible task', 'C4 blocked task', 'C4 pending decision', 'C4 notification'].sort()
        );
    });
  }
  for (const target of ['same organization', 'foreign organization'] as const) {
    it(`projectless assign ${target}: actionable 422 and no write`, async () => {
      const before = (await sql.query('SELECT * FROM tasks WHERE id=$1', [task])).rows[0];
      const r = await request(app)
        .post(`/api/tasks/${task}/assign`)
        .set('Authorization', auth())
        .send({ assigneeId: target === 'same organization' ? assignee : foreign });
      expect(r.status, JSON.stringify(r.body)).toBe(422);
      expect(r.body.error.code).toBe('TASK_ASSIGNMENT_PROJECT_REQUIRED');
      expect(r.body.error.message).toBe('Add this task to a project before assigning it.');
      expect((await sql.query('SELECT * FROM tasks WHERE id=$1', [task])).rows[0]).toEqual(before);
    });
  }
  it('foreign caller cannot assign another organization task', async () => {
    const before = (await sql.query('SELECT * FROM tasks WHERE id=$1', [task])).rows[0];
    const r = await request(app)
      .post(`/api/tasks/${task}/assign`)
      .set('Authorization', auth(foreign, foreignOrg))
      .send({ assigneeId: foreign });
    expect(r.status, JSON.stringify(r.body)).toBe(404);
    expect((await sql.query('SELECT * FROM tasks WHERE id=$1', [task])).rows[0]).toEqual(before);
  });
  it('project assignment with an eligible member remains 200 and persists SLA', async () => {
    const r = await request(app)
      .post(`/api/tasks/${projectTask}/assign`)
      .set('Authorization', auth())
      .send({ assigneeId: assignee, slaHours: 24 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const row = (
      await sql.query('SELECT assignee_id, sla_hours, sla_due_at FROM tasks WHERE id=$1', [
        projectTask,
      ])
    ).rows[0];
    expect(row.assignee_id).toBe(assignee);
    expect(row.sla_hours).toBe(24);
    expect(new Date(row.sla_due_at).getTime()).toBeGreaterThan(Date.now());
  });
  it('projectless reassign shares the same domain refusal', async () => {
    const r = await request(app)
      .post(`/api/tasks/${task}/reassign`)
      .set('Authorization', auth())
      .send({ fromAssigneeId: owner, toAssigneeId: assignee, reason: 'C4 check' });
    expect(r.status, JSON.stringify(r.body)).toBe(422);
    expect(r.body.error.code).toBe('TASK_ASSIGNMENT_PROJECT_REQUIRED');
  });
});
