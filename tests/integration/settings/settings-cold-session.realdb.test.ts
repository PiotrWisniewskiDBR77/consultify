import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('SET-BVP-001 settings persistence across a cold session (real PostgreSQL)', () => {
  const previousEnv = { ...process.env };
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = 'settings-realdb-secret-minimum-32-characters';
  const encryptionKey = 'a'.repeat(64);
  const suffix = randomUUID();
  const userId = randomUUID();
  const orgId = randomUUID();
  const foreignUserId = randomUUID();
  const foreignOrgId = randomUUID();
  let db: any;
  let resetConnection: (() => Promise<void>) | undefined;
  let settingsRouter: any;
  let usersRouter: any;
  let authRouter: any;

  const token = (claims: Record<string, unknown> = {}) =>
    jwt.sign(
      {
        id: userId,
        organizationId: orgId,
        email: `settings-${suffix}@test.local`,
        role: 'MEMBER',
        ...claims,
      },
      jwtSecret,
      { expiresIn: '5m', jwtid: randomUUID() }
    );

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/auth', authRouter);
    return app;
  };

  const auth = (method: 'get' | 'put', path: string) =>
    request(makeApp())[method](path).set('Authorization', `Bearer ${token()}`);

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('SET-BVP-001 requires a disposable PostgreSQL DATABASE_URL');
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = jwtSecret;
    process.env.INTEGRATION_ENCRYPT_KEY = encryptionKey;

    const database = await import('../../../server/src/database/Database.ts');
    resetConnection = database.resetConnection;
    await resetConnection();
    db = await database.getDatabaseAsync();
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'SET-BVP realDB']);
    await db.run(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [foreignOrgId, 'Foreign']);
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, orgId, `settings-${suffix}@test.local`, 'Cold', 'Session', 'MEMBER']
    );
    await db.run(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [foreignUserId, foreignOrgId, `foreign-${suffix}@test.local`, 'Foreign', 'User', 'MEMBER']
    );
    settingsRouter = (await import('../../../server/src/routes/settings.routes.ts')).default;
    usersRouter = (await import('../../../server/src/routes/users.routes.ts')).default;
    authRouter = (await import('../../../server/src/routes/auth.routes.ts')).default;
  }, 30_000);

  afterAll(async () => {
    try {
      if (db) {
        await db.run(`DELETE FROM user_preferences WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM users WHERE id = ?`, [foreignUserId]);
        await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
        await db.run(`DELETE FROM organizations WHERE id = ?`, [foreignOrgId]);
        await db.run(`DELETE FROM organizations WHERE id = ?`, [orgId]);
      }
      await resetConnection?.();
    } finally {
      process.env = previousEnv;
    }
  }, 30_000);

  it('writes regional/language, theme, notifications and AI values to PostgreSQL', async () => {
    const profileWrite = await request(makeApp())
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ firstName: 'Persisted', jobTitle: 'Transformation Lead', languagePreference: 'pl' });
    expect(profileWrite.status).toBe(200);
    expect(profileWrite.body.data).toEqual(
      expect.objectContaining({
        first_name: 'Persisted',
        job_title: 'Transformation Lead',
        language: 'pl',
      })
    );

    expect(
      (
        await auth('put', '/api/settings/preferences/regional').send({
          preferences: { language: 'pl', timezone: 'Europe/Warsaw', currency: 'PLN' },
        })
      ).status
    ).toBe(200);
    expect(
      (await auth('put', '/api/settings/preferences/appearance').send({ theme: 'dark' })).status
    ).toBe(200);
    expect(
      (
        await auth('put', '/api/settings/preferences/notifications').send({
          preferences: { email: false, push: true, inApp: true, digest: 'weekly' },
        })
      ).status
    ).toBe(200);
    expect(
      (await auth('put', '/api/settings/preferences/inbox-ai').send({ threshold: 0.91 })).status
    ).toBe(200);

    const secret = `sk-private-${suffix}`;
    const aiWrite = await auth('put', '/api/settings/preferences/ai-providers').send({
      providers: [{ id: 'openai-1', name: 'OpenAI', provider: 'openai', apiKey: secret }],
    });
    expect(aiWrite.status).toBe(200);
    expect(aiWrite.body.providers[0]).toEqual(expect.objectContaining({ hasApiKey: true }));
    expect(JSON.stringify(aiWrite.body)).not.toContain(secret);

    const row = await db.get(`SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`, [
      userId,
      'settings:ai-providers',
    ]);
    expect(row.value).not.toContain(secret);
    expect(row.value).toContain('enc:');
  });

  it('reads identical values through a new JWT and reopened database connection without secret readback', async () => {
    await resetConnection?.();
    db = (await import('../../../server/src/database/Database.ts')).getDatabaseAsync
      ? await (await import('../../../server/src/database/Database.ts')).getDatabaseAsync()
      : db;

    const profileRead = await request(makeApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token()}`);
    expect(profileRead.status).toBe(200);
    expect(profileRead.body.user).toEqual(
      expect.objectContaining({
        firstName: 'Persisted',
        jobTitle: 'Transformation Lead',
        language: 'pl',
      })
    );
    const persistedProfile = await db.get(
      `SELECT first_name, job_title, language FROM users WHERE id = ?`,
      [userId]
    );
    expect(persistedProfile).toEqual(
      expect.objectContaining({
        first_name: 'Persisted',
        job_title: 'Transformation Lead',
        language: 'pl',
      })
    );

    expect((await auth('get', '/api/settings/preferences/regional')).body.preferences).toEqual(
      expect.objectContaining({ language: 'pl', timezone: 'Europe/Warsaw', currency: 'PLN' })
    );
    expect((await auth('get', '/api/settings/preferences/appearance')).body.preferences.theme).toBe(
      'dark'
    );
    expect((await auth('get', '/api/settings/preferences/notifications')).body.preferences).toEqual(
      expect.objectContaining({ email: false, digest: 'weekly' })
    );
    expect(
      (await auth('get', '/api/settings/preferences/inbox-ai')).body.preferences.threshold
    ).toBe(0.91);

    const aiRead = await auth('get', '/api/settings/preferences/ai-providers');
    expect(aiRead.status).toBe(200);
    expect(aiRead.body.providers[0]).toEqual(expect.objectContaining({ hasApiKey: true }));
    expect(aiRead.body.providers[0]).not.toHaveProperty('apiKey');
    expect(JSON.stringify(aiRead.body)).not.toContain(`sk-private-${suffix}`);
  });

  it('fails closed when a new AI secret cannot be encrypted and preserves the prior value', async () => {
    const before = await db.get(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, 'settings:ai-providers']
    );
    delete process.env.INTEGRATION_ENCRYPT_KEY;
    const response = await auth('put', '/api/settings/preferences/ai-providers').send({
      providers: [{ id: 'unsafe', name: 'Unsafe', provider: 'openai', apiKey: 'plaintext-secret' }],
    });
    process.env.INTEGRATION_ENCRYPT_KEY = encryptionKey;

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('plaintext-secret');
    const after = await db.get(`SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`, [
      userId,
      'settings:ai-providers',
    ]);
    expect(after.value).toBe(before.value);
  });

  it('rejects cross-tenant profile/language writes and invalid language values', async () => {
    const foreignWrite = await request(makeApp())
      .put(`/api/users/${userId}`)
      .set(
        'Authorization',
        `Bearer ${token({
          id: foreignUserId,
          organizationId: foreignOrgId,
          email: `foreign-${suffix}@test.local`,
        })}`
      )
      .send({ firstName: 'Hijacked', language: 'en' });
    expect(foreignWrite.status).toBe(403);

    const invalidLanguage = await request(makeApp())
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ language: '../../etc/passwd' });
    expect(invalidLanguage.status).toBe(400);

    const persisted = await db.get(`SELECT first_name, language FROM users WHERE id = ?`, [userId]);
    expect(persisted).toEqual(expect.objectContaining({ first_name: 'Persisted', language: 'pl' }));
  });
});
