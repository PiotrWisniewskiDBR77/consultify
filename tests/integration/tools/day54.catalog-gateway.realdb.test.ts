/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? '';
const NO_RETRY = { retry: 0 } as const;

describe('Day 54 — catalog reachability through real ApiGateway', NO_RETRY, () => {
  const prefix = `day54-catalog-${randomUUID()}`;
  const organizationId = `${prefix}-org`;
  const userId = `${prefix}-owner`;
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let token = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    token = jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        isSuperAdmin: false,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'x','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tool_sessions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const create = (toolType: string) =>
    request(app)
      .post('/api/tools')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolType, name: `${prefix}-${toolType}` });

  it('allows the approved Dynamic SWOT type', async () => {
    const response = await create('dynamic-swot');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  });

  it('refuses a known but inactive catalog type', async () => {
    const response = await create('market-forces');
    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body.error).toBe('This tool is inactive and cannot start a session yet');
  });

  it('closes the unknown-type gap (day54 FIX-D, 2026-08-28): refuses instead of creating a session', async () => {
    // Do 2026-08-28 ten test dokumentował LUKĘ: nieznany typ omijał warunek
    // `availability.exists && !availability.isActive` i tworzył realną sesję
    // (200). Po FIX-D (server/src/controllers/ToolController.ts) nieznany typ
    // jest odrzucany z 404 UNKNOWN_TOOL_TYPE PRZED utworzeniem id sesji.
    const response = await create('nie-ma-takiego-narzedzia');
    expect(response.status, JSON.stringify(response.body)).toBe(404);
    expect(response.body.code).toBe('UNKNOWN_TOOL_TYPE');
  });
});
