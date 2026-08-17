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
});
