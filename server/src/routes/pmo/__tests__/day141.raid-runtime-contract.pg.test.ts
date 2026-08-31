/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 141 RAID canonical runtime contract via production ApiGateway + real PostgreSQL', () => {
  const run = randomUUID();
  const organizationId = `day141-org-${run}`;
  const userId = `day141-user-${run}`;
  const initiativeId = `day141-initiative-${run}`;
  const proposedRaidItemId = `day141-raid-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'Day 141')`, [organizationId]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status)
       VALUES ($1,$2,$3,'unused','Day','141','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [`day141-member-${run}`, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives (id,organization_id,name,status,created_by)
       VALUES ($1,$2,'Day 141 initiative','DRAFT',$3)`,
      [initiativeId, organizationId, userId]
    );

    const { default: config } = await import('../../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        organizationId,
        email: `${userId}@example.test`,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM raid_items WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  }, 60_000);

  const auth = () => ({ Authorization: authorization, 'x-organization-id': organizationId });

  it('binds the proof package to explicitly requested real PostgreSQL', async () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(databaseUrl).toBe('postgresql://postgres:cx@127.0.0.1:6027/cx141');
  });

  it('proves the current legacy RAID POST returns 409 and leaves raid_items unchanged', async () => {
    const before = await pool.query(
      `SELECT id FROM raid_items WHERE organization_id=$1 AND initiative_id=$2 ORDER BY id`,
      [organizationId, initiativeId]
    );
    const response = await request(app)
      .post(`/api/initiatives/${initiativeId}/raid`)
      .set(auth())
      .send({ type: 'RISK', title: 'Day 141 risk', severity: 'HIGH', status: 'OPEN' });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
      canonicalWriter: '/api/initiatives/runtime-v1',
    });
    const after = await pool.query(
      `SELECT id FROM raid_items WHERE organization_id=$1 AND initiative_id=$2 ORDER BY id`,
      [organizationId, initiativeId]
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('inventories other Initiative-card legacy mutations stopped by the same 409 gate', async () => {
    const surfaces = [
      { method: 'post', path: `/api/initiatives/${initiativeId}/milestones` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/resources` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/staffing-plans` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/budget-items` },
      { method: 'put', path: `/api/initiatives/${initiativeId}/gate-roles` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/start-execution` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/block` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/move` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/apply-template` },
      { method: 'post', path: `/api/initiatives/${initiativeId}/apply-blueprint` },
    ] as const;

    for (const surface of surfaces) {
      const response = await request(app)[surface.method](surface.path).set(auth()).send({});
      expect(response.status, `${surface.method.toUpperCase()} ${surface.path}`).toBe(409);
      expect(response.body.code, `${surface.method.toUpperCase()} ${surface.path}`).toBe(
        'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'
      );
    }
  });

  it('requires a canonical RAID-item create/read/delete command before the UI can be rewired', async () => {
    const createPath = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-items/${proposedRaidItemId}`;
    const created = await request(app)
      .post(createPath)
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `day141-create-${run}`,
        type: 'RISK',
        title: 'Day 141 canonical risk',
        description: 'Red contract for the missing canonical RAID-item writer',
        severity: 'HIGH',
        status: 'OPEN',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const inserted = await pool.query(
      `SELECT id,title FROM raid_items WHERE id=$1 AND organization_id=$2 AND initiative_id=$3`,
      [proposedRaidItemId, organizationId, initiativeId]
    );
    expect(inserted.rows).toEqual([{ id: proposedRaidItemId, title: 'Day 141 canonical risk' }]);

    const deleted = await request(app)
      .delete(createPath)
      .set(auth())
      .send({ expectedVersion: 1, clientRequestId: `day141-delete-${run}` });
    expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
    expect(
      (
        await pool.query(`SELECT id FROM raid_items WHERE id=$1 AND organization_id=$2`, [
          proposedRaidItemId,
          organizationId,
        ])
      ).rowCount
    ).toBe(0);
  });
});
