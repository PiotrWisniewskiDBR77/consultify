/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);

describe.skipIf(!enabled)('Day 175 task Risk & Alternatives persistence on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const taskId = randomUUID();
  let app: express.Express;
  let auth: { Authorization: string };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();

    await pool.query(`INSERT INTO organizations (id,name,status) VALUES ($1,'Day 175','active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused-local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO tasks (id,organization_id,title,owner_id,assignee_id,status,priority,risks,alternatives)
       VALUES ($1,$2,'Day 175 task',$3,$3,'todo','medium',$4::jsonb,$5::jsonb)`,
      [
        taskId,
        organizationId,
        userId,
        JSON.stringify([{ id: 'risk-before', title: 'before' }]),
        JSON.stringify([{ id: 'alt-before', title: 'before' }]),
      ]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    auth = { Authorization: `Bearer ${token}` };
  }, 30_000);

  afterAll(async () => {
    await pool.query('DELETE FROM tasks WHERE id=$1 AND organization_id=$2', [
      taskId,
      organizationId,
    ]);
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('reads JSONB through the real ApiGateway and a fresh PostgreSQL query', async () => {
    const response = await request(app).get(`/api/tasks/${taskId}/risk-alternatives`).set(auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      risks: [{ id: 'risk-before', title: 'before' }],
      alternatives: [{ id: 'alt-before', title: 'before' }],
    });

    const freshClient = await pool.connect();
    try {
      const readback = await freshClient.query(
        'SELECT risks, alternatives FROM tasks WHERE id=$1 AND organization_id=$2',
        [taskId, organizationId]
      );
      expect(readback.rows[0]).toEqual(response.body);
    } finally {
      freshClient.release();
    }
  });

  it('records the canonical-writer 409 and proves the attempted write changed nothing', async () => {
    const response = await request(app)
      .put(`/api/tasks/${taskId}/risk-alternatives`)
      .set(auth)
      .send({
        risks: [{ id: 'risk-after', title: 'after' }],
        alternatives: [{ id: 'alt-after', title: 'after' }],
      });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');

    const readback = await pool.query(
      'SELECT risks, alternatives FROM tasks WHERE id=$1 AND organization_id=$2',
      [taskId, organizationId]
    );
    expect(readback.rows[0]).toEqual({
      risks: [{ id: 'risk-before', title: 'before' }],
      alternatives: [{ id: 'alt-before', title: 'before' }],
    });
  });
});
