/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';
import {
  __private__ as authPrivate,
  setDependencies,
} from '../../../server/src/middleware/auth.middleware.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';

const databaseUrl = process.env.DATABASE_URL || '';
const runId = randomUUID();
const orgA = `day56-matrix-a-${runId}`;
const orgB = `day56-matrix-b-${runId}`;
const orgSuspended = `day56-matrix-suspended-${runId}`;
const activeUser = `day56-active-${runId}`;
const revokedUser = `day56-revoked-${runId}`;
const foreignUser = `day56-foreign-${runId}`;
const noOrgUser = `day56-no-org-${runId}`;
const suspendedUser = `day56-suspended-${runId}`;
const idleUser = `day56-idle-matrix-${runId}`;
const conversationId = `day56-conversation-${runId}`;
const shareId = `day56-share-${runId}`;
const shareToken = `day56-share-token-${runId}`;
const users = [activeUser, revokedUser, foreignUser, noOrgUser, suspendedUser, idleUser];
let client: Client;
let app: Express;

function token(id: string, organizationId?: string, jti?: string): string {
  return jwt.sign(
    {
      id,
      ...(organizationId ? { organizationId } : {}),
      role: 'ADMIN',
      ...(jti ? { jti } : {}),
    },
    config.JWT_SECRET,
    {
      expiresIn: '30m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    }
  );
}

async function conversations(
  id: string,
  organizationId?: string,
  jti?: string,
  requestedOrg = organizationId
) {
  let call = request(app)
    .get('/api/conversations')
    .query(requestedOrg ? { orgId: requestedOrg } : {})
    .set('Authorization', `Bearer ${token(id, organizationId, jti)}`);
  if (requestedOrg) call = call.set('x-org-context', requestedOrg);
  return call.send(requestedOrg ? { organizationId: requestedOrg } : {});
}

function expectRefusal(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ code });
}

describe('Day 56 auth-core exact HTTP matrices', { retry: 0 }, () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.serverVersion).toContain('PostgreSQL');

    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(
      `INSERT INTO organizations(id,name,status)
       VALUES($1,'Day56 A','active'),($2,'Day56 B','active'),($3,'Day56 suspended','suspended')`,
      [orgA, orgB, orgSuspended]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$7,$10,'!','Active','User','ADMIN','active'),
             ($2,$7,$11,'!','Revoked','User','ADMIN','active'),
             ($3,$8,$12,'!','Foreign','User','ADMIN','active'),
             ($4,NULL,$13,'!','NoOrg','User','ADMIN','active'),
             ($5,$9,$14,'!','Suspended','User','ADMIN','active'),
             ($6,$7,$15,'!','Idle','User','ADMIN','active')`,
      [
        activeUser,
        revokedUser,
        foreignUser,
        noOrgUser,
        suspendedUser,
        idleUser,
        orgA,
        orgB,
        orgSuspended,
        ...users.map((id) => `${id}@test.local`),
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$6,$7,'ADMIN','ACTIVE'),
             ($2,$6,$8,'ADMIN','REVOKED'),
             ($3,$9,$10,'ADMIN','ACTIVE'),
             ($4,$11,$12,'ADMIN','ACTIVE'),
             ($5,$6,$13,'ADMIN','ACTIVE')`,
      [
        `member-${activeUser}`,
        `member-${revokedUser}`,
        `member-${foreignUser}`,
        `member-${suspendedUser}`,
        `member-${idleUser}`,
        orgA,
        activeUser,
        revokedUser,
        orgB,
        foreignUser,
        orgSuspended,
        suspendedUser,
        idleUser,
      ]
    );
    await client.query(
      `INSERT INTO organization_settings(organization_id,setting_key,setting_value)
       VALUES($1,'security',$2)`,
      [orgA, JSON.stringify({ sessionTimeout: 5 })]
    );
    await client.query(
      `INSERT INTO user_sessions(id,user_id,organization_id,token_jti,created_at,last_activity_at,is_active,expires_at)
       VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP - INTERVAL '10 minutes',CURRENT_TIMESTAMP - INTERVAL '1 minute',true,CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
             ($5,$6,$3,$7,CURRENT_TIMESTAMP - INTERVAL '10 minutes',CURRENT_TIMESTAMP - INTERVAL '6 minutes',true,CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
      [
        `session-${activeUser}`,
        activeUser,
        orgA,
        `jti-${activeUser}`,
        `session-${idleUser}`,
        idleUser,
        `jti-${idleUser}`,
      ]
    );
    await client.query(
      `INSERT INTO conversations(id,user_id,organization_id,title) VALUES($1,$2,$3,'Day56 shared')`,
      [conversationId, activeUser, orgA]
    );
    await client.query(
      `INSERT INTO conversation_messages(id,conversation_id,role,content)
       VALUES($1,$2,'user','day56 evidence')`,
      [`message-${runId}`, conversationId]
    );
    await client.query(
      `INSERT INTO conversation_shares(id,conversation_id,share_token,created_by,title,is_active,settings)
       VALUES($1,$2,$3,$4,'Day56 public',1,$5)`,
      [shareId, conversationId, shareToken, activeUser, JSON.stringify({ anonymize: true })]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM conversation_share_views WHERE share_id=$1`, [shareId]);
    await client.query(`DELETE FROM conversation_shares WHERE id=$1`, [shareId]);
    await client.query(`DELETE FROM conversation_messages WHERE conversation_id=$1`, [
      conversationId,
    ]);
    await client.query(`DELETE FROM conversations WHERE id=$1`, [conversationId]);
    await client.query(`DELETE FROM revoked_tokens WHERE user_id=ANY($1::text[])`, [users]);
    await client.query(`DELETE FROM user_sessions WHERE user_id=ANY($1::text[])`, [users]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB, orgSuspended],
    ]);
    await client.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [users]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [
      [orgA, orgB, orgSuspended],
    ]);
    await client.end();
  });

  it('P.3 active membership remains 200', async () => {
    expect((await conversations(activeUser, orgA, `jti-${activeUser}`)).status).toBe(200);
  });

  it('P.3/P.8 revoked actor is exactly 403 ORG_MEMBERSHIP_REVOKED', async () => {
    expectRefusal(await conversations(revokedUser, orgA), 403, 'ORG_MEMBERSHIP_REVOKED');
  });

  it('P.3/P.8 foreign actor is exactly 403 ORG_CONTEXT_MISMATCH', async () => {
    expectRefusal(
      await conversations(foreignUser, orgA, undefined, orgA),
      403,
      'ORG_CONTEXT_MISMATCH'
    );
  });

  it('P.3/P.8 actor without organization is exactly 403 ORG_CONTEXT_REQUIRED', async () => {
    expectRefusal(await conversations(noOrgUser), 403, 'ORG_CONTEXT_REQUIRED');
  });

  it('P.4 revoke is effective on the very next request and restore returns 200', async () => {
    expect((await conversations(activeUser, orgA, `jti-${activeUser}`)).status).toBe(200);
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [orgA, activeUser]
    );
    expectRefusal(
      await conversations(activeUser, orgA, `jti-${activeUser}`),
      403,
      'ORG_MEMBERSHIP_REVOKED'
    );
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [orgA, activeUser]
    );
    expect((await conversations(activeUser, orgA, `jti-${activeUser}`)).status).toBe(200);
  });

  it('P.5 membership lookup failure is exactly 503 ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE', async () => {
    const original = await authPrivate.getDeps();
    setDependencies({
      dbGet: async <T>(sql: string, params?: unknown[]) => {
        if (
          sql.includes('SELECT status FROM organization_members') &&
          sql.includes('WHERE user_id = ? AND organization_id = ?')
        ) {
          throw new Error('day56 membership lookup fault');
        }
        return original.dbGet<T>(sql, params);
      },
    });
    try {
      expectRefusal(
        await conversations(activeUser, orgA, `jti-${activeUser}`),
        503,
        'ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE'
      );
    } finally {
      setDependencies(original);
    }
    expect((await conversations(activeUser, orgA, `jti-${activeUser}`)).status).toBe(200);
  });

  it('P.7 anonymous public share remains exactly 200', async () => {
    expect((await request(app).get(`/api/share/${shareToken}`)).status).toBe(200);
  });

  it('P.7 invalid token remains exactly 200', async () => {
    const response = await request(app)
      .get(`/api/share/${shareToken}`)
      .set('Authorization', 'Bearer invalid.invalid.invalid');
    expect(response.status).toBe(200);
  });

  it('P.7 suspended organization refusal is absorbed and public share is exactly 200', async () => {
    const response = await request(app)
      .get(`/api/share/${shareToken}`)
      .set('Authorization', `Bearer ${token(suspendedUser, orgSuspended)}`);
    expect(response.status).toBe(200);
    expect(response.headers).not.toHaveProperty('x-session-id');
  });

  it.each([
    ['revoked', revokedUser, orgA],
    ['foreign', foreignUser, orgA],
    ['without organization', noOrgUser, undefined],
  ])('P.7 %s actor remains anonymous with exact 200', async (_label, id, organizationId) => {
    const response = await request(app)
      .get(`/api/share/${shareToken}`)
      .set('Authorization', `Bearer ${token(id, organizationId)}`);
    expect(response.status).toBe(200);
  });

  it('P.8 flag ON rejects idle session with exactly 401 SESSION_IDLE_TIMEOUT', async () => {
    expectRefusal(
      await conversations(idleUser, orgA, `jti-${idleUser}`),
      401,
      'SESSION_IDLE_TIMEOUT'
    );
  });

  it('P.8 flag OFF preserves the same idle request at exactly 200', async () => {
    const previous = process.env.SESSION_IDLE_ENFORCEMENT;
    process.env.SESSION_IDLE_ENFORCEMENT = 'false';
    try {
      expect((await conversations(idleUser, orgA, `jti-${idleUser}`)).status).toBe(200);
    } finally {
      process.env.SESSION_IDLE_ENFORCEMENT = previous;
    }
  });
});
