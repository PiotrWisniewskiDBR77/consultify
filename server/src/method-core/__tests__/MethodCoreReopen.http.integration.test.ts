/**
 * @vitest-environment node
 *
 * Shared Method Kernel — `POST /api/method/sessions/:id/reopen`, real
 * PostgreSQL (agent S8, 2026-08-13).
 *
 * Proves the ONE route this agent added to
 * `server/src/routes/method-core.routes.ts` end-to-end against a real
 * Postgres (NOT a mock, NOT sqlite), with the REAL `verifyToken` middleware
 * verifying REAL signed JWTs — same convention as the sibling
 * `http.integration.test.ts` (S1) and
 * `MethodSessionRoleService.http.integration.test.ts` (S2).
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://s8:s8@localhost:55520/s8_test" \
 *   npx vitest run server/src/method-core --no-file-parallelism
 *
 * `describe.skipIf(!REAL_DB)` — structural no-op (all cases report
 * "skipped", not "passed") unless RUN_DB_TESTS=1 and a postgres
 * DATABASE_URL are both present.
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

describe.skipIf(!REAL_DB)('POST /api/method/sessions/:id/reopen — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s8-${SUFFIX}`;
  const OTHER_ORG = `org-s8-other-${SUFFIX}`;
  const OWNER = `user-s8-owner-${SUFFIX}`;
  const LEAD = `user-s8-lead-${SUFFIX}`;
  const APPROVER = `user-s8-approver-${SUFFIX}`;
  const OBSERVER = `user-s8-observer-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s8-otherorg-${SUFFIX}`;

  const PACK_ID = `s8-test-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';
  let leadToken = '';
  let approverToken = '';
  let observerToken = '';
  let otherOrgToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    // ★ Fail-closed: proves this suite talks to a REAL PostgreSQL, not a
    // mock/sqlite fallback (see server/src/test-utils/dbFailClosed.ts).
    const { assertRealPostgresTestDb } = await import('../../test-utils/dbFailClosed.js');
    await assertRealPostgresTestDb(pool);

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'S8 reopen HTTP test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S8 reopen HTTP test org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
      [LEAD, ORG],
      [APPROVER, ORG],
      [OBSERVER, ORG],
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
    leadToken = sign(LEAD, ORG);
    approverToken = sign(APPROVER, ORG);
    observerToken = sign(OBSERVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'S8 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    // Additive-only cleanup. method_session_reopen_idempotency FKs to
    // method_sessions (ON DELETE CASCADE) which FKs to organizations (ON
    // DELETE CASCADE too) — deleting organizations is enough for those, but
    // users.organization_id has no cascade so users must go first.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, LEAD, APPROVER, OBSERVER, OTHER_ORG_USER]]);
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

  async function grantRole(sessionId: string, userId: string, role: string): Promise<void> {
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, userId, role]
    );
  }

  async function driveToInReview(sessionId: string): Promise<void> {
    await grantRole(sessionId, OWNER, 'lead_assessor');
    for (const to of ['prepared', 'active', 'in_review']) {
      const res = await request(app)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
      if (res.status !== 200) {
        throw new Error(`driveToInReview: transition to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
  }

  /** Drives a fresh session all the way to `frozen`, with one Output. */
  async function createFrozenSession(): Promise<{ sessionId: string; outputId: string; outputContentHash: string }> {
    const sessionId = await createSession(ownerToken);
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');

    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      });
    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `answer:${randomUUID()}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      });

    const freeze = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (freeze.status !== 200) {
      throw new Error(`createFrozenSession: freeze failed: ${freeze.status} ${JSON.stringify(freeze.body)}`);
    }
    return { sessionId, outputId: freeze.body.output.id, outputContentHash: freeze.body.output.contentHash };
  }

  // ---------------------------------------------------------------------------
  // 1. frozen -> active reopen mints a NEW session id, never mutates the old one
  // ---------------------------------------------------------------------------
  it('1. reopening a frozen session creates a NEW active revision; the frozen row is untouched', async () => {
    const { sessionId, outputId, outputContentHash } = await createFrozenSession();

    const before = await pool.query(`SELECT * FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(before.rows).toHaveLength(1);
    expect(before.rows[0].state).toBe('frozen');

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.idempotentReplay).toBe(false);
    const revision = res.body.session;
    expect(revision.id).not.toBe(sessionId);
    expect(revision.state).toBe('active');
    expect(revision.revisionOfSessionId).toBe(sessionId);

    // The ORIGINAL frozen row: state, version, frozen_snapshot_id all
    // byte-identical to before the reopen — never mutated in place.
    const after = await pool.query(`SELECT * FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]).toEqual(before.rows[0]);

    // ★ The old Output's content_hash is bit-for-bit unchanged too — a
    // reopen never touches method_outputs of the session it reopened.
    const outputAfter = await request(app)
      .get(`/api/method/outputs/${outputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(outputAfter.status).toBe(200);
    expect(outputAfter.body.output.contentHash).toBe(outputContentHash);

    // A brand new row exists in the DB for the revision, distinct from the
    // frozen one, with its own fresh version=1 / frozen_snapshot_id=null.
    const revisionRow = await pool.query(`SELECT * FROM method_sessions WHERE id = $1`, [revision.id]);
    expect(revisionRow.rows).toHaveLength(1);
    expect(revisionRow.rows[0].revision_of_session_id).toBe(sessionId);
    expect(revisionRow.rows[0].version).toBe(1);
    expect(revisionRow.rows[0].frozen_snapshot_id).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. idempotency: retry with the SAME key replays the SAME revision
  // ---------------------------------------------------------------------------
  it('2. retrying reopen with the SAME Idempotency-Key returns the SAME revision, not a second one', async () => {
    const { sessionId } = await createFrozenSession();
    const idemKey = `reopen:${randomUUID()}`;

    const first = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({});
    expect(first.status).toBe(201);
    expect(first.body.idempotentReplay).toBe(false);
    const revisionId = first.body.session.id;

    const second = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.session.id).toBe(revisionId);

    // Exactly ONE revision row exists — the retry never minted a second one.
    const rows = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].id).toBe(revisionId);

    // A DIFFERENT idempotency key on the SAME frozen session is a genuinely
    // new request — it mints ANOTHER, distinct revision (idempotency is
    // per-key, not "only one reopen ever").
    const third = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(third.status).toBe(201);
    expect(third.body.idempotentReplay).toBe(false);
    expect(third.body.session.id).not.toBe(revisionId);
  });

  // ---------------------------------------------------------------------------
  // 3. permission — owner/lead_assessor may reopen; an unrelated role may not
  // ---------------------------------------------------------------------------
  it('3. an actor without owner/lead_assessor on the frozen session is refused with 403 missing_permission', async () => {
    const { sessionId } = await createFrozenSession();

    // OBSERVER holds no role at all on this session.
    await grantRole(sessionId, OBSERVER, 'observer');

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${observerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');
    expect(res.body.requiredRole).toBe('owner');

    // No new revision was created by the refused attempt.
    const rows = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('3b. lead_assessor (not owner) MAY reopen — TRANSITION_AUTHORITY[active] allows either', async () => {
    const { sessionId } = await createFrozenSession();
    await grantRole(sessionId, LEAD, 'lead_assessor');

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${leadToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.session.state).toBe('active');
  });

  // ---------------------------------------------------------------------------
  // 4. reopening a session that is NOT frozen is refused (illegal transition)
  // ---------------------------------------------------------------------------
  it('4. reopening a session that is not frozen (e.g. draft) is refused with 409 illegal_transition', async () => {
    const sessionId = await createSession(ownerToken);

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('illegal_transition');
    expect(res.body.from).toBe('draft');
    expect(res.body.to).toBe('active');
  });

  // ---------------------------------------------------------------------------
  // 5. Idempotency-Key header required
  // ---------------------------------------------------------------------------
  it('5. reopen without an Idempotency-Key header is refused with 400', async () => {
    const { sessionId } = await createFrozenSession();
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 6. cross-org: a different organization cannot reopen or discover the session
  // ---------------------------------------------------------------------------
  it('6. a different organization gets 403/404 and creates no revision', async () => {
    const { sessionId } = await createFrozenSession();

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect([403, 404]).toContain(res.status);

    const rows = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('6b. reopening a non-existent session id is refused with 404', async () => {
    const res = await request(app)
      .post(`/api/method/sessions/${randomUUID()}/reopen`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 7. no Authorization header -> 401
  // ---------------------------------------------------------------------------
  it('7. no Authorization header -> 401', async () => {
    const { sessionId } = await createFrozenSession();
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/reopen`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({});
    expect(res.status).toBe(401);
  });
});
