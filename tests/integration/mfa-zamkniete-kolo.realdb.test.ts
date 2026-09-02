/**
 * MFA — zamknięte koło logowania (defekt zmierzony 2026-09-02 na stagingu).
 *
 * STAN PRZED NAPRAWĄ (zmierzony, nie zakładany):
 *   `organizations.mfa_required = 1` powodowało w AuthController.login
 *   odmowę 403 dla KAŻDEGO konta bez drugiego składnika. Jedyna ścieżka
 *   skonfigurowania drugiego składnika (`/api/mfa/setup`) stoi ZA tym
 *   logowaniem — więc warunku nie dało się spełnić. `mfa_grace_period_days`
 *   istniało i było zwracane w ciele ODMOWY jako `gracePeriodRemaining`, ale
 *   nie było żadnej daty, od której te dni można odliczyć: karencja nigdy nie
 *   działała.
 *
 * CO DOWODZI TEN PLIK (realny Postgres, realne trasy produktu przez
 * `ApiGateway.initializeRoutes`, realne żądania HTTP):
 *   (a) wymóg włączony + karencja trwa + brak składnika  → logowanie PRZECHODZI
 *       i odpowiedź niesie termin,
 *   (b) karencja wyczerpana → odmowa, ale z DROGĄ WYJŚCIA (ograniczona sesja,
 *       którą da się realnie przejść do końca),
 *   (c) drugi składnik skonfigurowany → normalne wyzwanie MFA, nie ściana,
 *   (d) próba włączenia wymogu w organizacji, gdzie nikt go nie ma → 409,
 *   (e) kontrola negatywna: bilet konfiguracyjny nie jest sesją i nie daje
 *       dostępu do cudzego konta ani do reszty API.
 *
 * URUCHOMIENIE (jednorazowy kontener tego worktree):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *   ENABLE_TEST_AUTH_BYPASS=false JWT_SECRET=... \
 *   DATABASE_URL=postgres://mfa:mfa@127.0.0.1:6412/mfa \
 *   npx vitest run tests/integration/mfa-zamkniete-kolo.realdb.test.ts --retry=0
 */
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// tests/setup.ts podmienia GLOBALNIE MFAService atrapą, która zawsze zwraca
// { enabled: false, enforced: false } — czyli dokładnie ten stan, w którym
// defekt jest niewidoczny. Bez tego odmocowania każdy test tego pliku
// zieleniłby się na atrapie zamiast na produkcie. To samo dotyczy
// auth.middleware: chcemy REALNEGO verifyToken, bo to on ma odrzucać bilet.
vi.unmock('../../server/src/services/MFAService.js');
vi.unmock('../../server/src/middleware/auth.middleware.js');

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

// vitest.config.ts przypina DB_TYPE=sqlite dla całego projektu — nadpisujemy
// PRZED asercją środowiska, tak jak każdy *.realdb.test.ts w tym repo.
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MOCK_DB = 'false';
process.env.ENABLE_TEST_AUTH_BYPASS = 'false';

const DATABASE_URL = process.env.DATABASE_URL || '';
const P = `mfa0902-${Date.now()}`;
const PASSWORD = 'Karencja!Testowa#2026';

const ORG_GRACE = `${P}-org-grace`;
const ORG_SPENT = `${P}-org-spent`;
const ORG_ENROLLED = `${P}-org-enrolled`;
const ORG_EMPTY = `${P}-org-empty`;
const ORG_OUTSIDER = `${P}-org-outsider`;

const USER_GRACE = `${P}-u-grace`;
const USER_SPENT = `${P}-u-spent`;
const USER_SPENT_E = `${P}-u-spent-e`;
const USER_ENROLLED = `${P}-u-enrolled`;
const USER_ADMIN = `${P}-u-admin`;
const USER_OUTSIDER = `${P}-u-outsider`;

const ALL_ORGS = [ORG_GRACE, ORG_SPENT, ORG_ENROLLED, ORG_EMPTY, ORG_OUTSIDER];
const ALL_USERS = [USER_GRACE, USER_SPENT, USER_SPENT_E, USER_ENROLLED, USER_ADMIN, USER_OUTSIDER];

let app: Express;
const sql = new Client({ connectionString: DATABASE_URL });

/** Ten sam algorytm co produkt (routes/mfa.routes.ts) — potrzebny, by realnie
 *  dokończyć konfigurację drugiego składnika przez HTTP. */
function totp(secret: string, window = 0): string {
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(time));
  hmac.update(buf);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code =
    (((hash[offset] & 0x7f) << 24) |
      (hash[offset + 1] << 16) |
      (hash[offset + 2] << 8) |
      hash[offset + 3]) %
    1000000;
  return code.toString().padStart(6, '0');
}

async function seedOrg(
  id: string,
  opts: { mfaRequired: boolean; graceDays: number; requiredSinceDaysAgo: number | null }
) {
  await sql.query(
    `INSERT INTO organizations(id, name, status, plan, mfa_required, mfa_grace_period_days, mfa_required_since)
     VALUES($1, $2, 'active', 'enterprise', $3, $4, $5)`,
    [
      id,
      `MFA test ${id}`,
      opts.mfaRequired ? 1 : 0,
      opts.graceDays,
      opts.requiredSinceDaysAgo === null
        ? null
        : new Date(Date.now() - opts.requiredSinceDaysAgo * 86400000).toISOString(),
    ]
  );
}

async function seedUser(id: string, orgId: string, role = 'MEMBER', createdDaysAgo = 400) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await sql.query(
    `INSERT INTO users(id, organization_id, email, password, role, status, email_verified, first_name, last_name, created_at)
     VALUES($1, $2, $3, $4, $5, 'active', 1, 'Test', 'User', $6)`,
    [
      id,
      orgId,
      `${id}@test.invalid`,
      hash,
      role,
      new Date(Date.now() - createdDaysAgo * 86400000).toISOString(),
    ]
  );
  await sql.query(
    `INSERT INTO organization_members(id, organization_id, user_id, role, status)
     VALUES($1, $2, $3, $4, 'ACTIVE')`,
    [`${id}-mem`, orgId, id, role === 'MEMBER' ? 'MEMBER' : role]
  );
}

async function enrollFactor(userId: string): Promise<string> {
  const secret = crypto.randomBytes(20).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  await sql.query(
    `INSERT INTO user_mfa(user_id, secret, enabled, method, backup_codes_count)
     VALUES($1, $2, true, 'totp', 10)
     ON CONFLICT(user_id) DO UPDATE SET secret = EXCLUDED.secret, enabled = true`,
    [userId, secret]
  );
  return secret;
}

const login = (userId: string) =>
  request(app)
    .post('/api/auth/login')
    .send({ email: `${userId}@test.invalid`, password: PASSWORD });

beforeAll(async () => {
  const proof = await assertRealPostgresTestEnvironment();
  expect(proof.host).toBe('127.0.0.1');
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
  await sql.connect();

  const { apiGateway } = await import('../../server/src/Gateway.js');
  app = express();
  app.use(express.json());
  apiGateway.initializeRoutes(app);

  // (a) wymóg włączony 1 dzień temu, karencja 7 dni → karencja TRWA
  await seedOrg(ORG_GRACE, { mfaRequired: true, graceDays: 7, requiredSinceDaysAgo: 1 });
  await seedUser(USER_GRACE, ORG_GRACE);

  // (b) wymóg włączony 30 dni temu, karencja 7 dni → karencja WYCZERPANA
  await seedOrg(ORG_SPENT, { mfaRequired: true, graceDays: 7, requiredSinceDaysAgo: 30 });
  await seedUser(USER_SPENT, ORG_SPENT);
  // Osobne konto dla kontroli negatywnej — żeby (b) mogło je skonfigurować
  // do końca, a (e) nadal miało świeży bilet do nadużycia.
  await seedUser(USER_SPENT_E, ORG_SPENT);

  // (c) wymóg włączony, karencja wyczerpana, ale konto MA drugi składnik
  await seedOrg(ORG_ENROLLED, { mfaRequired: true, graceDays: 7, requiredSinceDaysAgo: 30 });
  await seedUser(USER_ENROLLED, ORG_ENROLLED);
  await enrollFactor(USER_ENROLLED);

  // (d) organizacja BEZ wymogu i bez ani jednego skonfigurowanego składnika
  await seedOrg(ORG_EMPTY, { mfaRequired: false, graceDays: 7, requiredSinceDaysAgo: null });
  await seedUser(USER_ADMIN, ORG_EMPTY, 'OWNER');

  // (e) obcy użytkownik z innej organizacji, bez wymogu MFA
  await seedOrg(ORG_OUTSIDER, { mfaRequired: false, graceDays: 7, requiredSinceDaysAgo: null });
  await seedUser(USER_OUTSIDER, ORG_OUTSIDER);
}, 120_000);

afterAll(async () => {
  // Dane demo = twarz produktu: sprzątamy po sobie.
  await sql.query(`DELETE FROM user_mfa WHERE user_id = ANY($1)`, [ALL_USERS]);
  await sql.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [ALL_ORGS]);
  await sql.query(`DELETE FROM refresh_tokens WHERE user_id = ANY($1)`, [ALL_USERS]);
  await sql.query(`DELETE FROM audit_logs WHERE user_id = ANY($1)`, [ALL_USERS]);
  await sql.query(`DELETE FROM users WHERE id = ANY($1)`, [ALL_USERS]);
  await sql.query(`DELETE FROM organizations WHERE id = ANY($1)`, [ALL_ORGS]);
  await sql.end();
});

describe('MFA zamknięte koło — logowanie', () => {
  it('(a) karencja trwa: logowanie PRZECHODZI i niesie jawny termin', async () => {
    const res = await login(USER_GRACE);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.mfaEnrollment).toBeTruthy();
    expect(res.body.mfaEnrollment.required).toBe(true);
    expect(res.body.mfaEnrollment.daysRemaining).toBeGreaterThan(0);
    expect(res.body.mfaEnrollment.daysRemaining).toBeLessThanOrEqual(7);
    expect(String(res.body.mfaEnrollment.deadline)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('(b) karencja wyczerpana: odmowa, ale z DZIAŁAJĄCĄ drogą wyjścia', async () => {
    const denied = await login(USER_SPENT);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('MFA_SETUP_REQUIRED');
    expect(denied.body.gracePeriodRemaining).toBe(0);
    const ticket = denied.body.mfaSetupToken;
    expect(typeof ticket).toBe('string');
    expect(ticket.length).toBeGreaterThan(20);

    // Droga wyjścia musi być PRZECHODNIA do końca, nie samą obietnicą.
    const setup = await request(app)
      .post('/api/auth/mfa-enrollment/setup')
      .set('Authorization', `Bearer ${ticket}`)
      .send({});
    expect(setup.status).toBe(200);
    expect(typeof setup.body.secret).toBe('string');

    const done = await request(app)
      .post('/api/auth/mfa-enrollment/verify-setup')
      .set('Authorization', `Bearer ${ticket}`)
      .send({ token: totp(setup.body.secret) });
    expect(done.status).toBe(200);
    expect(done.body.success).toBe(true);

    // Po skonfigurowaniu składnika logowanie nie jest już ścianą.
    const after = await login(USER_SPENT);
    expect(after.status).toBe(200);
    expect(after.body.mfaRequired).toBe(true);
    expect(after.body.mfaChallenge).toBeTruthy();
  });

  it('(c) drugi składnik skonfigurowany: normalne wyzwanie MFA, nie 403', async () => {
    const res = await login(USER_ENROLLED);
    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.mfaChallenge).toBeTruthy();
    expect(res.body.mfaSetupRequired).toBeUndefined();
  });
});

describe('MFA zamknięte koło — włączanie wymogu', () => {
  async function adminToken(): Promise<string> {
    const res = await login(USER_ADMIN);
    expect(res.status).toBe(200);
    return res.body.token as string;
  }

  it('(d) włączenie wymogu w organizacji, gdzie NIKT go nie ma, jest zablokowane', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/admin/security')
      .set('Authorization', `Bearer ${token}`)
      .send({ mfaRequired: true, mfaGracePeriodDays: 7 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MFA_ENFORCE_NO_ENROLLED_ACCOUNTS');

    const row = await sql.query(`SELECT mfa_required FROM organizations WHERE id = $1`, [ORG_EMPTY]);
    expect(Number(row.rows[0].mfa_required)).toBe(0);
  });

  it('(d2) ta sama blokada na bliźniaczej trasie PUT /api/security/settings', async () => {
    const token = await adminToken();
    const res = await request(app)
      .put('/api/security/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ require2fa: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MFA_ENFORCE_NO_ENROLLED_ACCOUNTS');
  });

  it('(d3) po skonfigurowaniu składnika przez jedno konto wymóg da się włączyć i stempluje kotwicę', async () => {
    // Token bierzemy PRZED konfiguracją: potem logowanie tego konta zwraca
    // wyzwanie MFA zamiast tokenu, co jest poprawnym zachowaniem produktu.
    const token = await adminToken();
    await enrollFactor(USER_ADMIN);
    const res = await request(app)
      .put('/api/admin/security')
      .set('Authorization', `Bearer ${token}`)
      .send({ mfaRequired: true, mfaGracePeriodDays: 7 });
    expect(res.status).toBe(200);
    const row = await sql.query(
      `SELECT mfa_required, mfa_required_since FROM organizations WHERE id = $1`,
      [ORG_EMPTY]
    );
    expect(Number(row.rows[0].mfa_required)).toBe(1);
    expect(row.rows[0].mfa_required_since).not.toBeNull();
  });
});

describe('MFA zamknięte koło — kontrola negatywna', () => {
  it('(e) bilet konfiguracyjny NIE jest sesją i nie otwiera reszty API', async () => {
    const denied = await login(USER_SPENT_E);
    expect(denied.status).toBe(403);
    const ticket = denied.body.mfaSetupToken as string;
    expect(typeof ticket).toBe('string');

    // Zwykłe trasy produktu muszą odrzucić bilet.
    const asSession = await request(app)
      .get('/api/mfa/status')
      .set('Authorization', `Bearer ${ticket}`);
    expect(asSession.status).toBe(401);
    expect(asSession.body.code).toBe('SCOPED_TOKEN_NOT_A_SESSION');

    const orgData = await request(app)
      .get('/api/admin/people')
      .set('Authorization', `Bearer ${ticket}`);
    expect(orgData.status).toBe(401);
  });

  it('(e2) obcy nie dostaje cudzej ścieżki konfiguracyjnej', async () => {
    // Sesja obcego użytkownika nie otwiera mountu konfiguracyjnego...
    const outsider = await login(USER_OUTSIDER);
    expect(outsider.status).toBe(200);
    const sessionToken = outsider.body.token as string;
    const withSession = await request(app)
      .post('/api/auth/mfa-enrollment/setup')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({});
    expect(withSession.status).toBe(401);

    // ...a bilet innej osoby działa WYŁĄCZNIE na jej własnym koncie: tożsamość
    // pochodzi z podpisu, nie z ciała żądania.
    const denied = await login(USER_SPENT_E);
    const ticket = denied.body.mfaSetupToken as string;
    const hijack = await request(app)
      .post('/api/auth/mfa-enrollment/setup')
      .set('Authorization', `Bearer ${ticket}`)
      .send({ userId: USER_OUTSIDER, user_id: USER_OUTSIDER });
    expect(hijack.status).toBe(200);
    const victim = await sql.query(`SELECT secret FROM user_mfa WHERE user_id = $1`, [
      USER_OUTSIDER,
    ]);
    expect(victim.rowCount).toBe(0);

    // Brak biletu = brak wejścia.
    const anonymous = await request(app).post('/api/auth/mfa-enrollment/setup').send({});
    expect(anonymous.status).toBe(401);
  });
});
