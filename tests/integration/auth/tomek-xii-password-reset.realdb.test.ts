/**
 * @vitest-environment node
 *
 * T-XII (uwagi testera Tomka, 2026-09-13) — „System odzyskiwania hasła nie
 * działa. Po wysłaniu linku na maila, mail nie dochodzi. MOŻNA NADAL LOGOWAĆ
 * SIĘ NA STARE HASŁO."
 *
 * Ten plik mierzy WYŁĄCZNIE drugi człon zarzutu, ten, który byłby defektem
 * BEZPIECZEŃSTWA w kodzie: czy po realnie DOKOŃCZONYM resecie stare hasło
 * dalej otwiera konto. Pierwszy człon (mail nie dochodzi) jest kwestią
 * dostarczalności SMTP, nie kodu — patrz raport; `forgot-password` woła
 * emailService.send({ requireDelivery: true }) i loguje błąd, gdy provider
 * odmówi, więc „mail nie doszedł" nie może być zmierzony testem lokalnym.
 *
 * Scenariusz (realny Postgres, realne HTTP):
 *  1. konto z hasłem STARE
 *  2. POST /api/auth/forgot-password  -> token w password_resets
 *  3. POST /api/auth/reset-password   -> hasło NOWE
 *  4. POST /api/auth/login STARE      -> MUSI być odmowa (401)
 *  5. POST /api/auth/login NOWE       -> MUSI się udać
 *  6. token resetu jest jednorazowy   -> drugie użycie odmowa
 *
 * Uruchomienie:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   AI_PROVIDER_MODE=mock DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run tests/integration/auth/tomek-xii-password-reset.realdb.test.ts --retry=0
 *
 * Bez RUN_DB_TESTS=1 + MOCK_DB=false + postgresowego DATABASE_URL plik jest
 * strukturalnym no-opem („skipped", nigdy „passed").
 */
import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('T-XII — reset hasła unieważnia stare hasło (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-tomek-xii-${SUFFIX}`;
  const USER = `user-tomek-xii-${SUFFIX}`;
  const EMAIL = `tomek-xii-${SUFFIX}@example.test`;
  const OLD_PASSWORD = 'StareHaslo!2026';
  const NEW_PASSWORD = 'NoweHaslo!2026';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'T-XII test org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name)
       VALUES ($1, $2, $3, $4, 'USER', 'active', 'Tomek')
       ON CONFLICT (id) DO NOTHING`,
      [USER, ORG, EMAIL, bcrypt.hashSync(OLD_PASSWORD, 10)]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')
       ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${USER}-membership`, ORG, USER]
    );

    const { default: authRoutes } = await import('../../../server/src/routes/auth.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM password_resets WHERE user_id = $1`, [USER]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  }, 30_000);

  it('stare hasło przestaje działać po dokończonym resecie, a token jest jednorazowy', async () => {
    // 1. Stare hasło działa PRZED resetem — inaczej test 4 nie miałby wartości.
    const beforeReset = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD });
    expect(beforeReset.status).toBe(200);

    // 2. Żądanie resetu — odpowiedź zawsze „success" (anty-enumeracja).
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: EMAIL });
    expect(forgot.status).toBe(200);

    const row = await pool.query<{ token: string }>(
      `SELECT token FROM password_resets WHERE user_id = $1 ORDER BY expires_at DESC LIMIT 1`,
      [USER]
    );
    const token = row.rows[0]?.token;
    expect(token, 'forgot-password musi zapisać token resetu w password_resets').toBeTruthy();

    // 3. Dokończenie resetu.
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    // 4. STARE hasło MUSI przestać działać — sedno zarzutu Tomka.
    const withOld = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD });
    expect(withOld.status, 'stare hasło nie może otwierać konta po resecie').not.toBe(200);

    // 5. NOWE hasło działa.
    const withNew = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: NEW_PASSWORD });
    expect(withNew.status).toBe(200);

    // 6. Token resetu jednorazowy.
    const replay = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'JeszczeInne!2026' });
    expect(replay.status).not.toBe(200);
  }, 60_000);
});
