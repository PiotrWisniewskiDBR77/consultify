/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Q1 P3 workload through ApiGateway/JWT/RealPG', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const foreignProjectId = randomUUID();
  const initiativeId = randomUUID();
  const foreignInitiativeId = randomUUID();
  const availableUserId = randomUUID();
  let sql: Client;
  let app: Express;
  let authorization: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';
    const [{ default: config }, { ApiGateway }, { get: dbGet }] = await Promise.all([
      import('../../config/Config.js'),
      import('../../Gateway.js'),
      import('../../utils/DbPromise.js'),
    ]);
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations (id,name,plan,status,is_active,created_at)
       VALUES ($1,'Q1 workload','enterprise','active',1,now()),
              ($2,'Q1 workload foreign','enterprise','active',1,now())`,
      [organizationId, foreignOrganizationId]
    );
    await sql.query(
      `INSERT INTO users
         (id,organization_id,email,password,first_name,last_name,role,status,weekly_capacity_hours,availability_percent,created_at)
       VALUES ($1,$2,$3,'x','Anna','Capacity','ADMIN','active',20,100,now()),
              ($4,$2,$5,'x','Ola','Available','USER','active',40,100,now())`,
      [userId, organizationId, `${userId}@example.test`, availableUserId, `${availableUserId}@example.test`]
    );
    await sql.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE',now())`,
      [randomUUID(), organizationId, userId]
    );
    expect(
      (await sql.query(
        'SELECT status FROM organization_members WHERE organization_id=$1 AND user_id=$2',
        [organizationId, userId]
      )).rows[0]?.status
    ).toBe('ACTIVE');
    expect(
      await dbGet<{ status: string }>(
        'SELECT status FROM organization_members WHERE organization_id = ? AND user_id = ?',
        [organizationId, userId],
        { fallback: false }
      )
    ).toMatchObject({ status: 'ACTIVE' });
    await sql.query(
      `INSERT INTO projects (id,organization_id,name,status,created_at)
       VALUES ($1,$2,'Apollo','active',now()),($3,$2,'Other','active',now())`,
      [projectId, organizationId, foreignProjectId]
    );
    await sql.query(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status,created_at,updated_at)
       VALUES ($1,$2,$3,'Apollo initiative','PENDING_APPROVAL',now(),now()),
              ($4,$2,$5,'Other initiative','APPROVED',now(),now())`,
      [initiativeId, organizationId, projectId, foreignInitiativeId, foreignProjectId]
    );
    await sql.query(
      `INSERT INTO tasks
         (id,organization_id,project_id,initiative_id,title,status,assignee_id,estimated_hours,due_date,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'Scoped demand','todo',$5,30,current_date + 2,now(),now()),
              ($6,$2,$7,$8,'Excluded demand','todo',$5,10,current_date + 2,now(),now())`,
      [
        randomUUID(), organizationId, projectId, initiativeId, userId,
        randomUUID(), foreignProjectId, foreignInitiativeId,
      ]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM tasks WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM initiatives WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM projects WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id=$1', [organizationId]);
    await sql.query('DELETE FROM users WHERE id IN ($1,$2)', [userId, availableUserId]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1,$2)', [organizationId, foreignOrganizationId]);
    await sql.end();
    delete process.env.ENABLE_INITIATIVES_WORKLOAD;
    delete process.env.RUN_DB_TESTS;
    delete process.env.MOCK_DB;
  });

  it('rejects an unauthenticated read and returns only the selected canonical project/status', async () => {
    const path = `/api/execution-control/capacity/initiative-workload?weeks=1&projectId=${projectId}&initiativeStatuses=PENDING_APPROVAL`;
    expect((await request(app).get(path)).status).toBe(401);

    const response = await request(app).get(path).set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.people).toHaveLength(2);
    expect(response.body.rows).toHaveLength(2);
    expect(response.body.rows.find((row: { userId: string }) => row.userId === userId)).toMatchObject({
      userId,
      demandHours: 30,
      supplyHours: 20,
      utilizationPercent: 150,
    });
    expect(
      response.body.rows.find((row: { userId: string }) => row.userId === availableUserId)
    ).toMatchObject({ userId: availableUserId, demandHours: 0, utilizationPercent: 0 });
    expect(response.body.summary.overloadedCount).toBe(1);

    process.env.ENABLE_INITIATIVES_WORKLOAD = 'false';
    const offResponse = await request(app).get(path).set('Authorization', authorization);
    expect(offResponse.status).toBe(404);
    expect(offResponse.body.code).toBe('INITIATIVES_WORKLOAD_DISABLED');
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';
  });
});
