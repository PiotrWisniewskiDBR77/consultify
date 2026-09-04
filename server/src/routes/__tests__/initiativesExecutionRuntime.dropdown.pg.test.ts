/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('initiatives execution runtime — dropdown title on real PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = randomUUID();
  const executionCaseId = randomUUID();
  const initiativeTitle = `Automatyzacja raportowania ${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'Day 290 dropdown org',
    ]);
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)`, [
      projectId,
      organizationId,
      'Day 290 dropdown project',
    ]);
    await sql.query(
      `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
         ($1,'initiative',$2,1,$3::jsonb),
         ($1,'execution_case',$4,1,$5::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify({
          initiativeId,
          title: initiativeTitle,
          projectId,
          initiativeOwnerId: userId,
          lifecycleState: 'IN_EXECUTION',
        }),
        executionCaseId,
        JSON.stringify({
          executionCaseId,
          initiativeId,
          state: 'ACTIVE',
          executionManagerId: userId,
          handoffPackageId: 'day290-handoff',
        }),
      ]
    );
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('uses the explicitly selected PostgreSQL engine', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('returns the initiative name for Wybierz realizację instead of only the raw executionCaseId', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', authorization);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.cases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          executionCaseId,
          initiativeId,
          initiativeTitle,
        }),
      ])
    );
    const dropdownCase = response.body.cases.find(
      (item: { executionCaseId: string }) => item.executionCaseId === executionCaseId
    );
    expect(dropdownCase.initiativeTitle).not.toBe(executionCaseId);
  });
});
