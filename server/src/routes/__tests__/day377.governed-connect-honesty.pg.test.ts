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

describe('Day 377 — governed connector rejection is honest and tenant-safe', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let app: express.Express;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    delete process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;

    await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2),($3,$4)', [
      orgA,
      'Day377 org A',
      orgB,
      'Day377 org B',
    ]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,role,status) VALUES
       ($1,$2,$3,'OWNER','active'),($4,$5,$6,'OWNER','active')`,
      [userA, orgA, `${userA}@test.invalid`, userB, orgB, `${userB}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES
       ($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [randomUUID(), orgA, userA, randomUUID(), orgB, userB]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    tokenA = jwt.sign(
      { id: userA, userId: userA, organizationId: orgA, role: 'OWNER', email: `${userA}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    tokenB = jwt.sign(
      { id: userB, userId: userB, organizationId: orgB, role: 'OWNER', email: `${userB}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  }, 30000);

  afterAll(async () => {
    await pool.query('DELETE FROM integrations WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [[orgA, orgB]]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userA, userB]]);
    await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[orgA, orgB]]);
    await pool.end();
  });

  async function expectHonestRejection(response: request.Response) {
    expect(response.status).toBe(501);
    expect(response.body).toEqual({
      error: 'Integracja nie jest dostępna w tej wersji',
      code: 'GOVERNED_CONNECTOR_NOT_APPROVED',
    });
  }

  it('returns structured 501 from the settings connect route', async () => {
    const response = await request(app)
      .post('/api/settings/integrations/google_drive/connect')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ config: {} });
    console.log('DAY377_SETTINGS_CONNECT_HTTP', response.status, JSON.stringify(response.body));
    await expectHonestRejection(response);
  });

  it('returns structured 501 from the canonical integrations connect route', async () => {
    const response = await request(app)
      .post('/api/integrations/connect/google_drive')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ config: {} });
    console.log('DAY377_CANONICAL_CONNECT_HTTP', response.status, JSON.stringify(response.body));
    await expectHonestRejection(response);
  });

  it('rejects both organizations without writing integration rows', async () => {
    const responseA = await request(app)
      .post('/api/settings/integrations/google_drive/connect')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ config: {} });
    const responseB = await request(app)
      .post('/api/settings/integrations/google_drive/connect')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ config: {} });
    await expectHonestRejection(responseA);
    await expectHonestRejection(responseB);

    const rows = await pool.query(
      `SELECT organization_id, count(*)::int AS count
       FROM integrations
       WHERE organization_id = ANY($1) AND connector_id = 'google_drive'
       GROUP BY organization_id`,
      [[orgA, orgB]]
    );
    console.log('DAY377_CROSS_ORG_ROWS', JSON.stringify(rows.rows));
    expect(rows.rows).toEqual([]);
  });
});
