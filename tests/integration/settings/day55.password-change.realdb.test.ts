/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const NO_RETRY = { retry: 0 } as const;

describe('Day 55 A.2 — password change through the real ApiGateway', NO_RETRY, () => {
  const prefix = `day55-password-${randomUUID()}`;
  const organizationId = `${prefix}-org`;
  const userId = `${prefix}-user`;
  const otherUserId = `${prefix}-other`;
  const email = `${prefix}@test.invalid`;
  const currentPassword = 'Day55-current-Password-1!';
  const newPassword = 'Day55-new-Password-2!';
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let tokenOne = '';
  let tokenTwo = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../../server/src/Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,$4,'MEMBER','active',1),($5,$2,$6,$4,'MEMBER','active',1)`,
      [
        userId,
        organizationId,
        email,
        bcrypt.hashSync(currentPassword, 10),
        otherUserId,
        `${prefix}-other@test.invalid`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'MEMBER','ACTIVE'),($4,$2,$5,'MEMBER','ACTIVE')`,
      [randomUUID(), organizationId, userId, randomUUID(), otherUserId]
    );

    const login = () =>
      request(app).post('/api/auth/login').send({ email, password: currentPassword });
    const first = await login();
    const second = await login();
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    tokenOne = String(first.body?.token || '');
    tokenTwo = String(second.body?.token || '');
    expect(tokenOne).not.toBe('');
    expect(tokenTwo).not.toBe('');
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM revoked_tokens WHERE user_id=ANY($1::text[])`, [
      [userId, otherUserId],
    ]);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id=ANY($1::text[])`, [
      [userId, otherUserId],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const regional = (token: string) =>
    request(app)
      .get('/api/settings/preferences/regional')
      .set('Authorization', `Bearer ${token}`)
      .set('x-org-context', organizationId);

  it('measures the other access token before and after a successful password change', async () => {
    const before = await regional(tokenTwo);
    expect(before.status, JSON.stringify(before.body)).toBe(200);

    const oldHash = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenOne}`)
      .set('x-org-context', organizationId)
      .send({ currentPassword, newPassword });
    expect(change.status, JSON.stringify(change.body)).toBe(200);
    expect(change.body?.message).toContain(
      'existing access token can remain valid until it expires'
    );

    const newHash = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    expect(newHash).not.toBe(oldHash);
    expect(bcrypt.compareSync(newPassword, newHash || '')).toBe(true);

    const after = await regional(tokenTwo);
    expect(after.status, JSON.stringify(after.body)).toBe(200);
    const currentAfter = await regional(tokenOne);
    expect(currentAfter.status, JSON.stringify(currentAfter.body)).toBe(200);

    const counts = await pool.query<{ revoked_access: string; revoked_refresh: string }>(
      `SELECT
         (SELECT count(*)::text FROM revoked_tokens WHERE user_id=$1) AS revoked_access,
         (SELECT count(*)::text FROM refresh_tokens WHERE user_id=$1 AND revoked_at IS NOT NULL) AS revoked_refresh`,
      [userId]
    );
    expect(counts.rows[0]).toEqual({ revoked_access: '0', revoked_refresh: '2' });
  });

  it('rejects a wrong current password and preserves the stored hash', async () => {
    const before = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenOne}`)
      .send({ currentPassword: 'wrong-password', newPassword: 'Another-valid-Password-3!' });
    expect(response.status).toBe(401);
    const after = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    expect(after).toBe(before);
  });

  it('rejects a new password equal to the current password and preserves the stored hash', async () => {
    const before = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenOne}`)
      .send({ currentPassword: newPassword, newPassword });
    expect(response.status).toBe(400);
    const after = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [userId])
    ).rows[0]?.password;
    expect(after).toBe(before);
  });

  it('cannot change another user password because the target is derived only from the JWT', async () => {
    const before = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [
        otherUserId,
      ])
    ).rows[0]?.password;
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenOne}`)
      .send({
        userId: otherUserId,
        currentPassword: newPassword,
        newPassword: 'Self-bound-Password-4!',
      });
    expect(response.status).toBe(200);
    const after = (
      await pool.query<{ password: string }>('SELECT password FROM users WHERE id=$1', [
        otherUserId,
      ])
    ).rows[0]?.password;
    expect(after).toBe(before);
  });

  it.fails('CZERWONY KONTRAKT DYŻURU 55 — patrz §A.2: inne access tokeny tracą dostęp, bieżący pozostaje ważny', async () => {
    const currentJti = String((jwt.decode(tokenOne) as { jti?: string } | null)?.jti || '');
    expect(currentJti).not.toBe('');
    expect((await regional(tokenTwo)).status).toBe(401);
    expect((await regional(tokenOne)).status).toBe(200);
  });
});
