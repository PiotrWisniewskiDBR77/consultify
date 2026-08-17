import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('CHAT-NFR — tenant-bound partial recovery (real PostgreSQL)', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `chat_partial_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const userA = id('user_a');
  const userB = id('user_b');
  const revoked = id('revoked');
  const session = id('session');
  let pool: Pool;
  let app: express.Express;
  let tokenA = '';
  let tokenB = '';
  let tokenRevoked = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.E2E_MODE = 'true';
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const [organizationId, name] of [
      [orgA, 'Partial A'],
      [orgB, 'Partial B'],
    ]) {
      await pool.query(
        `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`,
        [organizationId, name]
      );
    }
    for (const [userId, organizationId, status] of [
      [userA, orgA, 'ACTIVE'],
      [userB, orgB, 'ACTIVE'],
      [revoked, orgA, 'INACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status)
         VALUES ($1,$2,$3,'unused','OWNER','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,'OWNER',$4)`,
        [id(`member_${userId}`), organizationId, userId, status]
      );
    }
    await pool.query(
      `INSERT INTO conversations (id,user_id,organization_id,title)
       VALUES ($1,$2,$3,'Partial recovery')`,
      [session, userA, orgA]
    );
    await pool.query(
      `INSERT INTO ai_partial_responses
         (id,session_id,user_id,organization_id,content,updated_at)
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)`,
      [id('row'), session, userA, orgA, 'durable partial']
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    const sign = (userId: string, organizationId: string) =>
      jwt.sign(
        { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
        config.JWT_SECRET,
        { expiresIn: '10m' }
      );
    tokenA = sign(userA, orgA);
    tokenB = sign(userB, orgB);
    tokenRevoked = sign(revoked, orgA);

    const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM ai_partial_responses WHERE session_id LIKE $1`, [
      `chat_partial_%_${suffix}`,
    ]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id=$1`, [session]);
    await pool.query(`DELETE FROM conversations WHERE id=$1`, [session]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB, revoked]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);
    await pool.end();
  });

  it('returns a non-empty checkpoint to the same ACTIVE tenant member', async () => {
    const response = await request(app)
      .get(`/api/ai/stream/partial/${session}`)
      .set(bearer(tokenA));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sessionId: session,
      content: 'durable partial',
      canResume: true,
    });
  });

  it('does not disclose the checkpoint to a foreign tenant', async () => {
    const response = await request(app)
      .get(`/api/ai/stream/partial/${session}`)
      .set(bearer(tokenB));
    expect(response.status).toBe(404);
    expect(response.text).not.toContain('durable partial');
  });

  it('does not disclose the checkpoint to a revoked member', async () => {
    await pool.query(`UPDATE ai_partial_responses SET user_id=$1 WHERE session_id=$2`, [
      revoked,
      session,
    ]);
    const response = await request(app)
      .get(`/api/ai/stream/partial/${session}`)
      .set(bearer(tokenRevoked));
    expect(response.status).toBe(404);
    expect(response.text).not.toContain('durable partial');
    await pool.query(`UPDATE ai_partial_responses SET user_id=$1 WHERE session_id=$2`, [
      userA,
      session,
    ]);
  });

  it('rejects new unscoped checkpoints and preserves the scoped row', async () => {
    await expect(
      pool.query(
        `INSERT INTO ai_partial_responses (id,session_id,user_id,organization_id,content)
         VALUES ($1,$2,$3,NULL,'unscoped')`,
        [id('unscoped'), id('unscoped_session'), userA]
      )
    ).rejects.toMatchObject({ code: '23514' });
    const row = await pool.query(
      `SELECT organization_id,user_id,content FROM ai_partial_responses WHERE session_id=$1`,
      [session]
    );
    expect(row.rows).toEqual([
      { organization_id: orgA, user_id: userA, content: 'durable partial' },
    ]);
  });

  it('stores the same session id independently for two tenants and scopes deletion', async () => {
    await Promise.all([
      pool.query(
        `INSERT INTO ai_partial_responses (id,session_id,user_id,organization_id,content)
         VALUES ($1,$2,$3,$4,'tenant A')
         ON CONFLICT(organization_id,user_id,session_id) DO UPDATE SET content=excluded.content`,
        [id('same_a'), id('shared_session'), userA, orgA]
      ),
      pool.query(
        `INSERT INTO ai_partial_responses (id,session_id,user_id,organization_id,content)
         VALUES ($1,$2,$3,$4,'tenant B')
         ON CONFLICT(organization_id,user_id,session_id) DO UPDATE SET content=excluded.content`,
        [id('same_b'), id('shared_session'), userB, orgB]
      ),
    ]);
    const rows = await pool.query(
      `SELECT organization_id,content FROM ai_partial_responses
       WHERE session_id=$1 ORDER BY organization_id`,
      [id('shared_session')]
    );
    expect(rows.rows).toEqual([
      { organization_id: orgA, content: 'tenant A' },
      { organization_id: orgB, content: 'tenant B' },
    ]);
    await pool.query(
      `DELETE FROM ai_partial_responses
       WHERE session_id=$1 AND user_id=$2 AND organization_id=$3`,
      [id('shared_session'), userA, orgA]
    );
    const survivor = await pool.query(
      `SELECT organization_id,content FROM ai_partial_responses WHERE session_id=$1`,
      [id('shared_session')]
    );
    expect(survivor.rows).toEqual([{ organization_id: orgB, content: 'tenant B' }]);
  });

  it('requires ACTIVE membership before POST /chat/stream reaches the handler', async () => {
    const body = { message: 'resume', conversationId: session, resumeFromPartial: true };
    const active = await request(app).post('/api/ai/chat/stream').set(bearer(tokenA)).send(body);
    expect(active.status).toBe(200);
    expect(active.text).toContain('data:');

    const denied = await request(app)
      .post('/api/ai/chat/stream')
      .set(bearer(tokenRevoked))
      .send(body);
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

    const foreign = await request(app).post('/api/ai/chat/stream').set(bearer(tokenB)).send(body);
    expect(foreign.status).toBe(200);
    expect(foreign.text).toContain('PARTIAL_RECOVERY_NOT_FOUND');
  });
});
