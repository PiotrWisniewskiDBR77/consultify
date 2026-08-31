/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import config from '../../../../server/src/config/Config';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres';

const phase = process.env.DAY140_PHASE || 'add';
const orgId = 'day140-org';
const userId = 'day140-user';
const taskId = 'day140-task';
const decisionId = 'day140-decision';
const taskBody = 'DAY140 TASK COMMENT';
const decisionBody = 'DAY140 DECISION COMMENT';

function bearer(): string {
  return jwt.sign({ id: userId, userId, organizationId: orgId, role: 'ADMIN' }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Day 140 comments through real ApiGateway and PostgreSQL', () => {
  let app: express.Express;
  let queryOne: <T = any>(sql: string, params?: any[]) => Promise<T | null>;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const queries = await import('../../../../server/src/utils/queryHelpers');
    queryOne = queries.queryOne;
    await queries.queryRun(
      `INSERT INTO organizations (id, name) VALUES (?, ?)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [orgId, 'Day 140 Organization']
    );
    await queries.queryRun(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id`,
      [userId, orgId, 'day140@example.invalid', 'Day', '140', 'ADMIN']
    );
    await queries.queryRun(
      `INSERT INTO tasks (id, organization_id, title, created_by, assignee_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id`,
      [taskId, orgId, 'Day 140 Task', userId, userId]
    );
    await queries.queryRun(
      `INSERT INTO decisions (id, organization_id, title, created_by, decision_maker_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id`,
      [decisionId, orgId, 'Day 140 Decision', userId, userId]
    );
    const { ApiGateway } = await import('../../../../server/src/Gateway');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120000);

  it.runIf(phase === 'add')('POST + GET task comment persists and is returned', async () => {
    const post = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${bearer()}`)
      .send({ content: taskBody });
    expect(post.status, JSON.stringify(post.body)).toBe(200);

    const row = await queryOne<any>(
      'SELECT id, task_id, user_id, content FROM task_comments WHERE id = ?',
      [post.body.id]
    );
    expect(row).toMatchObject({ task_id: taskId, user_id: userId, content: taskBody });

    const read = await request(app)
      .get(`/api/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${bearer()}`);
    expect(read.status).toBe(200);
    expect(read.body.map((comment: any) => comment.id)).toContain(post.body.id);
  });

  it.runIf(phase === 'add')(
    'POST + aggregate GET decision comment persists and is returned',
    async () => {
      const post = await request(app)
        .post(`/api/decisions/${decisionId}/comments`)
        .set('Authorization', `Bearer ${bearer()}`)
        .send({ body: decisionBody });
      expect(post.status).toBe(201);

      const row = await queryOne<any>(
        'SELECT id, decision_id, author_id, body, deleted_at FROM decision_comments WHERE id = ?',
        [post.body.id]
      );
      expect(row).toMatchObject({
        decision_id: decisionId,
        author_id: userId,
        body: decisionBody,
        deleted_at: null,
      });

      const read = await request(app)
        .get(`/api/decisions/${decisionId}/detail`)
        .set('Authorization', `Bearer ${bearer()}`);
      expect(read.status).toBe(200);
      expect(read.body.comments.map((comment: any) => comment.id)).toContain(post.body.id);
    }
  );

  it.runIf(phase === 'delete')('DELETE + GET removes the task comment', async () => {
    const row = await queryOne<any>(
      'SELECT id FROM task_comments WHERE task_id = ? AND content = ? ORDER BY created_at DESC LIMIT 1',
      [taskId, taskBody]
    );
    expect(row?.id).toBeTruthy();
    const del = await request(app)
      .delete(`/api/tasks/${taskId}/comments/${row.id}`)
      .set('Authorization', `Bearer ${bearer()}`);
    expect(del.status).toBe(200);
    expect(await queryOne('SELECT id FROM task_comments WHERE id = ?', [row.id])).toBeNull();
  });

  it.runIf(phase === 'delete')('DELETE + aggregate GET hides the decision comment', async () => {
    const row = await queryOne<any>(
      `SELECT id FROM decision_comments
       WHERE decision_id = ? AND body = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [decisionId, decisionBody]
    );
    expect(row?.id).toBeTruthy();
    const del = await request(app)
      .delete(`/api/decisions/${decisionId}/comments/${row.id}`)
      .set('Authorization', `Bearer ${bearer()}`);
    expect(del.status).toBe(200);
    const persisted = await queryOne<any>('SELECT deleted_at FROM decision_comments WHERE id = ?', [
      row.id,
    ]);
    expect(persisted?.deleted_at).toBeTruthy();
    const read = await request(app)
      .get(`/api/decisions/${decisionId}/detail`)
      .set('Authorization', `Bearer ${bearer()}`);
    expect(read.status).toBe(200);
    expect(read.body.comments.map((comment: any) => comment.id)).not.toContain(row.id);
  });
});
