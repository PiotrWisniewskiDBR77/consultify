/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);
const secret = 'day15-admin-audit-projection-secret-long-enough';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';

describe.skipIf(!enabled)('Day 15 A.2 unified admin audit projection RealPG', () => {
  const suffix = randomUUID().slice(0, 8);
  const org = `day15-audit-org-${suffix}`;
  const foreignOrg = `day15-audit-foreign-${suffix}`;
  const owner = `day15-audit-owner-${suffix}`;
  const foreignOwner = `day15-audit-foreign-owner-${suffix}`;
  const localEvent = `day15-audit-local-${suffix}`;
  const foreignEvent = `day15-audit-foreign-event-${suffix}`;
  const pool = new Pool({ connectionString: databaseUrl });
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    for (const id of [org, foreignOrg])
      await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$1)', [id]);
    for (const [id, organizationId] of [
      [owner, org],
      [foreignOwner, foreignOrg],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,role,status)
         VALUES ($1,$2,$3,'OWNER','active')`,
        [id, organizationId, `${id}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, id]
      );
    }
    await pool.query(
      `INSERT INTO audit_events
       (id,ts,actor_id,actor_type,org_id,action,resource_type,resource_id,metadata_json)
       VALUES ($1,NOW(),$2,'USER',$3,'team.updated','team','team-a','{"source":"day15"}'),
              ($4,NOW(),$5,'USER',$6,'team.updated','team','team-b','{"source":"day15"}')`,
      [localEvent, owner, org, foreignEvent, foreignOwner, foreignOrg]
    );
    const router = (await import('../adminP32.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/admin', router);
    token = jwt.sign(
      {
        id: owner,
        userId: owner,
        organizationId: org,
        email: `${owner}@test.invalid`,
        role: 'OWNER',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM audit_events WHERE id = ANY($1)', [[localEvent, foreignEvent]]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [
      [org, foreignOrg],
    ]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[owner, foreignOwner]]);
    await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[org, foreignOrg]]);
    await pool.end();
  });

  it('projects the unified row without fabricated risk and excludes the foreign tenant', async () => {
    const response = await request(app)
      .get('/api/admin/audit-logs?limit=100')
      .set({ Authorization: `Bearer ${token}` });
    expect(response.status).toBe(200);
    const row = response.body.logs.find((item: any) => item.id === localEvent);
    expect(row).toMatchObject({
      organization_id: org,
      action_type: 'team.updated',
      resource_type: 'team',
      resource_id: 'team-a',
      risk_score: null,
    });
    expect(JSON.stringify(response.body)).not.toContain(foreignEvent);
  });
});
