/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';
const NO_RETRY = { retry: 0 } as const;

describe('Day 49 C.1 portfolio health through the real ApiGateway', NO_RETRY, () => {
  const suffix = randomUUID();
  const organizationId = `day49-c1-${suffix}`;
  const emptyOrganizationId = `day49-c1-empty-${suffix}`;
  const foreignOrganizationId = `day49-c1-foreign-${suffix}`;
  const userId = randomUUID();
  const emptyUserId = randomUUID();
  const foreignUserId = randomUUID();
  const initiativeId = `day49-c1-initiative-${suffix}`;
  const foreignInitiativeIds = [`day49-c1-foreign-a-${suffix}`, `day49-c1-foreign-b-${suffix}`];
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });

  const tokenFor = (id: string, orgId: string) =>
    jwt.sign(
      { id, userId: id, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  const authFor = (id: string, orgId: string) => ({
    Authorization: `Bearer ${tokenFor(id, orgId)}`,
    'x-org-context': orgId,
  });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.JWT_SECRET = jwtSecret;
    await sql.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const identities = [
      [organizationId, userId],
      [emptyOrganizationId, emptyUserId],
      [foreignOrganizationId, foreignUserId],
    ] as const;
    for (const [orgId, memberId] of identities) {
      await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [orgId]);
      await sql.query(
        `INSERT INTO users(id,email,password,role,organization_id,status)
         VALUES($1,$2,'test','OWNER',$3,'active')`,
        [memberId, `${memberId}@day49.invalid`, orgId]
      );
      await sql.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), orgId, memberId]
      );
    }
    await sql.query(
      `INSERT INTO initiatives
         (id,organization_id,name,title,summary,status,area,category,effort,impact)
       VALUES
         ($1,$2,'Automatyzacja obsługi','Automatyzacja obsługi','Redukcja pracy ręcznej','APPROVED','operations','automation','LOW','HIGH'),
         ($3,$4,'Obca inicjatywa A','Obca inicjatywa A','Poza tenantem','APPROVED','finance','cost','HIGH','LOW'),
         ($5,$4,'Obca inicjatywa B','Obca inicjatywa B','Poza tenantem','PLANNING','people','skills','MEDIUM','MEDIUM')`,
      [
        initiativeId,
        organizationId,
        foreignInitiativeIds[0],
        foreignOrganizationId,
        foreignInitiativeIds[1],
      ]
    );
  }, 30_000);

  afterAll(async () => {
    await sql.query(`DELETE FROM initiatives WHERE organization_id=ANY($1)`, [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
      [organizationId, emptyOrganizationId, foreignOrganizationId],
    ]);
    await sql.query(`DELETE FROM users WHERE id=ANY($1)`, [[userId, emptyUserId, foreignUserId]]);
    await sql.query(`DELETE FROM organizations WHERE id=ANY($1)`, [
      [organizationId, emptyOrganizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it('returns computed data for an organization with initiatives', async () => {
    const response = await request(app)
      .get('/api/initiatives/portfolio-health')
      .set(authFor(userId, organizationId));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.byStatus).toEqual({ APPROVED: 1 });
  });

  it('returns an honest empty portfolio for an empty organization', async () => {
    const response = await request(app)
      .get('/api/initiatives/portfolio-health')
      .set(authFor(emptyUserId, emptyOrganizationId));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
    expect(response.body.readyToLaunch).toEqual([]);
  });

  it('does not leak initiatives from a foreign tenant', async () => {
    const response = await request(app)
      .get('/api/initiatives/portfolio-health')
      .set(authFor(userId, organizationId));

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(JSON.stringify(response.body)).not.toContain(foreignInitiativeIds[0]);
    expect(JSON.stringify(response.body)).not.toContain(foreignInitiativeIds[1]);
  });
});
