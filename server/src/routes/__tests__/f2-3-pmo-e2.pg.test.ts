/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { errorHandlerMiddleware } from '../../utils/ErrorHandler.js';

const databaseUrl = process.env.DATABASE_URL || '';
const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
})();
if (
  process.env.RUN_DB_TESTS !== '1' ||
  process.env.MOCK_DB !== 'false' ||
  !['localhost', '127.0.0.1'].includes(databaseHost)
) {
  throw new Error('F2-3 E2 requires an explicit local real PostgreSQL test database');
}

describe.sequential('F2-3 E2 projects operating model through ApiGateway + RealPG', { retry: 0 }, () => {
  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const ownerId = randomUUID();
  const leaderId = randomUUID();
  const deniedMemberId = randomUUID();
  const foreignUserId = randomUUID();
  let projectId = '';
  let sql: Client;
  let app: Express;

  const authorization = (userId: string, organizationId: string, role = 'OWNER') =>
    `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
      },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;

  beforeAll(async () => {
    sql = new Client({ connectionString: databaseUrl });
    await sql.connect();
    const database = (await sql.query<{ name: string }>('SELECT current_database() AS name')).rows[0]
      ?.name;
    expect(database).toBe('f23_e1');

    await sql.query(
      `INSERT INTO organizations(id,name,status)
       VALUES($1,'F23 PMO','active'),($2,'F23 foreign','active')`,
      [orgId, foreignOrgId]
    );
    for (const [id, organizationId, firstName] of [
      [ownerId, orgId, 'Sponsor'],
      [leaderId, orgId, 'Leader'],
      [deniedMemberId, orgId, 'Member'],
      [foreignUserId, foreignOrgId, 'Foreign'],
    ]) {
      await sql.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name)
         VALUES($1,$2,$3,'unused-local','OWNER','active',$4,'E2')`,
        [id, organizationId, `${id}@test.invalid`, firstName]
      );
      await sql.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, id]
      );
    }
    await sql.query(
      `UPDATE organization_members SET role='USER' WHERE organization_id=$1 AND user_id=$2`,
      [orgId, deniedMemberId]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    app.use(errorHandlerMiddleware);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    if (projectId) await sql.query('DELETE FROM projects WHERE id=$1', [projectId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id IN ($1,$2)', [
      orgId,
      foreignOrgId,
    ]);
    await sql.query('DELETE FROM users WHERE id IN ($1,$2,$3,$4)', [
      ownerId,
      leaderId,
      deniedMemberId,
      foreignUserId,
    ]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1,$2)', [orgId, foreignOrgId]);
    await sql.end();
  });

  it('creates and reads back the complete existing project SPEC-A contract', async () => {
    const response = await request(app)
      .post('/api/pmo/projects')
      .set('Authorization', authorization(ownerId, orgId))
      .send({
        name: 'F2-3 delivery',
        description: 'PMO operating model',
        goal: 'Deliver measurable value',
        status: 'active',
        pmo_standard: 'pmbok',
        start_date: '2026-09-15',
        target_end_date: '2026-12-15',
        budget_amount: 125000,
        budget_currency: 'EUR',
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    projectId = response.body.id;

    const row = (
      await sql.query(
        `SELECT goal,pmo_standard,start_date::text,target_end_date::text,
                budget_amount::numeric::text,budget_currency
         FROM projects WHERE id=$1 AND organization_id=$2`,
        [projectId, orgId]
      )
    ).rows[0];
    expect(row).toMatchObject({
      goal: 'Deliver measurable value',
      pmo_standard: 'pmbok',
      start_date: '2026-09-15',
      target_end_date: '2026-12-15',
      budget_amount: '125000.00',
      budget_currency: 'EUR',
    });
  });

  it('rejects a foreign tenant member and persists role plus per-person capacity for a local member', async () => {
    await sql.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role,allocation_percent)
       VALUES($1,$2,$3,'TASK_ASSIGNEE','TASK_ASSIGNEE',100)`,
      [randomUUID(), projectId, deniedMemberId]
    );
    const countBeforeDeniedPost = Number(
      (await sql.query('SELECT COUNT(*)::int AS count FROM project_members WHERE project_id=$1', [projectId]))
        .rows[0].count
    );
    const deniedPost = await request(app)
      .post(`/api/pmo/projects/${projectId}/members`)
      .set('Authorization', authorization(deniedMemberId, orgId, 'USER'))
      .send({ userId: leaderId, projectRole: 'PROJECT_MANAGER', allocationPercent: 80 });
    expect(deniedPost.status, JSON.stringify(deniedPost.body)).toBe(403);
    expect(
      Number(
        (await sql.query('SELECT COUNT(*)::int AS count FROM project_members WHERE project_id=$1', [projectId]))
          .rows[0].count
      )
    ).toBe(countBeforeDeniedPost);

    const foreign = await request(app)
      .post(`/api/pmo/projects/${projectId}/members`)
      .set('Authorization', authorization(ownerId, orgId))
      .send({ userId: foreignUserId, projectRole: 'PROJECT_MANAGER', allocationPercent: 80 });
    expect(foreign.status, JSON.stringify(foreign.body)).toBe(400);
    expect(foreign.body).toEqual({
      code: 'PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED',
      error: 'PROJECT_ORGANIZATION_MEMBERSHIP_REQUIRED',
    });

    const local = await request(app)
      .post(`/api/pmo/projects/${projectId}/members`)
      .set('Authorization', authorization(ownerId, orgId))
      .send({ userId: leaderId, projectRole: 'PROJECT_MANAGER', allocationPercent: 80 });
    expect(local.status, JSON.stringify(local.body)).toBe(201);
    const row = (
      await sql.query(
        `SELECT project_role,normalized_project_role,allocation_percent
         FROM project_members WHERE project_id=$1 AND user_id=$2`,
        [projectId, leaderId]
      )
    ).rows[0];
    expect(row).toMatchObject({
      project_role: 'PROJECT_LEADER',
      normalized_project_role: 'PROJECT_LEADER',
      allocation_percent: 80,
    });

    const deniedPatch = await request(app)
      .patch(`/api/pmo/projects/${projectId}/members/${leaderId}`)
      .set('Authorization', authorization(deniedMemberId, orgId, 'USER'))
      .send({ projectRole: 'PROJECT_SPONSOR', allocationPercent: 5 });
    expect(deniedPatch.status, JSON.stringify(deniedPatch.body)).toBe(403);
    const unchanged = (
      await sql.query(
        'SELECT project_role,allocation_percent FROM project_members WHERE project_id=$1 AND user_id=$2',
        [projectId, leaderId]
      )
    ).rows[0];
    expect(unchanged).toEqual({ project_role: 'PROJECT_LEADER', allocation_percent: 80 });
  });

  it('persists communication settings with PostgreSQL upsert and derives acceptance inputs', async () => {
    const saved = await request(app)
      .put(`/api/pmo/projects/${projectId}/notification-settings`)
      .set('Authorization', authorization(ownerId, orgId))
      .send({
        task_overdue_enabled: true,
        decision_pending_enabled: true,
        email_weekly_summary: true,
        escalation_days: 4,
      });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    const beforeDeniedCommunication = (
      await sql.query(
        'SELECT email_weekly_summary,escalation_days FROM project_notification_settings WHERE project_id=$1',
        [projectId]
      )
    ).rows[0];
    const deniedPut = await request(app)
      .put(`/api/pmo/projects/${projectId}/notification-settings`)
      .set('Authorization', authorization(deniedMemberId, orgId, 'USER'))
      .send({ email_weekly_summary: false, escalation_days: 29 });
    expect(deniedPut.status, JSON.stringify(deniedPut.body)).toBe(403);
    expect(
      (
        await sql.query(
          'SELECT email_weekly_summary,escalation_days FROM project_notification_settings WHERE project_id=$1',
          [projectId]
        )
      ).rows[0]
    ).toEqual(beforeDeniedCommunication);

    const model = await request(app)
      .get(`/api/pmo/projects/${projectId}/operating-model`)
      .set('Authorization', authorization(ownerId, orgId));
    expect(model.status, JSON.stringify(model.body)).toBe(200);
    expect(model.body.capacity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: ownerId }),
        expect.objectContaining({ userId: leaderId, allocationPercent: 80 }),
      ])
    );
    expect(model.body.approvalInputs.roleBindings).toEqual(
      expect.arrayContaining([
        { roleKey: 'GATE_AUTHORITY', principalId: ownerId },
        { roleKey: 'GATE_AUTHORITY', principalId: leaderId },
      ])
    );
    expect(model.body.missingRequiredRoles).toContain('PROJECT_SPONSOR');
    expect(model.body.permissions).toEqual({
      canManageTeam: true,
      canManageCommunication: true,
    });
    expect(model.body.communication.find((row: any) => row.trigger === 'WEEKLY_SUMMARY'))
      .toBeDefined();
  });

  it('exposes a read-only operating-model state for a member without management capability', async () => {
    const model = await request(app)
      .get(`/api/pmo/projects/${projectId}/operating-model`)
      .set('Authorization', authorization(deniedMemberId, orgId, 'USER'));
    expect(model.status, JSON.stringify(model.body)).toBe(200);
    expect(model.body.permissions).toEqual({
      canManageTeam: false,
      canManageCommunication: false,
    });
  });

  it('returns 404 for the foreign tenant on the operating model route', async () => {
    const response = await request(app)
      .get(`/api/pmo/projects/${projectId}/operating-model`)
      .set('Authorization', authorization(foreignUserId, foreignOrgId));
    expect(response.status, JSON.stringify(response.body)).toBe(404);
  });
});
