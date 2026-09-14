/**
 * @vitest-environment node
 *
 * T-III (uwagi testera Tomka, 2026-09-13) — „Profil: nie można zmienić i
 * zapisać danych (imię, telefon itp.)".
 *
 * PRZYCZYNA ZMIERZONA W KODZIE (nie zgadywana):
 *  - tabela `users` NIE MA kolumny `phone` (jest tylko w `user_contact`,
 *    `user_profiles`, `access_requests`),
 *  - `UserController.updateUser` robi `addColumnUpdate('phone', phone)`,
 *    a ten helper MILCZĄCO nic nie robi, gdy kolumny nie ma
 *    (server/src/controllers/UserController.ts),
 *  - `phone` — jako JEDYNE z pól profilu — nie miał zapisu zapasowego do
 *    `user_preferences['settings:profile-fallback']`, który obsługuje
 *    linkedinId, displayName, pronouns, statusMessage, timezone itd.,
 *  - `GET /api/auth/me` czytał `phone` wyłącznie z kolumny `users.phone`
 *    (`ucol('phone','NULL')`), więc zwracał NULL zawsze.
 *
 * Skutek widziany przez Tomka (src/components/settings/ProfileSettings.tsx):
 *  a) zapis SAMEGO telefonu -> zero pól do zapisu -> 400 „No fields to
 *     update" -> czerwony komunikat, nic nie zapisane,
 *  b) zapis imienia RAZEM z telefonem -> imię ląduje w bazie, ale kontrola
 *     potwierdzenia po `Api.getMe()` widzi rozjazd na `phone` i rzuca
 *     „Profile changes were not confirmed by the server" — ekran melduje
 *     porażkę mimo częściowego zapisu.
 *
 * Uruchomienie:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   AI_PROVIDER_MODE=mock DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run tests/integration/settings/tomek-iii-profile-save.realdb.test.ts --retry=0
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('T-III — profil zapisuje imię i telefon (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let token = '';

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-tomek-iii-${SUFFIX}`;
  const USER = `user-tomek-iii-${SUFFIX}`;
  const EMAIL = `tomek-iii-${SUFFIX}@example.test`;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'T-III test org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'USER', 'active', 'Tomasz', 'Jankowski')
       ON CONFLICT (id) DO NOTHING`,
      [USER, ORG, EMAIL]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${USER}-membership`, ORG, USER]
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    token = jwt.sign({ id: USER, organizationId: ORG, role: 'USER', email: EMAIL }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });

    const { default: userRoutes } = await import('../../../server/src/routes/user/users.routes.js');
    const { default: authRoutes } = await import('../../../server/src/routes/auth.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use('/api/auth', authRoutes);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM user_preferences WHERE user_id = $1`, [USER]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  }, 30_000);

  const me = async () =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  it('zapis SAMEGO telefonu kończy się sukcesem i telefon wraca z /api/auth/me', async () => {
    const put = await request(app)
      .put(`/api/users/${USER}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+48 601 234 567' });

    expect(put.status, `PUT nie może odrzucić zapisu samego telefonu: ${JSON.stringify(put.body)}`)
      .toBe(200);

    const after = await me();
    expect(after.status).toBe(200);
    expect(after.body.user.phone).toBe('+48 601 234 567');
  }, 60_000);

  it('zapis imienia RAZEM z telefonem potwierdza OBA pola (inaczej ekran melduje porażkę)', async () => {
    const put = await request(app)
      .put(`/api/users/${USER}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Tomek', lastName: 'Jankowski', phone: '+48 700 800 900' });

    expect(put.status).toBe(200);

    const after = await me();
    expect(after.body.user.firstName).toBe('Tomek');
    // To jest dokładnie ta kontrola, którą robi ProfileSettings.handleSave:
    // rozjazd choćby na jednym polu = „changes were not confirmed".
    expect(after.body.user.phone).toBe('+48 700 800 900');
  }, 60_000);

  it('wyczyszczenie telefonu też się utrwala', async () => {
    const put = await request(app)
      .put(`/api/users/${USER}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '' });

    expect(put.status).toBe(200);
    const after = await me();
    expect(after.body.user.phone ?? '').toBe('');
  }, 60_000);
});
