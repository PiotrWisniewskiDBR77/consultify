/**
 * @vitest-environment node
 *
 * T-VIII (uwagi testera Tomka, 2026-09-13) — „Tworzenie organizacji: po
 * kliknięciu w przycisk pokazuje się błąd — kilka kliknięć spowodowało
 * powstanie kilku organizacji o tej samej nazwie" (zrzut image5: trzy
 * pozycje „TT22TT" w przełączniku organizacji).
 *
 * `POST /api/organizations` nie miał ŻADNEJ ochrony przed powtórzeniem:
 * `organizationService.createOrganization` wstawia nowy wiersz przy każdym
 * wywołaniu, więc każde kolejne kliknięcie (albo każde wciśnięcie Enter w
 * polu nazwy — `onKeyDown` w OrganizationSettings.tsx nie sprawdzał stanu
 * `creatingOrg`) fabrykowało kolejnego bliźniaka.
 *
 * Ten test pilnuje, że drugie żądanie z TĄ SAMĄ nazwą od TEGO SAMEGO
 * użytkownika nie tworzy drugiej organizacji.
 *
 * Uruchomienie:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   AI_PROVIDER_MODE=mock DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run tests/integration/organizations/tomek-viii-org-duplicates.realdb.test.ts --retry=0
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

describe.skipIf(!REAL_DB)('T-VIII — tworzenie organizacji nie dubluje (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let token = '';

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-tomek-viii-${SUFFIX}`;
  const USER = `user-tomek-viii-${SUFFIX}`;
  const NEW_ORG_NAME = `TT22TT-${SUFFIX}`;

  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'T-VIII home org']
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1, $2, $3, 'USER', 'active') ON CONFLICT (id) DO NOTHING`,
      [USER, ORG, `tomek-viii-${SUFFIX}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`${USER}-membership`, ORG, USER]
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    token = jwt.sign({ id: USER, organizationId: ORG, role: 'USER' }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });

    const { default: organizationRoutes } = await import(
      '../../../server/src/routes/organization/organizations.routes.js'
    );
    app = express();
    app.use(express.json());
    app.use('/api/organizations', organizationRoutes);
  }, 60_000);

  afterAll(async () => {
    // Probe sprząta po sobie — dane demo to twarz produktu.
    const rows = await pool.query<{ id: string }>(
      `SELECT id FROM organizations WHERE name = $1`,
      [NEW_ORG_NAME]
    );
    const ids = [...new Set([...createdOrgIds, ...rows.rows.map((r) => r.id)])];
    if (ids.length > 0) {
      await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [ids]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [ids]);
    }
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [USER]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  }, 30_000);

  const create = (name: string) =>
    request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ name });

  it('dwa kliknięcia z tą samą nazwą dają JEDNĄ organizację', async () => {
    const first = await create(NEW_ORG_NAME);
    expect(first.status, `pierwsze utworzenie musi się udać: ${JSON.stringify(first.body)}`).toBe(
      201
    );
    if (first.body?.id) createdOrgIds.push(first.body.id);

    const second = await create(NEW_ORG_NAME);
    expect(second.status, 'powtórzenie nie może utworzyć bliźniaka').not.toBe(201);
    if (second.body?.id) createdOrgIds.push(second.body.id);

    const count = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM organizations WHERE name = $1 AND created_by_user_id = $2`,
      [NEW_ORG_NAME, USER]
    );
    expect(count.rows[0].n, 'w bazie musi zostać dokładnie jedna organizacja o tej nazwie').toBe(
      '1'
    );
  }, 60_000);

  it('powtórzenie różniące się tylko wielkością liter i spacjami też jest odrzucane', async () => {
    const clash = await create(`  ${NEW_ORG_NAME.toUpperCase()}  `);
    expect(clash.status).not.toBe(201);
    if (clash.body?.id) createdOrgIds.push(clash.body.id);

    const count = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM organizations WHERE created_by_user_id = $1`,
      [USER]
    );
    expect(count.rows[0].n).toBe('1');
  }, 60_000);
});
