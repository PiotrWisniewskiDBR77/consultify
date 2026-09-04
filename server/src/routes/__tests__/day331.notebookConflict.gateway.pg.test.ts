/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day331 notebook conflict through real Gateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const pageId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id,name,plan,status) VALUES ($1,'Day331','enterprise','active')`,
      [organizationId]
    );
    await sql.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(
      `INSERT INTO notebook_pages
         (id,owner_user_id,organization_id,visibility,title,content_json,content_text,tags_json,created_at,updated_at)
       VALUES ($1,$2,$3,'private','Day331 note','{}','initial','[]',NOW(),NOW())`,
      [pageId, userId, organizationId]
    );

    const [{ default: config }, { ApiGateway }] = await Promise.all([
      import('../../config/Config.js'),
      import('../../Gateway.js'),
    ]);
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'ADMIN', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM notebook_pages WHERE id=$1', [pageId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM users WHERE id=$1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await sql.end();
  });

  it('returns one 200 and one 409 with the fresh page for two clients on one version', async () => {
    const read = await request(app)
      .get(`/api/v8/my-work/notebook/pages/${pageId}`)
      .set('Authorization', authorization);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    const expectedUpdatedAt = read.body.data.updatedAt;

    const write = (contentText: string) =>
      request(app)
        .put(`/api/v8/my-work/notebook/pages/${pageId}`)
        .set('Authorization', authorization)
        .send({ contentText, expectedUpdatedAt });
    const responses = await Promise.all([write('client A'), write('client B')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const winner = responses.find((response) => response.status === 200)!;
    const loser = responses.find((response) => response.status === 409)!;
    expect(loser.body).toMatchObject({
      code: 'NOTEBOOK_PAGE_CONFLICT',
      data: {
        id: pageId,
        contentText: winner.body.data.contentText,
        updatedAt: winner.body.data.updatedAt,
      },
    });

    const cold = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await cold.connect();
    const stored = await cold.query('SELECT content_text FROM notebook_pages WHERE id=$1', [pageId]);
    await cold.end();
    expect(stored.rows[0].content_text).toBe(winner.body.data.contentText);
  });
});
