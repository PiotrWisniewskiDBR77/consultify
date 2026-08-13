/**
 * @vitest-environment node
 *
 * Shared Method Kernel — roles/assignment/approval HTTP surface, real
 * PostgreSQL (agent S2, CEL 3, 2026-08-13).
 *
 * Proves `server/src/routes/method-core-roles.routes.ts` +
 * `server/src/method-core/MethodSessionRoleService.ts` end-to-end against a
 * disposable Postgres (NOT a mock, NOT sqlite), with REAL signed JWTs
 * verified by the REAL `verifyToken` middleware — same convention as the
 * sibling `http.integration.test.ts` (S1's suite for `method-core.routes.ts`).
 *
 * This file mounts BOTH `method-core-roles.routes.ts` (this agent's own
 * router) AND `method-core.routes.ts` (S1's, imported read-only — never
 * modified) into its own throwaway Express app, exactly the way
 * `server/src/Gateway.ts` mounts both in production. S1's router supplies
 * `/sessions` (create), `/sessions/:id/transition`, `/sessions/:id/events`
 * and `/sessions/:id/freeze` — this suite drives THROUGH those, over HTTP,
 * never via a direct SQL INSERT, so the seven hard rules below are proven
 * against the real request path a browser would take.
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://t:t@localhost:55495/t_test" \
 *   npx vitest run server/src/method-core
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

describe.skipIf(!REAL_DB)('Method Kernel roles/approval HTTP surface — real PostgreSQL', () => {
  let app: Express;
  /**
   * ★ JEDEN nasłuchujący serwer na plik, zamiast nowego listenera na KAŻDE
   * żądanie supertest. `request(httpServer)` podnosi efemeryczny listener za każdym
   * razem — przy 145 wywołaniach w bramce i obciążonej maszynie kończyło się to
   * `ECONNRESET`, `socket hang up` i `Parse Error: Expected HTTP/`, czyli
   * migotaniem bramki (2 z 5 przebiegów). To usuwa MECHANIZM, nie objaw —
   * żadnego retry, żadnego wyciszania.
   */
  let httpServer: import('node:http').Server;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s2-${SUFFIX}`;
  const OTHER_ORG = `org-s2-other-${SUFFIX}`;
  const OWNER = `user-s2-owner-${SUFFIX}`;
  const LEAD = `user-s2-lead-${SUFFIX}`;
  const APPROVER = `user-s2-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s2-otherorg-${SUFFIX}`;

  const PACK_ID = `s2-test-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';
  let leadToken = '';
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
      'S2 roles HTTP test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S2 roles HTTP test org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
      [LEAD, ORG],
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
    leadToken = sign(LEAD, ORG);
    approverToken = sign(APPROVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'S2 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    const { default: methodCoreRolesRoutes } = await import('../../routes/method-core-roles.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
    httpServer = app.listen(0);
    app.use('/api/method', methodCoreRolesRoutes);
  });

  afterAll(async () => {

    await new Promise<void>((r) => httpServer.close(() => r()));
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, LEAD, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(token: string): Promise<string> {
    const res = await request(httpServer)
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

  async function grantRole(actorToken: string, sessionId: string, userId: string, role: string) {
    return request(httpServer)
      .post(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ userId, role });
  }

  async function driveToInReview(sessionId: string): Promise<void> {
    // Grant lead_assessor over HTTP (our own endpoint) — the pre-existing
    // sibling suite has to do this with a raw SQL INSERT because this
    // endpoint did not exist before this agent's work; that gap is exactly
    // what CEL 3 closes.
    const grant = await grantRole(ownerToken, sessionId, OWNER, 'lead_assessor');
    if (grant.status !== 201 && grant.status !== 200) {
      throw new Error(`driveToInReview: granting lead_assessor failed: ${grant.status} ${JSON.stringify(grant.body)}`);
    }
    for (const to of ['prepared', 'active', 'in_review']) {
      const res = await request(httpServer)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
      if (res.status !== 200) {
        throw new Error(`driveToInReview: transition to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
  }

  async function freezeSession(sessionId: string, actorToken: string) {
    await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      });
    await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `answer:${randomUUID()}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      });
    return request(httpServer)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${actorToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
  }

  // ---------------------------------------------------------------------------
  // Hard rule 1 — self-assignment of 'approver' is refused
  // ---------------------------------------------------------------------------
  it('1. a user cannot grant themselves the approver role', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await grantRole(ownerToken, sessionId, OWNER, 'approver');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cannot_self_assign_approver');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'approver'`,
      [sessionId, OWNER]
    );
    expect(row.rows).toHaveLength(0);
  });

  // A different user MAY grant someone else 'approver'.
  it('1b. granting approver to a DIFFERENT user succeeds', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await grantRole(ownerToken, sessionId, APPROVER, 'approver');
    expect(res.status).toBe(201);
    expect(res.body.assignment.role).toBe('approver');
    expect(res.body.assignment.userId).toBe(APPROVER);
  });

  // ---------------------------------------------------------------------------
  // Hard rule 2 — an unauthorized actor cannot freeze
  // ---------------------------------------------------------------------------
  it('2. an actor without the approver role is refused a freeze (403 missing_permission)', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReview(sessionId);
    // OWNER holds owner + lead_assessor, deliberately NOT approver.
    const res = await freezeSession(sessionId, ownerToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');
    expect(res.body.requiredRole).toBe('approver');
  });

  // ---------------------------------------------------------------------------
  // Hard rule 3 — send-back requires a comment
  // ---------------------------------------------------------------------------
  it('3. send-back without a comment is refused with 400; with a comment it succeeds', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReview(sessionId);

    const noComment = await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/send-back`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(noComment.status).toBe(400);

    const withComment = await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/send-back`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'Brakuje dowodu na 1A poziom 3 — proszę uzupełnić.' });
    expect(withComment.status).toBe(200);
    expect(withComment.body.session.state).toBe('active');
    expect(withComment.body.newRevision).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Hard rule 4 — approval is tied to the EXACT revision (session id +
  // version), not "the session in general". A send-back on a FROZEN session
  // reopens into a NEW session id; the approval-trail of the OLD id must
  // still show the frozen decision, and the NEW id starts with an empty
  // trail of its own.
  // ---------------------------------------------------------------------------
  it('4. approval trail is scoped to the exact revision; a reopen starts a fresh trail', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReview(sessionId);
    await grantRole(ownerToken, sessionId, APPROVER, 'approver');
    // Reopen requires owner/lead_assessor too — grant it to APPROVER so the
    // same actor can both approve and (in this test) send back after freeze.
    await grantRole(ownerToken, sessionId, APPROVER, 'lead_assessor');

    const freezeRes = await freezeSession(sessionId, approverToken);
    expect(freezeRes.status).toBe(200);
    const versionAtFreeze = freezeRes.body.session.version;

    // Record the approval decision itself — the generic events endpoint
    // (S1's, pre-existing) is the documented way a caller ties a
    // DECISION_APPROVED event to the revision it approves.
    const approveEvent = await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({
        type: 'DECISION_APPROVED',
        actorKind: 'human',
        payload: {
          decisionId: randomUUID(),
          subject: 'freeze',
          rationale: 'Ocena kompletna, zatwierdzam.',
          version: versionAtFreeze,
        },
      });
    expect(approveEvent.status).toBe(201);

    const trailBeforeSendBack = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/approval-trail`)
      .set('Authorization', `Bearer ${approverToken}`);
    expect(trailBeforeSendBack.status).toBe(200);
    expect(trailBeforeSendBack.body.trail).toHaveLength(1);
    expect(trailBeforeSendBack.body.trail[0].type).toBe('DECISION_APPROVED');
    expect(trailBeforeSendBack.body.trail[0].version).toBe(versionAtFreeze);
    expect(trailBeforeSendBack.body.trail[0].sessionId).toBe(sessionId);

    // Send back the FROZEN session — reopens into a new revision.
    const sendBack = await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/send-back`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ comment: 'Po dalszej analizie: proszę o dodatkowy dowód przed ponownym zamrożeniem.' });
    expect(sendBack.status).toBe(200);
    expect(sendBack.body.newRevision).toBeTruthy();
    const newRevisionId = sendBack.body.newRevision.id;
    expect(newRevisionId).not.toBe(sessionId);
    expect(sendBack.body.newRevision.state).toBe('active');
    expect(sendBack.body.newRevision.revisionOfSessionId).toBe(sessionId);

    // OLD revision's trail now has approval + send-back, both scoped to it.
    const oldTrail = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/approval-trail`)
      .set('Authorization', `Bearer ${approverToken}`);
    expect(oldTrail.body.trail.map((e: { type: string }) => e.type).sort()).toEqual(
      ['DECISION_APPROVED', 'DECISION_SENT_BACK'].sort()
    );
    const sentBackEntry = oldTrail.body.trail.find((e: { type: string }) => e.type === 'DECISION_SENT_BACK');
    expect(sentBackEntry.version).toBe(versionAtFreeze);
    expect(sentBackEntry.sessionId).toBe(sessionId);

    // NEW revision's trail is EMPTY — it never inherited the old decisions.
    const newTrail = await request(httpServer)
      .get(`/api/method/sessions/${newRevisionId}/approval-trail`)
      .set('Authorization', `Bearer ${approverToken}`);
    expect(newTrail.status).toBe(200);
    expect(newTrail.body.trail).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Hard rule 5 — revoking a role does NOT alter the append-only history
  // ---------------------------------------------------------------------------
  it('5. revoking a role leaves the granted history entry intact', async () => {
    const sessionId = await createSession(ownerToken);
    await grantRole(ownerToken, sessionId, LEAD, 'reviewer');

    const revoke = await request(httpServer)
      .delete(`/api/method/sessions/${sessionId}/roles/${LEAD}/reviewer`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBe(true);

    // Current-state list no longer shows it.
    const current = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(current.body.roles.some((r: { userId: string; role: string }) => r.userId === LEAD && r.role === 'reviewer')).toBe(
      false
    );

    // History still shows BOTH the grant and the revoke.
    const history = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles/history`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(history.status).toBe(200);
    const events = history.body.history.filter((h: { userId: string; role: string }) => h.userId === LEAD && h.role === 'reviewer');
    expect(events.map((e: { eventType: string }) => e.eventType).sort()).toEqual(['granted', 'revoked']);
  });

  // ---------------------------------------------------------------------------
  // Hard rule 6 — cross-org assignment is refused
  // ---------------------------------------------------------------------------
  it('6. a different organization cannot assign or read roles on this session (403/404)', async () => {
    const sessionId = await createSession(ownerToken);

    const assign = await grantRole(otherOrgToken, sessionId, OTHER_ORG_USER, 'observer');
    expect([403, 404]).toContain(assign.status);

    const read = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect([403, 404]).toContain(read.status);

    // No leakage: the assignment attempt did not create a row.
    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, OTHER_ORG_USER]
    );
    expect(row.rows).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Hard rule 7 — duplicate assignment is idempotent
  // ---------------------------------------------------------------------------
  it('7. granting the same role twice does not create a second row', async () => {
    const sessionId = await createSession(ownerToken);

    const first = await grantRole(ownerToken, sessionId, LEAD, 'assessor');
    expect(first.status).toBe(201);
    expect(first.body.alreadyGranted).toBe(false);

    const second = await grantRole(ownerToken, sessionId, LEAD, 'assessor');
    expect(second.status).toBe(200);
    expect(second.body.alreadyGranted).toBe(true);

    const rows = await pool.query(
      `SELECT id FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'assessor'`,
      [sessionId, LEAD]
    );
    expect(rows.rows).toHaveLength(1);

    // History also gets exactly ONE 'granted' entry, not two.
    const history = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles/history`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const grants = history.body.history.filter(
      (h: { userId: string; role: string; eventType: string }) => h.userId === LEAD && h.role === 'assessor' && h.eventType === 'granted'
    );
    expect(grants).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Additional checks called out explicitly in scope
  // ---------------------------------------------------------------------------

  it('8. the role list is deterministic across repeated reads', async () => {
    const sessionId = await createSession(ownerToken);
    await grantRole(ownerToken, sessionId, APPROVER, 'reviewer');
    await grantRole(ownerToken, sessionId, LEAD, 'assessor');

    const first = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const second = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(first.body.roles).toEqual(second.body.roles);
  });

  it('9. no Authorization header -> 401', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await request(httpServer).get(`/api/method/sessions/${sessionId}/roles`);
    expect(res.status).toBe(401);
  });

  it('10. assigning a role outside the closed METHOD_PROCESS_ROLES set is refused with 400', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await grantRole(ownerToken, sessionId, LEAD, 'dictator');
    expect(res.status).toBe(400);
  });

  it('11. approval-trail shows who, when, and which revision approved', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReview(sessionId);
    await grantRole(ownerToken, sessionId, APPROVER, 'approver');
    const freezeRes = await freezeSession(sessionId, approverToken);
    expect(freezeRes.status).toBe(200);
    const versionAtFreeze = freezeRes.body.session.version;

    await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({
        type: 'DECISION_APPROVED',
        actorKind: 'human',
        payload: { decisionId: randomUUID(), subject: 'freeze', rationale: 'Zatwierdzam.', version: versionAtFreeze },
      });

    const trail = await request(httpServer)
      .get(`/api/method/sessions/${sessionId}/approval-trail`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(trail.status).toBe(200);
    expect(trail.body.trail).toHaveLength(1);
    const entry = trail.body.trail[0];
    expect(entry.actorUserId).toBe(APPROVER); // who
    expect(typeof entry.occurredAt).toBe('string'); // when
    expect(entry.occurredAt.length).toBeGreaterThan(0);
    expect(entry.version).toBe(versionAtFreeze); // which revision
    expect(entry.sessionId).toBe(sessionId);
  });
});
