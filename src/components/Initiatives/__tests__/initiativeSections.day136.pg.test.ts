import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
// server/vitest.config.ts forces sqlite after reading the same-line operator env.
// Restore the explicitly requested engine before the DB/Gateway modules are imported.
process.env.DB_TYPE = 'postgres';

describe('Day 136 initiative sections via production ApiGateway + real PostgreSQL', () => {
  const run = randomUUID();
  const orgId = `day136-org-${run}`;
  const userId = `day136-user-${run}`;
  const initiativeId = `day136-init-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(DATABASE_URL).toMatch(/^postgresql:\/\/postgres:cx@127\.0\.0\.1:6020\/cx136$/);
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'Day 136')`, [orgId]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status)
       VALUES ($1,$2,$3,'unused','Day','136','ADMIN','active')`,
      [userId, orgId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [`day136-member-${run}`, orgId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives (id,organization_id,name,status,created_by)
       VALUES ($1,$2,'Day 136 initiative','DRAFT',$3)`,
      [initiativeId, orgId, userId]
    );

    const { default: config } = await import('../../../../server/src/config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: userId, organizationId: orgId, email: `${userId}@example.test`, role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../../../server/src/Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM initiative_comments WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM initiative_linked_items WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM raid_items WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM initiative_stakeholders WHERE initiative_id=$1`, [initiativeId]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    await pool.end();
  }, 60_000);

  const auth = () => ({ Authorization: authorization, 'x-organization-id': orgId });

  it('comments: POST -> DB/read HTTP -> DELETE -> DB/read HTTP', async () => {
    const created = await request(app)
      .post(`/api/initiatives/${initiativeId}/comments`)
      .set(auth())
      .send({ content: 'Day 136 persisted comment' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.id as string;
    expect(
      (await pool.query(`SELECT content FROM initiative_comments WHERE id=$1`, [id])).rows[0]
    ).toEqual({ content: 'Day 136 persisted comment' });
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/comments`).set(auth())).body
        .comments
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect(
      (await request(app).delete(`/api/initiatives/${initiativeId}/comments/${id}`).set(auth()))
        .status
    ).toBe(200);
    expect(
      (await pool.query(`SELECT id FROM initiative_comments WHERE id=$1`, [id])).rowCount
    ).toBe(0);
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/comments`).set(auth())).body
        .comments
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it('linked items: POST -> DB/read HTTP -> DELETE -> DB/read HTTP', async () => {
    const created = await request(app)
      .post(`/api/initiatives/${initiativeId}/linked-items`)
      .set(auth())
      .send({ targetType: 'task', targetId: `task-${run}`, label: 'Day 136 link' });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const id = created.body.item.id as string;
    expect(
      (await pool.query(`SELECT label FROM initiative_linked_items WHERE id=$1`, [id])).rows[0]
    ).toEqual({ label: 'Day 136 link' });
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/linked-items`).set(auth())).body
        .items
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect(
      (await request(app).delete(`/api/initiatives/${initiativeId}/linked-items/${id}`).set(auth()))
        .status
    ).toBe(200);
    expect(
      (await pool.query(`SELECT id FROM initiative_linked_items WHERE id=$1`, [id])).rowCount
    ).toBe(0);
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/linked-items`).set(auth())).body
        .items
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });

  it('RAID: legacy POST is blocked and leaves real PostgreSQL unchanged', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS count FROM raid_items WHERE initiative_id=$1`,
      [initiativeId]
    );
    const created = await request(app)
      .post(`/api/initiatives/${initiativeId}/raid`)
      .set(auth())
      .send({ type: 'RISK', title: 'Day 136 risk', severity: 'HIGH' });
    expect(created.status).toBe(409);
    expect(created.body).toMatchObject({
      code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      canonicalWriter: '/api/initiatives/runtime-v1',
    });
    const after = await pool.query(
      `SELECT count(*)::int AS count FROM raid_items WHERE initiative_id=$1`,
      [initiativeId]
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it('stakeholders: POST -> DB/read HTTP -> DELETE -> DB/read HTTP', async () => {
    const created = await request(app)
      .post(`/api/initiatives/${initiativeId}/stakeholders`)
      .set(auth())
      .send({
        externalName: 'Day 136 stakeholder',
        externalEmail: 'stakeholder@example.test',
        raciType: 'C',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = (created.body.id ?? created.body.stakeholderId) as string;
    expect(
      (await pool.query(`SELECT external_name FROM initiative_stakeholders WHERE id=$1`, [id]))
        .rows[0]
    ).toEqual({ external_name: 'Day 136 stakeholder' });
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/stakeholders`).set(auth())).body
        .stakeholders
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect(
      (await request(app).delete(`/api/initiatives/${initiativeId}/stakeholders/${id}`).set(auth()))
        .status
    ).toBe(200);
    expect(
      (await pool.query(`SELECT id FROM initiative_stakeholders WHERE id=$1`, [id])).rowCount
    ).toBe(0);
    expect(
      (await request(app).get(`/api/initiatives/${initiativeId}/stakeholders`).set(auth())).body
        .stakeholders
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });
});
