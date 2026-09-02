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

describe('Day 274 — inicjatywa z Oceny dociera do listy runtime-v1', NO_RETRY, () => {
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const foreignUserId = randomUUID();
  const projectId = randomUUID();
  const assessmentId = randomUUID();
  const title = `Day 274 ${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;
  let foreignAuthorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(
      `INSERT INTO organizations(id,name,status) VALUES($1,$2,'active'),($3,$4,'active')`,
      [organizationId, 'Day 274 owner org', foreignOrganizationId, 'Day 274 foreign org']
    );
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active'),($4,$5,$6,'local-only','OWNER','active')`,
      [
        userId,
        organizationId,
        `${userId}@test.invalid`,
        foreignUserId,
        foreignOrganizationId,
        `${foreignUserId}@test.invalid`,
      ]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$5,$6,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId, randomUUID(), foreignOrganizationId, foreignUserId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)`, [
      projectId,
      organizationId,
      'Day 274 project',
    ]);
    await sql.query(
      `INSERT INTO assessments(id,organization_id,project_id,name,assessment_type,status,created_by)
       VALUES($1,$2,$3,$4,'DRD','APPROVED',$5)`,
      [assessmentId, organizationId, projectId, 'Day 274 assessment', userId]
    );

    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    foreignAuthorization = `Bearer ${jwt.sign(
      {
        id: foreignUserId,
        userId: foreignUserId,
        organizationId: foreignOrganizationId,
        organization_id: foreignOrganizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM assessment_initiative_links WHERE assessment_id=$1`, [
      assessmentId,
    ]);
    await sql.query(`DELETE FROM assessment_initiative_batches WHERE assessment_id=$1`, [
      assessmentId,
    ]);
    await sql.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM assessments WHERE id=$1`, [assessmentId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM users WHERE id = ANY($1)`, [[userId, foreignUserId]]);
    await sql.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it.fails('POST z Oceny jest widoczny przez GET runtime-v1', async () => {
    const created = await request(app)
      .post(`/api/assessment-workflow-v2/${assessmentId}/initiatives`)
      .set('Authorization', authorization)
      .send({ title, description: 'Kontrakt Day 274', priority: 'high', risk: 'medium' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const listed = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives')
      .set('Authorization', authorization);
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.initiatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ initiative: expect.objectContaining({ title }) }),
      ])
    );
  });

  it('obcy tenant nie widzi inicjatyw właściciela', async () => {
    const listed = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives?organizationId=${organizationId}`)
      .set('Authorization', foreignAuthorization);
    expect(listed.status, JSON.stringify(listed.body)).toBe(404);
    expect(JSON.stringify(listed.body)).not.toContain(title);
  });
});
