/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 55 D.1 — four owner operations survive an independent reload', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const readback = new Client({ connectionString: databaseUrl });
  const orgId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const emptyUserId = randomUUID();
  const app = express();
  let authorization = '';
  let otherAuthorization = '';
  let emptyAuthorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    await readback.connect();
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../../server/src/Gateway.js'),
      import('../../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [orgId]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,language)
       VALUES($1,$2,$3,'unused','MEMBER','active','Before','Owner','en'),
             ($4,$2,$5,'unused','MEMBER','active','Other','User','en'),
             ($6,$2,$7,'unused','MEMBER','active','Empty','State','en')`,
      [
        userId,
        orgId,
        `${userId}@test.invalid`,
        otherUserId,
        `${otherUserId}@test.invalid`,
        emptyUserId,
        `${emptyUserId}@test.invalid`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'MEMBER','ACTIVE'),($4,$2,$5,'MEMBER','ACTIVE'),($6,$2,$7,'MEMBER','ACTIVE')`,
      [randomUUID(), orgId, userId, randomUUID(), otherUserId, randomUUID(), emptyUserId]
    );
    const sign = (id: string) =>
      `Bearer ${jwt.sign(
        { id, userId: id, organizationId: orgId, organization_id: orgId, role: 'MEMBER' },
        config.JWT_SECRET,
        { expiresIn: '10m', jwtid: randomUUID() }
      )}`;
    authorization = sign(userId);
    otherAuthorization = sign(otherUserId);
    emptyAuthorization = sign(emptyUserId);
  }, 60_000);

  afterAll(async () => {
    for (const table of ['user_preferences', 'notification_preferences']) {
      await pool.query(`DELETE FROM ${table} WHERE user_id=ANY($1::text[])`, [
        [userId, otherUserId, emptyUserId],
      ]);
    }
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    await readback.end();
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const get = (path: string, auth = authorization) =>
    request(app).get(path).set('Authorization', auth).set('x-org-context', orgId);
  const put = (path: string, body: unknown, auth = authorization) =>
    request(app).put(path).set('Authorization', auth).set('x-org-context', orgId).send(body);

  it('profile: write, independent SQL readback, and a fresh Gateway GET', async () => {
    const write = await put(`/api/users/${userId}`, {
      firstName: 'Piotr',
      lastName: 'Reloaded',
      phone: '+48 000 000 000',
    });
    expect(write.status, JSON.stringify(write.body)).toBe(200);
    const contactWrite = await put('/api/user/contact-information/', {
      phone: '+48 000 000 000',
      city: 'Warszawa',
    });
    expect(contactWrite.status, JSON.stringify(contactWrite.body)).toBe(200);
    const row = (
      await readback.query(`SELECT first_name,last_name FROM users WHERE id=$1`, [userId])
    ).rows[0];
    expect(row).toMatchObject({
      first_name: 'Piotr',
      last_name: 'Reloaded',
    });
    expect(
      (await readback.query(`SELECT phone,city FROM user_contact WHERE user_id=$1`, [userId]))
        .rows[0]
    ).toMatchObject({ phone: '+48 000 000 000', city: 'Warszawa' });
    const reloaded = await get(`/api/users/${userId}`);
    expect(reloaded.status).toBe(200);
    expect(JSON.stringify(reloaded.body)).toContain('Piotr');
    const contactReloaded = await get('/api/user/contact-information/');
    expect(contactReloaded.status).toBe(200);
    expect(contactReloaded.body).toMatchObject({
      phone: '+48 000 000 000',
      city: 'Warszawa',
    });

    const beforeOther = (
      await readback.query(`SELECT first_name FROM users WHERE id=$1`, [otherUserId])
    ).rows[0];
    const denied = await put(`/api/users/${otherUserId}`, { firstName: 'Hijacked' });
    expect(denied.status).toBe(403);
    expect(
      (await readback.query(`SELECT first_name FROM users WHERE id=$1`, [otherUserId])).rows[0]
    ).toEqual(beforeOther);
  });

  it('language and theme: both stores survive fresh Gateway GETs', async () => {
    expect((await put(`/api/users/${userId}`, { language: 'pl' })).status).toBe(200);
    expect(
      (
        await put('/api/settings/preferences/appearance', {
          theme: 'dark',
          accentColor: '#2563eb',
          density: 'comfortable',
          fontScale: 100,
        })
      ).status
    ).toBe(200);
    expect(
      (await readback.query(`SELECT language FROM users WHERE id=$1`, [userId])).rows[0]?.language
    ).toBe('pl');
    const stored = (
      await readback.query(
        `SELECT value FROM user_preferences WHERE user_id=$1 AND key='settings:appearance'`,
        [userId]
      )
    ).rows[0]?.value;
    expect(JSON.parse(String(stored))).toMatchObject({ theme: 'dark', accentColor: '#2563eb' });
    expect(JSON.stringify((await get(`/api/users/${userId}`)).body)).toContain('pl');
    const appearance = await get('/api/settings/preferences/appearance');
    expect(appearance.status).toBe(200);
    expect(appearance.body.preferences).toMatchObject({ theme: 'dark', accentColor: '#2563eb' });
  });

  it('regional: canonical writer persists the complete regional envelope', async () => {
    const preferences = {
      timezone: 'Europe/Warsaw',
      currency: 'PLN',
      dateFormat: 'DD.MM.YYYY',
      timeFormat: '24h',
      units: 'metric',
      firstDayOfWeek: 'monday',
      numberFormat: '1 234,56',
    };
    expect((await put('/api/settings/preferences/regional', { preferences })).status).toBe(200);
    const stored = (
      await readback.query(
        `SELECT value FROM user_preferences WHERE user_id=$1 AND key='settings:regional'`,
        [userId]
      )
    ).rows[0]?.value;
    expect(JSON.parse(String(stored))).toEqual(preferences);
    const reloaded = await get('/api/settings/preferences/regional');
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.preferences).toEqual(preferences);
  });

  it('email and digest: canonical keys persist without sending mail', async () => {
    const email = { enabled: true, taskUpdates: false, projectAlerts: true };
    const digest = { frequency: 'weekly', content: ['tasks'], format: 'html' };
    expect((await put('/api/settings/notifications/email', email)).status).toBe(200);
    expect((await put('/api/settings/notifications/digest', digest)).status).toBe(200);
    for (const [key, expected] of [
      ['settings:notification-email', email],
      ['settings:notification-digest', digest],
    ] as const) {
      const stored = (
        await readback.query(`SELECT value FROM user_preferences WHERE user_id=$1 AND key=$2`, [
          userId,
          key,
        ])
      ).rows[0]?.value;
      expect(JSON.parse(String(stored))).toMatchObject(expected);
    }
    expect((await get('/api/settings/notifications/email')).body).toMatchObject(email);
    expect((await get('/api/settings/notifications/digest')).body).toMatchObject(digest);
  });

  it('empty state is not persisted and validation failures preserve the prior values', async () => {
    expect((await get('/api/settings/preferences/regional', emptyAuthorization)).status).toBe(200);
    expect(
      Number(
        (
          await readback.query(`SELECT count(*)::int AS n FROM user_preferences WHERE user_id=$1`, [
            emptyUserId,
          ])
        ).rows[0]?.n ?? 0
      )
    ).toBe(0);
    const before = (
      await readback.query(
        `SELECT value FROM user_preferences WHERE user_id=$1 AND key='settings:regional'`,
        [userId]
      )
    ).rows[0]?.value;
    const invalid = await put('/api/settings/preferences/regional', {
      preferences: 'not-an-object',
    });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(
      (
        await readback.query(
          `SELECT value FROM user_preferences WHERE user_id=$1 AND key='settings:regional'`,
          [userId]
        )
      ).rows[0]?.value
    ).toBe(before);
  });
});
