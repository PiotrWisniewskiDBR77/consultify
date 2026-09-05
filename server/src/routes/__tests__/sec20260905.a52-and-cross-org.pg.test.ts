/** @vitest-environment node
 *
 * Dyżur bezpieczeństwa 2026-09-05 — pomiar na realnym Postgresie.
 *
 * KROK 0/1/2 z instrukcji: weryfikacja, czy trzy "stare" dziury cross-org
 * (wnioski o uprawnienia, kontekst AI, wideo) i osiem tras administracyjnych
 * z A52 (`docs/program/MVP_BACKLOG_20260905.md`) nadal są otwarte na HEAD.
 *
 * Uruchamiane przez pełny ApiGateway (prawdziwe trasy, prawdziwe middleware,
 * prawdziwy Postgres — izolowany, jednorazowy kontener, NIGDY demo/staging/prod).
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe('SEC-20260905 — A52 admin routes + old cross-org holes (real Postgres)', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();

  const orgA = randomUUID();
  const orgB = randomUUID();
  const ownerA = randomUUID();
  const memberA = randomUUID();
  const ownerB = randomUUID();

  const token = (id: string, organizationId: string, role: string) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        name: 'Sec20260905',
        role,
        userRole: role,
        organizationId,
      },
      jwtSecret,
      { expiresIn: '10m' }
    );

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const { ApiGateway } = await import('../../Gateway.js');
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    for (const orgId of [orgA, orgB]) {
      await pool.query('INSERT INTO organizations (id, name) VALUES ($1, $2)', [
        orgId,
        `Sec20260905 ${orgId}`,
      ]);
    }
    for (const [orgId, userId, role] of [
      [orgA, ownerA, 'OWNER'],
      [orgA, memberA, 'MEMBER'],
      [orgB, ownerB, 'OWNER'],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (id) DO NOTHING`,
        [userId, orgId, `${userId}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [randomUUID(), orgId, userId, role]
      );
    }
  }, 120_000);

  afterAll(async () => {
    await pool.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as { closePool?: () => Promise<void> }).closePool?.();
  });

  // ── A. Stare "trzy dziury cross-org" — pomiar na HEAD ──────────────────

  describe('A. wnioski o uprawnienia (permissionRequests.routes.ts)', () => {
    it('member org A tworzy wniosek; owner org B nie widzi go na liście', async () => {
      const create = await request(app)
        .post('/api/permission-requests')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`)
        .send({ requestedPermission: 'export_data', reason: 'test' });
      expect(create.status, JSON.stringify(create.body)).toBe(201);
      const reqId = create.body.id;

      const listB = await request(app)
        .get('/api/permission-requests?status=all')
        .set('Authorization', `Bearer ${token(ownerB, orgB, 'OWNER')}`);
      expect(listB.status, JSON.stringify(listB.body)).toBe(200);
      expect((listB.body as unknown[]).some((r: any) => r.id === reqId)).toBe(false);

      const approveByForeignAdmin = await request(app)
        .put(`/api/permission-requests/${reqId}/approve`)
        .set('Authorization', `Bearer ${token(ownerB, orgB, 'OWNER')}`);
      expect(approveByForeignAdmin.status, JSON.stringify(approveByForeignAdmin.body)).toBe(404);
    });
  });

  describe('B. kontekst AI (context.routes.ts)', () => {
    it('kontekst utworzony w org A nie jest edytowalny/kasowalny przez org B', async () => {
      const create = await request(app)
        .post('/api/context')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`)
        .send({ name: 'ctx', content: 'tresc', type: 'custom' });
      expect(create.status, JSON.stringify(create.body)).toBe(201);
      const ctxId = create.body.id;

      const putForeign = await request(app)
        .put(`/api/context/${ctxId}`)
        .set('Authorization', `Bearer ${token(ownerB, orgB, 'OWNER')}`)
        .send({ name: 'przejety' });
      expect(putForeign.status, JSON.stringify(putForeign.body)).toBe(404);

      const deleteForeign = await request(app)
        .delete(`/api/context/${ctxId}`)
        .set('Authorization', `Bearer ${token(ownerB, orgB, 'OWNER')}`);
      expect(deleteForeign.status, JSON.stringify(deleteForeign.body)).toBe(404);
    });
  });

  describe('C. wideo (videos.routes.ts) — osobna rodzina defektu, NIE cross-org', () => {
    it('tabela `videos` nie istnieje w schemacie migracji -> DbPromise.all degraduje do 200 [] (nie 500, nie wyciek)', async () => {
      const res = await request(app)
        .get('/api/videos')
        .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`);
      // Dokumentacja (SCIEZKA_WYJSCIA_V2.md §A) klasyfikuje to jako
      // "schemat mieszka poza migracjami", nie jako lukę cross-org. Zmierzone
      // na realnym Postgresie: `videos` NIE ISTNIEJE (to_regclass zwraca NULL),
      // ale zapytanie idzie przez utils/DbPromise.ts `all()` z domyślnym
      // `fallback:true`, które dla `relation "videos" does not exist` cicho
      // degraduje do pustej tablicy zamiast rzucać błąd — stąd 200 z `[]`,
      // NIE 500. Funkcja jest martwa (zawsze pusta lista), ale nie jest
      // dziurą bezpieczeństwa: nie ma z czego wyciekać danych, a zapytanie
      // JEST poprawnie filtrowane po organization_id, gdyby tabela istniała.
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── B. A52 — osiem tras admina, sprawdzenie 500 vs 403 dla zwykłego usera ──

  describe('D. A52 — /api/admin/service-accounts', () => {
    it('MEMBER (nie-admin) org A dostaje 403, nie 500', async () => {
      const res = await request(app)
        .get('/api/admin/service-accounts')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    });
    it('OWNER org A dostaje 200 (nie 500)', async () => {
      const res = await request(app)
        .get('/api/admin/service-accounts')
        .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });
    it('OWNER org B nie widzi/nie może usunąć service account org A (cross-org)', async () => {
      const createRes = await request(app)
        .post('/api/admin/service-accounts')
        .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`)
        .send({ name: 'sa-a', scopes: ['read'] });
      expect(createRes.status, JSON.stringify(createRes.body)).toBe(201);
      const saId = createRes.body.data.account.id;

      const deleteForeign = await request(app)
        .delete(`/api/admin/service-accounts/${saId}`)
        .set('Authorization', `Bearer ${token(ownerB, orgB, 'OWNER')}`);
      expect(deleteForeign.status, JSON.stringify(deleteForeign.body)).toBe(404);
    });
  });

  describe('E. A52 — /api/table-platform/admin/service-accounts + /admin/sso/saml', () => {
    it('MEMBER (VIEWER-like, nie-admin) dostaje 403 na service-accounts', async () => {
      const res = await request(app)
        .get('/api/table-platform/admin/service-accounts')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    });
    it('MEMBER dostaje 403 na POST /admin/sso/saml', async () => {
      const res = await request(app)
        .post('/api/table-platform/admin/sso/saml')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`)
        .send({ entityId: 'x', ssoUrl: 'https://x', certificate: 'y' });
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    });
  });

  describe('F. A52 — /api/knowledge-graph/freshness/duplicates', () => {
    it('zwykły authenticated user dostaje 200 (nie 500) — SQLite GROUP_CONCAT jest adaptowany do STRING_AGG', async () => {
      const res = await request(app)
        .get('/api/knowledge-graph/freshness/duplicates')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(Array.isArray(res.body.duplicates)).toBe(true);
    });
  });

  describe('G. A52 — /api/report-builder/sources/upload_bundle + /definitions', () => {
    it('GET /sources/upload_bundle -> 200 dla zwykłego użytkownika', async () => {
      const res = await request(app)
        .get('/api/report-builder/sources/upload_bundle')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });
    it('GET /definitions -> 200 dla zwykłego użytkownika', async () => {
      const res = await request(app)
        .get('/api/report-builder/definitions')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    });
  });

  describe('H. A52 — /api/billing/admin/webhook-events/* (SUPERADMIN-only)', () => {
    it('MEMBER dostaje 403 na /admin/webhook-events/failed (nie 500)', async () => {
      const res = await request(app)
        .get('/api/billing/admin/webhook-events/failed')
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    });
    it('MEMBER dostaje 403 na POST /admin/webhook-events/:id/retry (nie 500)', async () => {
      const res = await request(app)
        .post(`/api/billing/admin/webhook-events/${randomUUID()}/retry`)
        .set('Authorization', `Bearer ${token(memberA, orgA, 'MEMBER')}`);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    });
  });
});
