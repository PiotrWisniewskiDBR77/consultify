/**
 * P-1 / DEC-418 — reguła wejścia do Portalu Partnera po usunięciu flagi
 * `PARTNER_SELF_CONNECT_ENABLED` z kanonicznej ścieżki
 * (`server/src/services/partnerConnectionService.ts`).
 *
 * Co ten test broni (a NIE mechanizmu, który się o to opiera):
 *  1. administrator/właściciel organizacji podłącza SWOJĄ organizację bez
 *     żadnej zmiennej środowiskowej — flaga zniknęła, nie została „włączona”;
 *  2. zwykły członek tej samej organizacji NIE może tego zrobić (403) —
 *     usunięcie flagi nie otworzyło self-connect dla każdego zalogowanego;
 *  3. `GET /connection` dla konta bez powiązania partnerskiego zwraca
 *     `connected:false`, a nie 403 — ekran „connect” ma się w ogóle wyświetlić.
 *
 * Mutacja, która ma to zaczerwienić: zdjęcie `requireOrgRole('admin')` z
 * `router.use('/connect', …)` w `server/src/routes/v8/partner.routes.ts`
 * (wtedy punkt 2 przestaje być prawdą — „każdy zalogowany wchodzi”).
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import verifyToken from '../../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../../server/src/middleware/mutationGuard.middleware.js';
import {
  attachV8Context,
  requireV8OrgContext,
} from '../../../server/src/middleware/v8Auth.middleware.js';
import { v8MetricsMiddleware } from '../../../server/src/middleware/v8Metrics.middleware.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('DEC-418 partner self-connect authority (no env flag)', () => {
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `dec418-admin-${suffix}@example.test`;
  const memberEmail = `dec418-member-${suffix}@example.test`;
  const password = `Dec418-${suffix}!Pass9`;
  let app: Express;
  let pool: Pool;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    // Świadomie NIE ustawiamy PARTNER_SELF_CONNECT_ENABLED — dowodem jest to,
    // że podłączenie działa bez niej. Gdyby została po innym teście w procesie,
    // skasowanie jej tutaj czyni pomiar uczciwym.
    delete process.env.PARTNER_SELF_CONNECT_ENABLED;
    pool = new Pool({ connectionString: DATABASE_URL });
    const [{ default: authRoutes }, { default: v8PartnerRoutes }] = await Promise.all([
      import('../../../server/src/routes/auth.routes.js'),
      import('../../../server/src/routes/v8/partner.routes.js'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(
      '/api/v8/partner',
      verifyToken,
      requireV8OrgContext,
      attachV8Context,
      v8MetricsMiddleware,
      mutationAbortCanary,
      v8PartnerRoutes
    );
    app.use(
      (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ success: false, error: error.message });
      }
    );
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  const register = (email: string, companyName: string) =>
    request(app)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Dec',
        lastName: '418',
        companyName,
        acceptedLegalDocs: ['TOS', 'PRIVACY'],
      });

  it('admin łączy bez flagi, zwykły członek dostaje 403, a niepodłączony widzi connected:false', async () => {
    const adminReg = await register(adminEmail, `DEC418 Org ${suffix}`);
    expect(adminReg.status).toBe(200);
    const adminToken = String(adminReg.body.token || '');
    expect(adminToken).toBeTruthy();

    const adminOrg = await pool.query<{ organization_id: string; role: string }>(
      `SELECT om.organization_id, om.role
         FROM organization_members om
         JOIN users u ON u.id::text = om.user_id::text
        WHERE LOWER(u.email) = LOWER($1)
        LIMIT 1`,
      [adminEmail]
    );
    const organizationId = String(adminOrg.rows[0]?.organization_id || '');
    expect(organizationId).toBeTruthy();

    // 3) ekran „connect” musi się dać wyświetlić: 200 + connected:false
    const before = await request(app)
      .get('/api/v8/partner/connection')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data.connected).toBe(false);

    // 1) administrator organizacji łączy — bez żadnej zmiennej środowiskowej
    expect(process.env.PARTNER_SELF_CONNECT_ENABLED).toBeUndefined();
    const connected = await request(app)
      .post('/api/v8/partner/connect')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', `dec418-connect-${suffix}`)
      .send({ name: `DEC418 Org ${suffix}`, contactEmail: adminEmail });
    expect(connected.status).toBe(201);
    expect(connected.body.data.connected).toBe(true);

    const after = await request(app)
      .get('/api/v8/partner/connection')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.body.data.connected).toBe(true);

    // 2) zwykły członek TEJ SAMEJ organizacji nie ma prawa self-connect
    const memberReg = await register(memberEmail, `DEC418 Member Org ${suffix}`);
    expect(memberReg.status).toBe(200);
    const memberToken = String(memberReg.body.token || '');
    const memberUser = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [memberEmail]
    );
    const memberUserId = String(memberUser.rows[0]?.id || '');
    expect(memberUserId).toBeTruthy();
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', NOW())
       ON CONFLICT DO NOTHING`,
      [randomUUID(), organizationId, memberUserId]
    );

    const memberConnect = await request(app)
      .post('/api/v8/partner/connect')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('X-Organization-Id', organizationId)
      .set('Idempotency-Key', `dec418-member-connect-${suffix}`)
      .send({ name: `DEC418 Member ${suffix}`, contactEmail: memberEmail });
    expect(memberConnect.status).toBe(403);
    // Ten wiersz jest sednem: 403 musi pochodzić ze sprawdzenia ROLI, a nie
    // z przypadkowego innego odmówienia po drodze. Reguła jest broniona
    // DWUWARSTWOWO — trasą (`requireOrgRole('admin')` →
    // `RBAC_INSUFFICIENT_ROLE`) i serwisem (`connectPartnerOrganization` →
    // `PARTNER_CONNECT_AUTHORITY_REQUIRED`); zdjęcie jednej warstwy zostawia
    // drugą, więc mutacja dowodowa musi zdjąć OBIE.
    expect(String(memberConnect.body?.code || memberConnect.body?.error || '')).toMatch(
      /RBAC_INSUFFICIENT_ROLE|PARTNER_CONNECT_AUTHORITY_REQUIRED/
    );
  }, 120_000);
});
