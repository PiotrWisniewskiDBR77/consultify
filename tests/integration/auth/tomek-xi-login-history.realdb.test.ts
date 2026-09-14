/**
 * @vitest-environment node
 *
 * T-XI (uwagi testera Tomka, 2026-09-13) — „Uwierzytelnienie i dostęp:
 * po przelogowaniu nie pokazuje historii logowania" (zrzut image8:
 * „Brak dostępnej historii logowania" obok czterech aktywnych sesji).
 *
 * PRZYCZYNA ZMIERZONA: `login_history` miała komplet CZYTELNIKÓW
 * (GET /api/auth/login-history, przegląd bezpieczeństwa, panel superadmina,
 * behaviorIntelligenceService, transactionReadinessService) i ZERO pisarzy w
 * realnym przepływie logowania — jedyny INSERT siedzi w
 * `POST /api/auth/login-history`, którego nikt nie woła (grep po `src/` i
 * `server/src/`: brak wołacza). Tabela była pusta zawsze.
 *
 * Test mierzy realne logowanie po HTTP i pilnuje OBU kompletów kolumn:
 *  - `status` + `created_at` (ekran historii, panel superadmina),
 *  - `success` + `login_at` (serwisy analityczne).
 * Zapis tylko jednej pary zostawiłby połowę powierzchni martwą.
 *
 * Uruchomienie:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   AI_PROVIDER_MODE=mock DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run tests/integration/auth/tomek-xi-login-history.realdb.test.ts --retry=0
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

describe.skipIf(!REAL_DB)('T-XI — logowanie zapisuje historię logowania (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-tomek-xi-${SUFFIX}`;
  const USER = `user-tomek-xi-${SUFFIX}`;
  const EMAIL = `tomek-xi-${SUFFIX}@example.test`;
  const PASSWORD = 'Haslo!Tomka2026';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'T-XI test org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name)
       VALUES ($1, $2, $3, $4, 'USER', 'active', 'Tomek') ON CONFLICT (id) DO NOTHING`,
      [USER, ORG, EMAIL, bcrypt.hashSync(PASSWORD, 10)]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${USER}-membership`, ORG, USER]
    );

    const { default: authRoutes } = await import('../../../server/src/routes/auth.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM login_history WHERE user_id = $1`, [USER]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  }, 30_000);

  const historyRows = async () =>
    (
      await pool.query(
        `SELECT status, success, created_at, login_at, organization_id, email, user_agent, failure_reason
           FROM login_history WHERE user_id = $1 ORDER BY created_at ASC`,
        [USER]
      )
    ).rows;

  it('udane logowanie zostawia wiersz w login_history — w OBU kompletach kolumn', async () => {
    expect(await historyRows(), 'stan wyjściowy: pusto').toHaveLength(0);

    const login = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'TomekTest/1.0')
      .send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);

    // Zapis jest fail-soft i puszczony bez await w kontrolerze — dajemy mu
    // chwilę, zamiast zgadywać kolejność mikrozadań.
    let rows = await historyRows();
    for (let i = 0; i < 20 && rows.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      rows = await historyRows();
    }

    expect(rows, 'realny przepływ logowania MUSI zapisać historię').toHaveLength(1);
    const row = rows[0];
    // Komplet A — ekran „Historia logowania" / panel superadmina.
    expect(row.status).toBe('success');
    expect(row.created_at).toBeTruthy();
    // Komplet B — serwisy analityczne (behaviorIntelligence, transactionReadiness).
    expect(row.success).toBe(true);
    expect(row.login_at).toBeTruthy();
    // Kontekst potrzebny czytelnikom org-scope.
    expect(row.organization_id).toBe(ORG);
    expect(row.email).toBe(EMAIL);
    expect(row.user_agent).toContain('TomekTest');
  }, 60_000);

  it('nieudane logowanie też zostaje w historii, ze statusem failed', async () => {
    const before = (await historyRows()).length;

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'ZupelnieZleHaslo!1' });
    expect(bad.status).not.toBe(200);

    let rows = await historyRows();
    for (let i = 0; i < 20 && rows.length === before; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      rows = await historyRows();
    }

    expect(rows.length).toBe(before + 1);
    const row = rows[rows.length - 1];
    expect(row.status).toBe('failed');
    expect(row.success).toBe(false);
    expect(row.failure_reason).toBe('invalid_password');
  }, 60_000);

  it('GET /api/auth/login-history oddaje zapisany wiersz temu samemu użytkownikowi', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    const { default: loginHistoryRoutes } = await import(
      '../../../server/src/routes/user/loginHistory.routes.js'
    );
    const historyApp = express();
    historyApp.use(express.json());
    historyApp.use('/api/auth/login-history', loginHistoryRoutes);

    let res = await request(historyApp)
      .get('/api/auth/login-history')
      .set('Authorization', `Bearer ${token}`);
    for (let i = 0; i < 20 && (res.body?.data?.length ?? 0) === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      res = await request(historyApp)
        .get('/api/auth/login-history')
        .set('Authorization', `Bearer ${token}`);
    }

    expect(res.status).toBe(200);
    expect(
      res.body?.data?.length ?? 0,
      'ekran „Uwierzytelnianie i dostęp" nie może już pokazywać pustej historii'
    ).toBeGreaterThan(0);
  }, 60_000);
});
