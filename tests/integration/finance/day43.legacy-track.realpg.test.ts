/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgresql://postgres:cx@127.0.0.1:5810/cx_day43');
const jwtSecret = 'test-jwt-secret-key-min-32-chars-long-for-validation';
const legacyReads = [
  ['Statements', '/api/finance-statements/packs'],
  ['Models', '/api/financial-modeling/models'],
  ['Analysis', '/api/economics/financial-analyses'],
  ['Valuation', '/api/economics/valuations'],
  ['Budgets', '/api/economics/budgets'],
] as const;

describe.skipIf(!realPg)('day43 A.3 — legacy track through real ApiGateway', () => {
  const organizationId = `day43-a3-${randomUUID()}`;
  const userId = randomUUID();
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  let token = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [organizationId]);
    await pool.query(
      `INSERT INTO users(id,email,password,role,organization_id) VALUES($1,$2,'test','ADMIN',$3)`,
      [userId, `${userId}@test.invalid`, organizationId]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    token = jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'ADMIN' },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    await pool.end();
  });

  it.each(legacyReads)('%s legacy route denies an anonymous request', async (_card, path) => {
    delete process.env.ENABLE_V8_GLOBAL;
    const response = await request(app).get(path);
    expect([401, 403]).toContain(response.status);
    expect(response.body.code).not.toBe('V8_DISABLED');
  });

  it.each(legacyReads)('%s legacy route is reachable with V8 OFF', async (_card, path) => {
    delete process.env.ENABLE_V8_GLOBAL;
    const response = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.code).not.toBe('V8_DISABLED');
  });
});
