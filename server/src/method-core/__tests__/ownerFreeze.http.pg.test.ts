/**
 * @vitest-environment node
 *
 * MVP-OWNER-FREEZE — właściciel ORGANIZACJI może zamrozić ocenę, przeciw
 * REALNEMU Postgresowi, po HTTP (dodane 2026-09-05).
 *
 * DLACZEGO TEN PLIK ISTNIEJE. Odbiór na żywo 05.09
 * (`evidence/odbior-zywo-20260905/RUNDA2_RAPORT.md`, „blokady strukturalne"):
 * zamrożenie sesji wymaga procesowej roli `approver`, a ta rola NIE MA w
 * całej aplikacji żadnego ekranu, którym dałoby się ją komukolwiek nadać —
 * `POST /sessions/:id/roles` istnieje, ale nie ma wołacza w `src/`, a
 * samo-nadanie `approver` jest (słusznie) odmawiane
 * (`self_elevation_forbidden`). W organizacji z jednym kontem zamrożenie
 * było więc strukturalnie nieosiągalne, a razem z nim Output, raport z oceny
 * i prezentacja z oceny.
 *
 * Naprawa: właściciel ORGANIZACJI (wiersz ACTIVE/OWNER w
 * `organization_members` — NIE procesowa rola `owner` sesji, którą twórca
 * sesji dostaje automatycznie) jest approverem ostatniej instancji, wyłącznie
 * dla przejścia do `frozen`. Ten plik mierzy DOKŁADNIE granice tej furtki:
 *
 *  1. [ALLOW]  org-OWNER bez roli `approver` zamraża — 200, `frozen`, Output
 *              powstaje, a w `method_approvals` ląduje ślad „kto zamroził".
 *  2. [DENY]   org-MEMBER (aktywny, z rolami roboczymi) — 403
 *              `missing_permission` / `requiredRole: approver`, sesja
 *              zostaje w `in_review`, zero wierszy decyzji.
 *  3. [DENY]   odebrane członkostwo (status REVOKED, rola OWNER) — 403.
 *              Status, nie rola, decyduje.
 *  4. [ZAKRES] furtka dotyczy WYŁĄCZNIE celu `frozen`: org-OWNER bez żadnej
 *              roli procesowej nie przeprowadzi `frozen -> closed`
 *              (wymaga procesowej roli `owner`).
 *  5. [BEZ DUBLA] prawdziwy `approver` zamrażający przez `/freeze` NIE
 *              zostawia dodatkowego wiersza w `method_approvals` — ślad
 *              dopisujemy tylko wtedy, gdy ktoś wystąpił w zastępstwie
 *              nieobsadzonej roli.
 *
 * Wszystkie role PROCESOWE nadawane są po HTTP. Jedyny surowy SQL to fixtura
 * `organizations`/`users`/`organization_members` — ta aplikacja nie ma
 * endpointu członkostwa w tym routerze, a to jest stan świata, nie zachowanie
 * pod testem (ta sama konwencja co `roiGovernedVisibility20.realdb.test.ts`).
 *
 * Uruchomienie (z katalogu roboczego gałęzi):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://.../<baza>" \
 *   npx vitest run server/src/method-core/__tests__/ownerFreeze.http.pg.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — bez RUN_DB_TESTS=1 + MOCK_DB=false +
 * postgresowego DATABASE_URL plik jest strukturalnym no-opem („skipped",
 * nigdy „passed"). Bieg bez bazy NIE JEST dowodem.
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

describe.skipIf(!REAL_DB)('MVP-OWNER-FREEZE — org OWNER może zamrozić ocenę (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-ownerfreeze-${SUFFIX}`;

  /** Twórca sesji: procesowa rola `owner`, ale w organizacji tylko MEMBER —
   * dokładnie ten aktor, który do 05.09 nie mógł zamrozić NICZEGO. */
  const OPERATOR = `user-ownerfreeze-operator-${SUFFIX}`;
  /** Właściciel organizacji (ACTIVE/OWNER), BEZ roli procesowej `approver`. */
  const ORG_OWNER = `user-ownerfreeze-orgowner-${SUFFIX}`;
  /** Właściciel organizacji z ODEBRANYM członkostwem. */
  const REVOKED_OWNER = `user-ownerfreeze-revoked-${SUFFIX}`;
  /** Prawdziwy approver — ścieżka referencyjna, sprawdza brak dubla śladu. */
  const APPROVER = `user-ownerfreeze-approver-${SUFFIX}`;

  const PACK_ID = `ownerfreeze-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let operatorToken = '';
  let orgOwnerToken = '';
  let revokedOwnerToken = '';
  let approverToken = '';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG, 'MVP-OWNER-FREEZE test org']
    );
    for (const id of [OPERATOR, ORG_OWNER, REVOKED_OWNER, APPROVER]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, ORG, `${id}@example.test`, 'user']
      );
    }
    const members: ReadonlyArray<readonly [string, string, string]> = [
      [OPERATOR, 'MEMBER', 'ACTIVE'],
      [ORG_OWNER, 'OWNER', 'ACTIVE'],
      [REVOKED_OWNER, 'OWNER', 'REVOKED'],
      [APPROVER, 'MEMBER', 'ACTIVE'],
    ];
    for (const [userId, role, status] of members) {
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
        [`${userId}-membership`, ORG, userId, role, status]
      );
    }

    const { default: config } = await import('../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    operatorToken = sign(OPERATOR, ORG);
    orgOwnerToken = sign(ORG_OWNER, ORG);
    revokedOwnerToken = sign(REVOKED_OWNER, ORG);
    approverToken = sign(APPROVER, ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'MVP-OWNER-FREEZE test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  }, 60_000);

  afterAll(async () => {
    await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [OPERATOR, ORG_OWNER, REVOKED_OWNER, APPROVER],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  }, 30_000);

  // -- helpers (role PROCESOWE wyłącznie po HTTP) ----------------------------

  async function createSession(): Promise<string> {
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${operatorToken}`)
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

  async function assignRole(sessionId: string, userId: string, role: string) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ userId, role });
  }

  async function addEvidenceAndAnswer(sessionId: string, unitId = '1A'): Promise<void> {
    for (const body of [
      {
        type: 'EVIDENCE_ATTACHED',
        unitId,
        payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      },
      {
        type: 'ANSWER_CONFIRMED',
        unitId,
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      },
    ]) {
      const res = await request(app)
        .post(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('Idempotency-Key', `event:${randomUUID()}`)
        .send(body);
      if (res.status !== 201) {
        throw new Error(`addEvidenceAndAnswer(${body.type}) failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
  }

  /** create -> (lead_assessor) -> prepared -> active -> in_review -> dowód+odpowiedź. */
  async function readyForFreeze(): Promise<string> {
    const sessionId = await createSession();
    const grant = await assignRole(sessionId, OPERATOR, 'lead_assessor');
    if (grant.status !== 201 && grant.status !== 200) {
      throw new Error(`readyForFreeze: lead_assessor failed: ${grant.status} ${JSON.stringify(grant.body)}`);
    }
    for (const to of ['prepared', 'active', 'in_review']) {
      const res = await request(app)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
      if (res.status !== 200) {
        throw new Error(`readyForFreeze: -> ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
    await addEvidenceAndAnswer(sessionId);
    return sessionId;
  }

  function freezeAs(sessionId: string, token: string) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
  }

  async function rolesOf(sessionId: string, userId: string): Promise<string[]> {
    const rows = await pool.query<{ role: string }>(
      `SELECT role FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    return rows.rows.map((r) => r.role);
  }

  // ===========================================================================

  it('1. [ALLOW] właściciel organizacji BEZ roli approver zamraża sesję i zostawia ślad kto zamroził', async () => {
    const sessionId = await readyForFreeze();

    // Dowód, że furtka nie jest przypadkiem „ma rolę approvera": nie ma jej.
    expect(await rolesOf(sessionId, ORG_OWNER)).toEqual([]);

    const res = await freezeAs(sessionId, orgOwnerToken);
    expect(res.status).toBe(200);
    expect(res.body.session.state).toBe('frozen');
    expect(res.body.output?.id).toBeTruthy();

    const state = await pool.query<{ state: string; frozen_snapshot_id: string | null }>(
      `SELECT state, frozen_snapshot_id FROM method_sessions WHERE id = $1`,
      [sessionId]
    );
    expect(state.rows[0].state).toBe('frozen');
    expect(state.rows[0].frozen_snapshot_id).toBeTruthy();

    // Ślad „kto zamroził" — ten sam, który raport z oceny czyta jako
    // „kto zatwierdził" (GET /sessions/:id/approvals).
    const approvals = await pool.query<{ actor_user_id: string; decision: string; comment: string | null }>(
      `SELECT actor_user_id, decision, comment FROM method_approvals WHERE session_id = $1`,
      [sessionId]
    );
    expect(approvals.rows).toHaveLength(1);
    expect(approvals.rows[0].actor_user_id).toBe(ORG_OWNER);
    expect(approvals.rows[0].decision).toBe('approved');
    expect(approvals.rows[0].comment).toContain('właściciela organizacji');

    const trail = await request(app)
      .get(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(trail.status).toBe(200);
    expect(trail.body.approvals).toHaveLength(1);
    expect(trail.body.approvals[0].actorUserId).toBe(ORG_OWNER);
  }, 60_000);

  it('2. [DENY] zwykły członek organizacji (twórca sesji, role robocze) nadal nie zamrozi', async () => {
    const sessionId = await readyForFreeze();

    const res = await freezeAs(sessionId, operatorToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');
    expect(res.body.requiredRole).toBe('approver');

    const state = await pool.query<{ state: string; frozen_snapshot_id: string | null }>(
      `SELECT state, frozen_snapshot_id FROM method_sessions WHERE id = $1`,
      [sessionId]
    );
    expect(state.rows[0].state).toBe('in_review');
    expect(state.rows[0].frozen_snapshot_id).toBeNull();

    const approvals = await pool.query(`SELECT 1 FROM method_approvals WHERE session_id = $1`, [sessionId]);
    expect(approvals.rows).toHaveLength(0);
    const snapshots = await pool.query(`SELECT 1 FROM method_snapshots WHERE session_id = $1`, [sessionId]);
    expect(snapshots.rows).toHaveLength(0);
  }, 60_000);

  it('3. [DENY] właściciel z ODEBRANYM członkostwem (status REVOKED) nie zamrozi — decyduje status, nie rola', async () => {
    const sessionId = await readyForFreeze();

    const res = await freezeAs(sessionId, revokedOwnerToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');

    const state = await pool.query<{ state: string }>(
      `SELECT state FROM method_sessions WHERE id = $1`,
      [sessionId]
    );
    expect(state.rows[0].state).toBe('in_review');
  }, 60_000);

  it('4. [ZAKRES] furtka działa TYLKO dla frozen — org OWNER nie zamknie sesji (closed wymaga procesowej roli owner)', async () => {
    const sessionId = await readyForFreeze();
    const frozen = await freezeAs(sessionId, orgOwnerToken);
    expect(frozen.status).toBe(200);

    const close = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .set('Idempotency-Key', `transition:closed:${randomUUID()}`)
      .send({ to: 'closed' });
    expect(close.status).toBe(403);
    expect(close.body.error).toBe('missing_permission');
    expect(close.body.requiredRole).toBe('owner');

    const state = await pool.query<{ state: string }>(
      `SELECT state FROM method_sessions WHERE id = $1`,
      [sessionId]
    );
    expect(state.rows[0].state).toBe('frozen');
  }, 60_000);

  it('5. [BEZ DUBLA] prawdziwy approver zamrażający przez /freeze nie zostawia dodatkowego wiersza decyzji', async () => {
    const sessionId = await readyForFreeze();
    const grant = await assignRole(sessionId, APPROVER, 'approver');
    expect([200, 201]).toContain(grant.status);

    const res = await freezeAs(sessionId, approverToken);
    expect(res.status).toBe(200);
    expect(res.body.session.state).toBe('frozen');

    const approvals = await pool.query(`SELECT 1 FROM method_approvals WHERE session_id = $1`, [sessionId]);
    expect(approvals.rows).toHaveLength(0);
  }, 60_000);
});
