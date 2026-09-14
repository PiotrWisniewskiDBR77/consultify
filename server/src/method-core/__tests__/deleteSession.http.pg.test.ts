/**
 * @vitest-environment node
 *
 * Z-55 (fala D3, 2026-09-14) — DELETE /api/method/sessions/:id na PRAWDZIWYM
 * PostgreSQL.
 *
 * PREMISA ZMIERZONA na linii 08c1bb7a26 przed napisaniem tego pliku:
 *   - trasy `DELETE /sessions/:id` NIE BYŁO w server/src/routes/method-core.routes.ts
 *     (jedyny `router.delete` w pliku to `/sessions/:id/roles/:userId/:role`);
 *   - kebab „Delete" na liście Procesów wołał `DELETE /api/assessment-workflow-v2/:id`,
 *     który szuka wiersza w LEGACY tabeli `assessments`, a kanoniczne wiersze DRD
 *     biorą `id` z `method_sessions` → 404 „Assessment not found", wiersz zostawał;
 *   - `DELETE /api/assessments/:id` (assessment-hub.routes.ts:462) zwracał
 *     `{ success: true }` BEZ sprawdzenia liczby skasowanych wierszy.
 *
 * Ten plik pilnuje trzech rzeczy, których żaden istniejący test nie pilnował:
 *   403 dla obcego, 200 dla właściciela, ORAZ — to jest sedno Z-55 — że po
 *   200 sesja FAKTYCZNIE znika z `GET /sessions` i z bazy, a jej `method_events`
 *   znikają razem z nią. Sam kod stanu 200 nie jest dowodem usunięcia; dokładnie
 *   ten kształt kłamstwa naprawiamy.
 *
 * Run (z KATALOGU GŁÓWNEGO worktree):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:6458/fala_d3_z55" \
 *   npx vitest run --retry=0 server/src/method-core/__tests__/deleteSession.http.pg.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — strukturalny no-op („skipped", nigdy „passed")
 * bez RUN_DB_TESTS=1 + MOCK_DB=false + postgresowego DATABASE_URL, zgodnie
 * z konwencją `.pg.test.ts` tego repozytorium.
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

describe.skipIf(!REAL_DB)('Z-55 — DELETE /api/method/sessions/:id (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-z55-${SUFFIX}`;
  const OTHER_ORG = `org-z55-other-${SUFFIX}`;

  const OWNER = `user-z55-owner-${SUFFIX}`;
  const STRANGER = `user-z55-stranger-${SUFFIX}`; // ta sama organizacja, zero uprawnień
  const ORG_ADMIN = `user-z55-admin-${SUFFIX}`; // ACTIVE ADMIN organizacji
  const OTHER_ORG_USER = `user-z55-otherorg-${SUFFIX}`;

  const PACK_ID = `z55-test-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';
  let strangerToken = '';
  let adminToken = '';
  let otherOrgToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error(
        'Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.'
      );
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    for (const [id, name] of [
      [ORG, 'Z-55 delete test org'],
      [OTHER_ORG, 'Z-55 delete test org (other tenant)'],
    ] as const) {
      await pool.query(
        `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [id, name]
      );
    }
    for (const [id, org] of [
      [OWNER, ORG],
      [STRANGER, ORG],
      [ORG_ADMIN, ORG],
      [OTHER_ORG_USER, OTHER_ORG],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@example.test`, 'user']
      );
    }

    // Uprawnienie „OWNER/ADMIN organizacji" czyta `organization_members`
    // (MethodSessionService.isSameTenantActiveOrgOwnerOrAdmin) — nie kolumnę
    // `users.role`. STRANGER celowo NIE dostaje tu wiersza z rolą władzy.
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [`om-z55-admin-${SUFFIX}`, ORG, ORG_ADMIN]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE') ON CONFLICT DO NOTHING`,
      [`om-z55-stranger-${SUFFIX}`, ORG, STRANGER]
    );

    const { default: config } = await import('../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    ownerToken = sign(OWNER, ORG);
    strangerToken = sign(STRANGER, ORG);
    adminToken = sign(ORG_ADMIN, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'Z-55 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    // Probe sprząta po sobie — zero rekordów testowych zostawionych w bazie.
    await pool.query(`DELETE FROM method_sessions WHERE organization_id = ANY($1)`, [
      [ORG, OTHER_ORG],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [ORG, OTHER_ORG],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [OWNER, STRANGER, ORG_ADMIN, OTHER_ORG_USER],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(token: string): Promise<string> {
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `create:${randomUUID()}`)
      .send({
        module: 'assessment',
        methodPackId: PACK_ID,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
      });
    if (res.status !== 201) {
      throw new Error(`createSession failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.session.id as string;
  }

  function deleteHttp(sessionId: string, token: string) {
    return request(app)
      .delete(`/api/method/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function countSessionRows(sessionId: string): Promise<number> {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    return rows[0].n as number;
  }

  // ===========================================================================

  it('200 — właściciel sesji ją usuwa, a sesja NAPRAWDĘ znika (baza + GET /sessions)', async () => {
    const sessionId = await createSession(ownerToken);
    expect(await countSessionRows(sessionId)).toBe(1);

    const res = await deleteHttp(sessionId, ownerToken);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, id: sessionId });

    // ★ SEDNO Z-55: 200 to nie dowód. Dowodem jest nieobecność wiersza.
    expect(await countSessionRows(sessionId)).toBe(0);

    const list = await request(app)
      .get('/api/method/sessions')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect((list.body.sessions as Array<{ id: string }>).map((s) => s.id)).not.toContain(sessionId);

    // Drugie usunięcie tego samego id nie może udawać sukcesu.
    const again = await deleteHttp(sessionId, ownerToken);
    expect(again.status).toBe(404);
  });

  it('200 — ACTIVE ADMIN organizacji usuwa CUDZĄ sesję w swojej organizacji', async () => {
    const sessionId = await createSession(ownerToken);

    const res = await deleteHttp(sessionId, adminToken);
    expect(res.status).toBe(200);
    expect(await countSessionRows(sessionId)).toBe(0);
  });

  it('403 — członek tej samej organizacji bez władzy i bez własności NIE usuwa', async () => {
    const sessionId = await createSession(ownerToken);

    const res = await deleteHttp(sessionId, strangerToken);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('METHOD_SESSION_DELETE_FORBIDDEN');

    // Odmowa musi być bezskutkowa — wiersz stoi.
    expect(await countSessionRows(sessionId)).toBe(1);
  });

  it('403 — aktor z OBCEJ organizacji nie dotyka sesji (bramka dzierżawcy)', async () => {
    const sessionId = await createSession(ownerToken);

    const res = await deleteHttp(sessionId, otherOrgToken);
    expect(res.status).toBe(403);
    expect(await countSessionRows(sessionId)).toBe(1);
  });

  it('404 — nieistniejące id nigdy nie melduje sukcesu', async () => {
    const res = await deleteHttp(`ghost-${randomUUID()}`, ownerToken);
    expect(res.status).toBe(404);
  });

  it('kaskada — method_events sesji znikają razem z sesją (dziennik nie przeżywa)', async () => {
    const sessionId = await createSession(ownerToken);

    const evt = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evt:${randomUUID()}`)
      .send({
        type: 'ANSWER_DRAFTED',
        unitId: 'u1',
        level: 1,
        actorKind: 'human',
        methodPackVersion: PACK_VERSION,
        payload: { answer: 'z55' },
      });
    expect([200, 201]).toContain(evt.status);

    const before = await pool.query(
      `SELECT COUNT(*)::int AS n FROM method_events WHERE session_id = $1`,
      [sessionId]
    );
    expect(before.rows[0].n).toBeGreaterThan(0);

    expect((await deleteHttp(sessionId, ownerToken)).status).toBe(200);

    const after = await pool.query(
      `SELECT COUNT(*)::int AS n FROM method_events WHERE session_id = $1`,
      [sessionId]
    );
    expect(after.rows[0].n).toBe(0);
  });
});
