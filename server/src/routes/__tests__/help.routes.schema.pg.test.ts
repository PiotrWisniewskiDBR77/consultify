/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 289 help schema through ApiGateway and real Postgres', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  const organizationId = randomUUID();
  const userId = randomUUID();
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../Gateway.js'),
      import('../../config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [organizationId]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `day289-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM help_events WHERE user_id=$1`, [userId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await pgModule.closePool?.();
  });

  it('stores the live HelpContext payload and exposes it to a cold pg readback', async () => {
    const response = await request(app)
      .post('/api/help/events')
      .set('Authorization', authorization)
      .send({ playbookKey: 'day289', eventType: 'view_started', context: { route: '/day289' } });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, stored: true });
    const row = await pool.query(
      `SELECT playbook_key,event_type,event_data,route FROM help_events WHERE id=$1`,
      [response.body.eventId]
    );
    expect(row.rows[0]).toMatchObject({
      playbook_key: 'day289',
      event_type: 'view_started',
      route: '/day289',
    });
    expect(JSON.parse(row.rows[0].event_data)).toEqual({ route: '/day289' });
  });

  it('returns a migrated legacy article instead of silently converting a schema error to an empty list', async () => {
    const articleId = randomUUID();
    await pool.query(
      `INSERT INTO help_articles(id,category,title,slug,content,is_published,category_id,body,status)
       VALUES($1,'getting-started','Day 289 article',$2,'Body',true,'getting-started','Body','published')`,
      [articleId, `day289-${articleId}`]
    );
    const response = await request(app).get('/api/help/articles');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: articleId })]));
    await pool.query(`DELETE FROM help_articles WHERE id=$1`, [articleId]);
  });
});
