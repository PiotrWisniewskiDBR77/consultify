/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const ARTIFACT = '/private/tmp/cx-day160-brama-zadania-artefakty/day160-http-db-evidence.json';

type Evidence = {
  name: string;
  method: string;
  path: string;
  requestBody?: unknown;
  status: number;
  responseBody: unknown;
  databaseBefore: unknown;
  databaseAfter: unknown;
};

describe('Day 160 task write gate through the real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const suffix = randomUUID().replaceAll('-', '');
  const organizationId = randomUUID();
  const userId = randomUUID();
  const taskId = randomUUID();
  const evidence: Evidence[] = [];
  let app: Express;
  let sql: Client;
  let authorization: string;

  const taskCount = async () =>
    Number(
      (
        await sql.query('SELECT count(*)::int AS count FROM tasks WHERE organization_id = $1', [
          organizationId,
        ])
      ).rows[0]?.count || 0
    );

  const commentCount = async () =>
    Number(
      (
        await sql.query('SELECT count(*)::int AS count FROM task_comments WHERE task_id = $1', [
          taskId,
        ])
      ).rows[0]?.count || 0
    );

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();

    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    const target = await sql.query<{ database: string; port: number }>(
      'SELECT current_database() AS database, inet_server_port() AS port'
    );
    expect(target.rows[0]).toEqual({ database: 'cx160', port: 5432 });

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `day160_${suffix}`]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', 'One Sixty', 'ADMIN', 'active', now())`,
      [userId, organizationId, `day160_${suffix}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [randomUUID(), organizationId, userId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `day160_${suffix}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`;

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    writeFileSync(ARTIFACT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    if (!sql) return;
    await sql.query(
      'DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE organization_id = $1)',
      [organizationId]
    );
    await sql.query('DELETE FROM tasks WHERE organization_id = $1', [organizationId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    // The budget-delete proof intentionally creates an immutable receipt whose
    // FK retains this organization. The disposable Day 160 container is the
    // owner boundary and is removed with its volume after the evidence run.
    await sql.end();
  });

  const recordTaskProbe = async (
    name: string,
    method: 'post' | 'put' | 'delete',
    path: string,
    body?: Record<string, unknown>
  ) => {
    const before = { tasks: await taskCount(), comments: await commentCount() };
    const call = request(app)[method](path).set('Authorization', authorization);
    const response = body ? await call.send(body) : await call;
    const after = { tasks: await taskCount(), comments: await commentCount() };
    evidence.push({
      name,
      method: method.toUpperCase(),
      path,
      requestBody: body,
      status: response.status,
      responseBody: response.body,
      databaseBefore: before,
      databaseAfter: after,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body).toMatchObject({ code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' });
    expect(after).toEqual(before);
  };

  it('R1 records POST, PUT, DELETE and comment writes as 409 with unchanged database', async () => {
    await recordTaskProbe('create task', 'post', '/api/tasks', {
      title: `day160 blocked ${suffix}`,
      status: 'todo',
    });
    await recordTaskProbe('update task', 'put', `/api/tasks/${taskId}`, {
      title: `day160 update ${suffix}`,
    });
    await recordTaskProbe('delete task', 'delete', `/api/tasks/${taskId}`);
    await recordTaskProbe('add task comment', 'post', `/api/tasks/${taskId}/comments`, {
      content: `day160 comment ${suffix}`,
    });
  });

  it('R1 records the governed budget-delete exception reaching its handler', async () => {
    const path = `/api/execution-control/budget/entries/${randomUUID()}?initiativeId=${randomUUID()}&expectedVersion=1`;
    const before = Number(
      (
        await sql.query(
          'SELECT count(*)::int AS count FROM budget_entries WHERE organization_id = $1',
          [organizationId]
        )
      ).rows[0]?.count || 0
    );
    const response = await request(app)
      .delete(path)
      .set('Authorization', authorization)
      .set('X-Idempotency-Key', `day160-${suffix}`);
    const after = Number(
      (
        await sql.query(
          'SELECT count(*)::int AS count FROM budget_entries WHERE organization_id = $1',
          [organizationId]
        )
      ).rows[0]?.count || 0
    );
    evidence.push({
      name: 'canonical budget delete exception',
      method: 'DELETE',
      path,
      status: response.status,
      responseBody: response.body,
      databaseBefore: { budgetEntries: before },
      databaseAfter: { budgetEntries: after },
    });
    expect(response.status, JSON.stringify(response.body)).not.toBe(409);
    expect(after).toBe(before);
  });

  it('R3 creates a personal task and reads its exact storage coordinates', async () => {
    const title = `day160 personal ${suffix}`;
    const before = await taskCount();
    const response = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', authorization)
      .set('x-org-context', organizationId)
      .send({ title, status: 'todo', priority: 'medium', idempotencyKey: `day160-${suffix}` });
    const stored = (
      await sql.query(
        `SELECT id, title, task_type, initiative_id, project_id, organization_id, assignee_id
         FROM tasks WHERE organization_id = $1 AND title = $2`,
        [organizationId, title]
      )
    ).rows;
    const after = await taskCount();
    evidence.push({
      name: 'create personal task',
      method: 'POST',
      path: '/api/my-work/personal-tasks',
      requestBody: { title, status: 'todo', priority: 'medium' },
      status: response.status,
      responseBody: response.body,
      databaseBefore: { tasks: before },
      databaseAfter: { tasks: after, stored },
    });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(after).toBe(before + 1);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title,
      task_type: 'personal',
      initiative_id: null,
      project_id: null,
      organization_id: organizationId,
      assignee_id: userId,
    });
  });
});
