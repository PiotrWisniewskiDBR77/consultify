/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe.sequential('Day 307 — MODULE_ECONOMICS through Gateway and real PostgreSQL', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const ownerId = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();

  const bearer = (id: string, role: 'USER' | 'OWNER') =>
    `Bearer ${jwt.sign(
      { id, userId: id, organizationId, organization_id: organizationId, role },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '10m', jwtid: randomUUID() }
    )}`;

  beforeAll(async () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [organizationId]);
    for (const [id, role] of [[userId, 'USER'], [ownerId, 'OWNER']] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
         VALUES($1,$2,$3,'unused',$4,'active',1)`,
        [id, organizationId, `day307-${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), organizationId, id, role]
      );
    }
  }, 120_000);

  afterAll(async () => {
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM users WHERE organization_id=$1', [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
    const pgModule = await import('../../../database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  for (const path of ['/api/v8/finance/settings', '/api/v8/finance/models', '/api/v8/finance/statements']) {
    it(`${path}: USER is blocked and OWNER reaches the handler`, async () => {
      const denied = await request(app).get(path).set('Authorization', bearer(userId, 'USER'));
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'BETA_LOCKED' });
      const allowed = await request(app).get(path).set('Authorization', bearer(ownerId, 'OWNER'));
      expect(allowed.status).toBe(200);
      expect(allowed.body).toHaveProperty('data');
    });
  }
});
