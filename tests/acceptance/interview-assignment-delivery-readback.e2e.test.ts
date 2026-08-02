import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED } from './seed.mjs';

const PREFIX = 'odbior--int02--';
const ASSIGNEE_ID = `${PREFIX}assignee`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_ADMIN_ID = `${PREFIX}foreign-admin`;
const TEMPLATE_ID = `${PREFIX}template`;

let app: Express;
let ownerToken: string;
let assigneeToken: string;
let foreignToken: string;
let assignmentId = '';
let taskId = '';

beforeAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'Odbior Harness Org', 'enterprise', 'active', 1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [SEED.ORG_ID, now]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'Odbior', 'Harness', $4)
       ON CONFLICT (id) DO NOTHING`,
      [SEED.USER_ID, SEED.ORG_ID, SEED.EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       SELECT $1, $2, $3, 'OWNER', 'ACTIVE'
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $2 AND user_id = $3
       )`,
      [`${PREFIX}owner-membership`, SEED.ORG_ID, SEED.USER_ID]
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'INT-02 foreign org', 'enterprise', 'active', 1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, now]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES
         ($1, $2, $3, 'unused', 'TEAM_MEMBER', 'active', 'INT02', 'Assignee', $4),
         ($5, $6, $7, 'unused', 'ADMIN', 'active', 'INT02', 'Foreign', $4)
       ON CONFLICT (id) DO NOTHING`,
      [
        ASSIGNEE_ID,
        SEED.ORG_ID,
        `${PREFIX}assignee@acceptance.local`,
        now,
        FOREIGN_ADMIN_ID,
        FOREIGN_ORG_ID,
        `${PREFIX}foreign@acceptance.local`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES
         ($1, $2, $3, 'MEMBER', 'ACTIVE'),
         ($4, $5, $6, 'ADMIN', 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [
        `${PREFIX}assignee-membership`,
        SEED.ORG_ID,
        ASSIGNEE_ID,
        `${PREFIX}foreign-membership`,
        FOREIGN_ORG_ID,
        FOREIGN_ADMIN_ID,
      ]
    );
    await client.query(
      `INSERT INTO interview_library_templates
         (id, organization_id, name, description, category, status, visibility,
          template_scope, version, created_by, created_at, updated_at)
       VALUES ($1, $2, 'INT-02 delivery template', 'Acceptance proof', 'OPERATIONS',
               'approved', 'org', 'organization', 3, $3, $4, $4)
       ON CONFLICT (id) DO UPDATE SET status = 'approved', version = 3, updated_at = EXCLUDED.updated_at`,
      [TEMPLATE_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
  } finally {
    await client.end();
  }

  const interviewRouter = (await import('../../server/src/routes/interview.routes.js')).default;
  const notificationsRouter = (await import('../../server/src/routes/notifications.routes.js'))
    .default;
  app = express();
  app.use(express.json());
  app.use('/api/interview', interviewRouter);
  app.use('/api/notifications', notificationsRouter);

  ownerToken = mintToken();
  assigneeToken = mintToken({
    id: ASSIGNEE_ID,
    email: `${PREFIX}assignee@acceptance.local`,
    role: 'TEAM_MEMBER',
  });
  foreignToken = mintToken({
    id: FOREIGN_ADMIN_ID,
    email: `${PREFIX}foreign@acceptance.local`,
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'ADMIN',
  });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (assignmentId) {
      await client
        .query(
          'DELETE FROM notification_dedup WHERE notification_id IN (SELECT id FROM notifications WHERE entity_id = $1)',
          [assignmentId]
        )
        .catch(() => undefined);
      await client.query('DELETE FROM notifications WHERE entity_id = $1', [assignmentId]);
      await client.query('DELETE FROM interview_notifications WHERE assignment_id = $1', [
        assignmentId,
      ]);
      if (taskId) await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      await client.query('DELETE FROM interview_assignment_members WHERE assignment_id = $1', [
        assignmentId,
      ]);
      await client.query('DELETE FROM interview_assignments WHERE id = $1', [assignmentId]);
    }
    await client.query('DELETE FROM interview_library_templates WHERE id = $1', [TEMPLATE_ID]);
    await client.query('DELETE FROM organization_members WHERE id = ANY($1)', [
      [`${PREFIX}owner-membership`, `${PREFIX}assignee-membership`, `${PREFIX}foreign-membership`],
    ]);
    await client.query('DELETE FROM users WHERE id = ANY($1)', [[ASSIGNEE_ID, FOREIGN_ADMIN_ID]]);
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-02 assignment tenant/role and delivery acceptance', () => {
  it('persists assignment + mirror task + recipient notification and blocks unauthorized writers', async () => {
    const forbiddenRole = await request(app)
      .post('/api/interview/assignments')
      .set('Authorization', `Bearer ${assigneeToken}`)
      .send({ assigneeUserId: ASSIGNEE_ID, templateId: TEMPLATE_ID });
    expect(forbiddenRole.status).toBe(403);

    const foreignAssignee = await request(app)
      .post('/api/interview/assignments')
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ assigneeUserId: ASSIGNEE_ID, templateId: TEMPLATE_ID });
    expect(foreignAssignee.status).toBe(403);
    expect(foreignAssignee.body?.code).toBe('ASSIGNEE_NOT_IN_ORG');

    const created = await request(app)
      .post('/api/interview/assignments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        assigneeUserId: ASSIGNEE_ID,
        templateId: TEMPLATE_ID,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'high',
      });
    expect(created.status).toBe(201);
    assignmentId = String(created.body?.id || '');
    taskId = String(created.body?.taskId || '');
    expect(assignmentId).toMatch(/^ia_/);
    expect(taskId).toMatch(/^t_interview_/);
    expect(created.body).toMatchObject({
      organizationId: SEED.ORG_ID,
      assigneeUserId: ASSIGNEE_ID,
      templateId: TEMPLATE_ID,
      templateVersion: 3,
      status: 'assigned',
      priority: 'high',
    });

    const client = pgClient();
    await client.connect();
    try {
      const assignment = await client.query(
        `SELECT organization_id, assignee_user_id, template_id, template_version, task_id, status
         FROM interview_assignments WHERE id = $1`,
        [assignmentId]
      );
      expect(assignment.rows[0]).toMatchObject({
        organization_id: SEED.ORG_ID,
        assignee_user_id: ASSIGNEE_ID,
        template_id: TEMPLATE_ID,
        template_version: 3,
        task_id: taskId,
        status: 'assigned',
      });
      const task = await client.query(
        'SELECT organization_id, assignee_id, task_type, status FROM tasks WHERE id = $1',
        [taskId]
      );
      expect(task.rows[0]).toMatchObject({
        organization_id: SEED.ORG_ID,
        assignee_id: ASSIGNEE_ID,
        task_type: 'interview',
        status: 'todo',
      });
      const receipt = await client.query(
        `SELECT user_id, organization_id, type, entity_type, entity_id, action_url
         FROM notifications WHERE user_id = $1 AND entity_id = $2`,
        [ASSIGNEE_ID, assignmentId]
      );
      expect(receipt.rows).toHaveLength(1);
      expect(receipt.rows[0]).toMatchObject({
        user_id: ASSIGNEE_ID,
        organization_id: SEED.ORG_ID,
        type: 'interview_assigned',
        entity_type: 'interview_assignment',
        entity_id: assignmentId,
        action_url: `/interview?assignmentId=${assignmentId}`,
      });
    } finally {
      await client.end();
    }

    const reopened = await request(app)
      .get('/api/notifications?limit=50')
      .set('Authorization', `Bearer ${assigneeToken}`);
    expect(reopened.status).toBe(200);
    expect(reopened.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: ASSIGNEE_ID,
          organizationId: SEED.ORG_ID,
          type: 'interview_assigned',
          entityId: assignmentId,
          actionUrl: `/interview?assignmentId=${assignmentId}`,
        }),
      ])
    );
  }, 60_000);
});
