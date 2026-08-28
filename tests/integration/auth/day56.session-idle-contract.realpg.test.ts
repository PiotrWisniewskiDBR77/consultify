/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

// vitest.config pins sqlite after reading the shell; restore the explicitly
// requested real-PG mode for this isolated evidence package.
process.env.DB_TYPE = 'postgres';

const databaseUrl = process.env.DATABASE_URL || '';
const runId = randomUUID();
const orgId = `day56-idle-org-${runId}`;
const idleUserId = `day56-idle-user-${runId}`;
const activeUserId = `day56-active-user-${runId}`;
const noPolicyOrgId = `day56-no-policy-org-${runId}`;
const noPolicyUserId = `day56-no-policy-user-${runId}`;
const idleJti = `day56-idle-jti-${runId}`;
const activeJti = `day56-active-jti-${runId}`;
const noPolicyJti = `day56-no-policy-jti-${runId}`;
let client: Client;
let app: Express;
const previousIdleEnforcement = process.env.SESSION_IDLE_ENFORCEMENT;

function signedToken(id: string, organizationId: string, jti: string): string {
  return jwt.sign({ id, organizationId, role: 'ADMIN', jti }, config.JWT_SECRET, {
    expiresIn: '30m',
    ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
    ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
  });
}

describe('Day 56 idle-session enforcement through real ApiGateway', { retry: 0 }, () => {
  beforeAll(async () => {
    process.env.SESSION_IDLE_ENFORCEMENT = 'true';
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.serverVersion).toContain('PostgreSQL');

    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)`, [
      orgId,
      'Day 56 idle contract',
      noPolicyOrgId,
      'Day 56 no policy',
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$4,$5,'!','Idle','Admin','ADMIN','active'),
             ($2,$4,$6,'!','Active','Admin','ADMIN','active'),
             ($3,$7,$8,'!','NoPolicy','Admin','ADMIN','active')`,
      [
        idleUserId,
        activeUserId,
        noPolicyUserId,
        orgId,
        `${idleUserId}@test.local`,
        `${activeUserId}@test.local`,
        noPolicyOrgId,
        `${noPolicyUserId}@test.local`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$4,$5,'ADMIN','ACTIVE'),($2,$4,$6,'ADMIN','ACTIVE'),($3,$7,$8,'ADMIN','ACTIVE')`,
      [
        `member-${idleUserId}`,
        `member-${activeUserId}`,
        `member-${noPolicyUserId}`,
        orgId,
        idleUserId,
        activeUserId,
        noPolicyOrgId,
        noPolicyUserId,
      ]
    );
    await client.query(
      `INSERT INTO organization_settings(organization_id,setting_key,setting_value)
       VALUES($1,'security',$2)`,
      [orgId, JSON.stringify({ sessionTimeout: 5 })]
    );
    await client.query(
      `INSERT INTO user_sessions(id,user_id,organization_id,token_jti,created_at,last_activity_at,is_active,expires_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP - INTERVAL '10 minutes',CURRENT_TIMESTAMP - INTERVAL '6 minutes',true,CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
             ($5,$6,$3,$7,CURRENT_TIMESTAMP - INTERVAL '10 minutes',CURRENT_TIMESTAMP - INTERVAL '4 minutes',true,CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
             ($8,$9,$10,$11,CURRENT_TIMESTAMP - INTERVAL '10 minutes',CURRENT_TIMESTAMP - INTERVAL '20 minutes',true,CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      [
        `session-${idleUserId}`,
        idleUserId,
        orgId,
        idleJti,
        `session-${activeUserId}`,
        activeUserId,
        activeJti,
        `session-${noPolicyUserId}`,
        noPolicyUserId,
        noPolicyOrgId,
        noPolicyJti,
      ]
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    try {
      if (!client) return;
      const users = [idleUserId, activeUserId, noPolicyUserId];
      await client.query(`DELETE FROM revoked_tokens WHERE user_id=ANY($1::text[])`, [users]);
      await client.query(`DELETE FROM user_sessions WHERE user_id=ANY($1::text[])`, [users]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
        [orgId, noPolicyOrgId],
      ]);
      await client.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [users]);
      await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [
        [orgId, noPolicyOrgId],
      ]);
      await client.end();
    } finally {
      if (previousIdleEnforcement === undefined) {
        delete process.env.SESSION_IDLE_ENFORCEMENT;
      } else {
        process.env.SESSION_IDLE_ENFORCEMENT = previousIdleEnforcement;
      }
    }
  });

  it('rejects the first request after the tenant idle threshold', async () => {
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(idleUserId, orgId, idleJti)}`);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'SESSION_IDLE_TIMEOUT',
      message: expect.any(String),
      messagePl: expect.any(String),
    });
  });

  it('keeps a session inside the threshold active and refreshes activity', async () => {
    const before = await client.query<{ last_activity_at: Date }>(
      `SELECT last_activity_at FROM user_sessions WHERE token_jti=$1`,
      [activeJti]
    );
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(activeUserId, orgId, activeJti)}`);
    expect(response.status).toBe(200);
    await expect
      .poll(async () => {
        const readback = await client.query<{ last_activity_at: Date }>(
          `SELECT last_activity_at FROM user_sessions WHERE token_jti=$1`,
          [activeJti]
        );
        return readback.rows[0].last_activity_at.getTime();
      })
      .toBeGreaterThan(before.rows[0].last_activity_at.getTime());
  });

  it('does not enforce a default when the organization has no stored policy', async () => {
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(noPolicyUserId, noPolicyOrgId, noPolicyJti)}`);
    expect(response.status).toBe(200);
  });

  it('does not treat a stored security object without sessionTimeout as a policy', async () => {
    await client.query(
      `INSERT INTO organization_settings(organization_id,setting_key,setting_value)
       VALUES($1,'security',$2)`,
      [noPolicyOrgId, JSON.stringify({ passwordMinLength: 12 })]
    );
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(noPolicyUserId, noPolicyOrgId, noPolicyJti)}`);
    expect(response.status).toBe(200);
  });

  it('does not refresh the idle timestamp when it refuses the request', async () => {
    const before = await client.query<{ last_activity_at: Date }>(
      `SELECT last_activity_at FROM user_sessions WHERE token_jti=$1`,
      [idleJti]
    );
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(idleUserId, orgId, idleJti)}`);
    const after = await client.query<{ last_activity_at: Date }>(
      `SELECT last_activity_at FROM user_sessions WHERE token_jti=$1`,
      [idleJti]
    );
    expect(response.status).toBe(401);
    expect(after.rows[0].last_activity_at.getTime()).toBe(
      before.rows[0].last_activity_at.getTime()
    );
  });

  it('keeps legacy tokens without jti usable because no session can be bound', async () => {
    const token = jwt.sign(
      { id: activeUserId, organizationId: orgId, role: 'ADMIN' },
      config.JWT_SECRET,
      {
        expiresIn: '30m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      }
    );
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it('allows an old session when enforcement is explicitly disabled', async () => {
    const previous = process.env.SESSION_IDLE_ENFORCEMENT;
    process.env.SESSION_IDLE_ENFORCEMENT = 'false';
    try {
      const response = await request(app)
        .get('/api/admin/sessions')
        .set('Authorization', `Bearer ${signedToken(idleUserId, orgId, idleJti)}`);
      expect(response.status).toBe(200);
    } finally {
      if (previous === undefined) delete process.env.SESSION_IDLE_ENFORCEMENT;
      else process.env.SESSION_IDLE_ENFORCEMENT = previous;
    }
  });

  it('documents the no-session decision as fail-open for legacy tokens', async () => {
    const response = await request(app)
      .get('/api/admin/sessions')
      .set('Authorization', `Bearer ${signedToken(activeUserId, orgId, `missing-${runId}`)}`);
    expect(response.status).toBe(200);
  });
});
