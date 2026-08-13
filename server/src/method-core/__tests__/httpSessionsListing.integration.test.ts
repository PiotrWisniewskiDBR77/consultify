/**
 * @vitest-environment node
 *
 * Shared Method Kernel — `GET /api/method/sessions`, real PostgreSQL.
 *
 * S7 / Task A: closes the P0 gap "after a restart the user could resume a
 * session ONLY by a known id (`GET /sessions/:id`), with no entry point that
 * lists 'my sessions'". Mirrors the proven pattern in
 * `http.integration.test.ts` (real Postgres at DATABASE_URL, real
 * `verifyToken` middleware verifying real signed JWTs against seeded
 * `users`/`organizations` rows — no mocks).
 *
 * Run (from the worktree ROOT):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_s7" \
 *   npx vitest run server/src/method-core/__tests__/httpSessionsListing.integration.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — structurally a no-op (every case reports
 * "skipped") unless RUN_DB_TESTS=1 and a postgres DATABASE_URL are present.
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

describe.skipIf(!REAL_DB)('GET /api/method/sessions — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s7-list-${SUFFIX}`;
  const OTHER_ORG = `org-s7-list-other-${SUFFIX}`;
  const OWNER = `user-s7-owner-${SUFFIX}`;
  const OWNER2 = `user-s7-owner2-${SUFFIX}`;
  const APPROVER = `user-s7-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s7-otherorg-${SUFFIX}`;

  const PACK_A = `s7-pack-a-${SUFFIX}`;
  const PACK_B = `s7-pack-b-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';
  let owner2Token = '';
  let approverToken = '';
  let otherOrgToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'S7 sessions-list test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S7 sessions-list test org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
      [OWNER2, ORG],
      [APPROVER, ORG],
      [OTHER_ORG_USER, OTHER_ORG],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@example.test`, 'user']
      );
    }

    const { default: config } = await import('../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    ownerToken = sign(OWNER, ORG);
    owner2Token = sign(OWNER2, ORG);
    approverToken = sign(APPROVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_A,
      version: PACK_VERSION,
      name: 'S7 test pack A (released)',
      readiness: 'released',
    });
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_B,
      version: PACK_VERSION,
      name: 'S7 test pack B (released)',
      readiness: 'released',
    });
    await methodPackRegistry.register({
      organizationId: OTHER_ORG,
      packId: PACK_A,
      version: PACK_VERSION,
      name: 'S7 test pack A (other org, released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, OWNER2, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(
    token: string,
    overrides: Record<string, unknown> = {}
  ): Promise<{ status: number; body: Record<string, any> }> {
    const idemKey = `create:${randomUUID()}`;
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({
        module: 'assessment',
        methodPackId: PACK_A,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
        ...overrides,
      });
    return { status: res.status, body: res.body };
  }

  async function listSessions(token: string, query: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    const res = await request(app)
      .get(`/api/method/sessions${qs ? `?${qs}` : ''}`)
      .set('Authorization', `Bearer ${token}`);
    return res;
  }

  // ---------------------------------------------------------------------------
  // 1. tenant isolation — deny-path
  // ---------------------------------------------------------------------------
  it('1. lists only sessions belonging to the caller organization — a different tenant never sees them (deny-path)', async () => {
    const created = await createSession(ownerToken);
    expect(created.status).toBe(201);
    const sessionId = created.body.session.id;

    const ownRes = await listSessions(ownerToken);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.sessions.some((s: any) => s.id === sessionId)).toBe(true);

    const otherRes = await listSessions(otherOrgToken);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.sessions.some((s: any) => s.id === sessionId)).toBe(false);
    // Every session the other org sees is genuinely theirs — no leakage,
    // not even a same-shape row with someone else's data.
    for (const s of otherRes.body.sessions) {
      expect(s.organizationId).toBe(OTHER_ORG);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. filter: methodPackId
  // ---------------------------------------------------------------------------
  it('2. filters by methodPackId', async () => {
    const a = await createSession(ownerToken, { methodPackId: PACK_A });
    const b = await createSession(ownerToken, { methodPackId: PACK_B });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const res = await listSessions(ownerToken, { methodPackId: PACK_B, limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.sessions.some((s: any) => s.id === b.body.session.id)).toBe(true);
    expect(res.body.sessions.some((s: any) => s.id === a.body.session.id)).toBe(false);
    for (const s of res.body.sessions) {
      expect(s.methodPackId).toBe(PACK_B);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. filter: state
  // ---------------------------------------------------------------------------
  it('3. filters by state', async () => {
    const draftSession = await createSession(ownerToken);
    const toPrepare = await createSession(ownerToken);
    await request(app)
      .post(`/api/method/sessions/${toPrepare.body.session.id}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `transition:${randomUUID()}`)
      .send({ to: 'prepared' });

    const draftRes = await listSessions(ownerToken, { state: 'draft', limit: 100 });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.sessions.some((s: any) => s.id === draftSession.body.session.id)).toBe(true);
    expect(draftRes.body.sessions.some((s: any) => s.id === toPrepare.body.session.id)).toBe(false);
    for (const s of draftRes.body.sessions) expect(s.state).toBe('draft');

    const preparedRes = await listSessions(ownerToken, { state: 'prepared', limit: 100 });
    expect(preparedRes.status).toBe(200);
    expect(preparedRes.body.sessions.some((s: any) => s.id === toPrepare.body.session.id)).toBe(true);
    expect(preparedRes.body.sessions.some((s: any) => s.id === draftSession.body.session.id)).toBe(false);
  });

  it('3b. an unknown state value is refused with 400, not silently ignored', async () => {
    const res = await listSessions(ownerToken, { state: 'not_a_real_state' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('METHOD_SESSION_STATES');
  });

  // ---------------------------------------------------------------------------
  // 4. filter: projectId
  // ---------------------------------------------------------------------------
  it('4. filters by projectId', async () => {
    const projectId = `proj-${randomUUID()}`;
    const withProject = await createSession(ownerToken, { projectId });
    const withoutProject = await createSession(ownerToken, { projectId: null });

    const res = await listSessions(ownerToken, { projectId, limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.sessions.some((s: any) => s.id === withProject.body.session.id)).toBe(true);
    expect(res.body.sessions.some((s: any) => s.id === withoutProject.body.session.id)).toBe(false);
    for (const s of res.body.sessions) expect(s.projectId).toBe(projectId);
  });

  // ---------------------------------------------------------------------------
  // 5. filter: ownerUserId
  // ---------------------------------------------------------------------------
  it('5. filters by ownerUserId', async () => {
    const byOwner = await createSession(ownerToken);
    const byOwner2 = await createSession(owner2Token);

    const res = await listSessions(ownerToken, { ownerUserId: OWNER2, limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.sessions.some((s: any) => s.id === byOwner2.body.session.id)).toBe(true);
    expect(res.body.sessions.some((s: any) => s.id === byOwner.body.session.id)).toBe(false);
    for (const s of res.body.sessions) expect(s.ownerUserId).toBe(OWNER2);
  });

  // ---------------------------------------------------------------------------
  // 6. pagination — slicing + total
  // ---------------------------------------------------------------------------
  it('6. paginates with limit/offset and reports the TOTAL of the filtered set, not just the page', async () => {
    const projectId = `proj-page-${randomUUID()}`;
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await createSession(ownerToken, { projectId });
      ids.push(r.body.session.id);
    }

    const page1 = await listSessions(ownerToken, { projectId, limit: 2, offset: 0 });
    expect(page1.status).toBe(200);
    expect(page1.body.sessions).toHaveLength(2);
    expect(page1.body.total).toBe(3);
    expect(page1.body.limit).toBe(2);
    expect(page1.body.offset).toBe(0);

    const page2 = await listSessions(ownerToken, { projectId, limit: 2, offset: 2 });
    expect(page2.status).toBe(200);
    expect(page2.body.sessions).toHaveLength(1);
    expect(page2.body.total).toBe(3);

    // No overlap between pages, union covers all 3.
    const seen = new Set([
      ...page1.body.sessions.map((s: any) => s.id),
      ...page2.body.sessions.map((s: any) => s.id),
    ]);
    expect(seen.size).toBe(3);
    for (const id of ids) expect(seen.has(id)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 7. default limit
  // ---------------------------------------------------------------------------
  it('7. defaults to limit=20 when no limit is given', async () => {
    const res = await listSessions(ownerToken);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(20);
  });

  // ---------------------------------------------------------------------------
  // 8. hard max — limit > 100 refused
  // ---------------------------------------------------------------------------
  it('8. a limit above the hard max (100) is refused with 400, not silently clamped', async () => {
    const res = await listSessions(ownerToken, { limit: 101 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('100');
  });

  it('8b. limit=100 itself is accepted (boundary, not off-by-one)', async () => {
    const res = await listSessions(ownerToken, { limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // 9. deterministic sort with a stable tie-breaker on identical timestamps
  // ---------------------------------------------------------------------------
  it('9. two sessions with the IDENTICAL created_at sort identically across repeated calls (id tie-breaker)', async () => {
    const projectId = `proj-tie-${randomUUID()}`;
    const a = await createSession(ownerToken, { projectId });
    const b = await createSession(ownerToken, { projectId });
    const sharedTimestamp = new Date().toISOString();
    await pool.query(`UPDATE method_sessions SET created_at = $1 WHERE id = ANY($2)`, [
      sharedTimestamp,
      [a.body.session.id, b.body.session.id],
    ]);

    const first = await listSessions(ownerToken, { projectId, limit: 100 });
    const second = await listSessions(ownerToken, { projectId, limit: 100 });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstOrder = first.body.sessions.map((s: any) => s.id);
    const secondOrder = second.body.sessions.map((s: any) => s.id);
    expect(firstOrder).toEqual(secondOrder);

    // The tie-breaker is id DESC — verify it actually matches the documented rule.
    const expectedOrder = [a.body.session.id, b.body.session.id].sort().reverse();
    expect(firstOrder).toEqual(expectedOrder);
  });

  // ---------------------------------------------------------------------------
  // 10. response shape: state, pack version, domainStage, owner, timestamps
  // ---------------------------------------------------------------------------
  it('10. each item reports state, methodPackVersion, domainStage, ownerUserId and timestamps', async () => {
    const created = await createSession(ownerToken);
    const res = await listSessions(ownerToken, { limit: 100 });
    const item = res.body.sessions.find((s: any) => s.id === created.body.session.id);
    expect(item).toBeTruthy();
    expect(item.state).toBe('draft');
    expect(item.methodPackVersion).toBe(PACK_VERSION);
    expect(item).toHaveProperty('domainStage');
    expect(item.ownerUserId).toBe(OWNER);
    expect(typeof item.createdAt).toBe('string');
    expect(typeof item.updatedAt).toBe('string');
  });

  // ---------------------------------------------------------------------------
  // 11. hasFrozenOutput — false before freeze, true after
  // ---------------------------------------------------------------------------
  it('11. hasFrozenOutput is false before freeze and true once the session has a frozen Output', async () => {
    const created = await createSession(ownerToken);
    const sessionId = created.body.session.id;

    const beforeRes = await listSessions(ownerToken, { limit: 100 });
    const beforeItem = beforeRes.body.sessions.find((s: any) => s.id === sessionId);
    expect(beforeItem.hasFrozenOutput).toBe(false);

    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'lead_assessor', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, OWNER]
    );
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
    for (const to of ['prepared', 'active', 'in_review']) {
      await request(app)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
    }
    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({ type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' } });
    const freeze = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    expect(freeze.status).toBe(200);

    const afterRes = await listSessions(ownerToken, { limit: 100 });
    const afterItem = afterRes.body.sessions.find((s: any) => s.id === sessionId);
    expect(afterItem.hasFrozenOutput).toBe(true);
    expect(afterItem.state).toBe('frozen');
  });

  // ---------------------------------------------------------------------------
  // 12. revisionOfSessionId — root vs reopened revision, BOTH listed
  // ---------------------------------------------------------------------------
  it('12. a reopened session appears as a SEPARATE list entry with revisionOfSessionId pointing at the original', async () => {
    const created = await createSession(ownerToken);
    const sessionId = created.body.session.id;
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'lead_assessor', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, OWNER]
    );
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
    for (const to of ['prepared', 'active', 'in_review']) {
      await request(app)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
    }
    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({ type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' } });
    await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});

    // Reopen: frozen -> active produces a NEW row, never mutates the original.
    // 'active' requires owner|lead_assessor (TRANSITION_AUTHORITY) — OWNER
    // holds both (owner from session creation, lead_assessor granted above).
    const reopen = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({ to: 'active' });
    expect(reopen.status).toBe(200);

    const listRes = await listSessions(ownerToken, { limit: 100 });
    const original = listRes.body.sessions.find((s: any) => s.id === sessionId);
    expect(original).toBeTruthy();
    expect(original.revisionOfSessionId).toBeNull();
    expect(original.state).toBe('frozen');

    const revision = listRes.body.sessions.find(
      (s: any) => s.revisionOfSessionId === sessionId
    );
    expect(revision).toBeTruthy();
    expect(revision.id).not.toBe(sessionId);
    expect(revision.state).toBe('active');
  });

  // ---------------------------------------------------------------------------
  // 13. no auth -> 401 (matches the rest of this router's convention)
  // ---------------------------------------------------------------------------
  it('13. a request with no Authorization header is refused with 401', async () => {
    const res = await request(app).get('/api/method/sessions');
    expect(res.status).toBe(401);
  });
});
