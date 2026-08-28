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

describe('Day 55 adversarial B2 — personal settings without organization membership', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const userId = randomUUID();
  const password = 'Day55-personal-Password-1!';
  const app = express();
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,language)
       VALUES($1,$2,$3,$4,'MEMBER','active','Before','Personal','en')`,
      [
        userId,
        organizationId,
        `${userId}@test.invalid`,
        bcrypt.hashSync(password, 10),
      ]
    );
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'MEMBER',
      },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM user_preferences WHERE user_id=$1`, [userId]);
    await pool.query(`DELETE FROM revoked_tokens WHERE user_id=$1`, [userId]);
    await pool.query(`DELETE FROM refresh_tokens WHERE user_id=$1`, [userId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('keeps four personal writes available without organization membership', async () => {
    const headers = (r: request.Test) =>
      r.set('Authorization', authorization).set('x-org-context', organizationId);
    const changePassword = await headers(request(app).post('/api/auth/change-password')).send({
      currentPassword: password,
      newPassword: 'Day55-personal-Password-2!',
    });
    const profile = await headers(request(app).put(`/api/users/${userId}`)).send({
      firstName: 'After',
    });
    const language = await headers(request(app).put(`/api/users/${userId}`)).send({ language: 'pl' });
    const notifications = await headers(
      request(app).put('/api/settings/notifications/email')
    ).send({ enabled: true, taskUpdates: false });

    const measured = {
      changePassword: changePassword.status,
      profile: profile.status,
      language: language.status,
      notifications: notifications.status,
    };
    console.log('DAY55_PERSONAL_NO_MEMBERSHIP_CODES', measured);
    expect(measured).toEqual({
      changePassword: 200,
      profile: 200,
      language: 200,
      notifications: 200,
    });
  });
});
