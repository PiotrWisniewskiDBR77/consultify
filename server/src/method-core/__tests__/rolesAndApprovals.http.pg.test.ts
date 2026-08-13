/**
 * @vitest-environment node
 *
 * Shared Method Kernel — role/przypisania/zatwierdzenia przez HTTP (S2,
 * 2026-08-13).
 *
 * Proves the WHOLE Assessment E2E flow — assign a role, revoke it, read its
 * history, approve or send back a review, read the approval trail — never
 * needs a hand-typed SQL statement. Every precondition in this file
 * (including driving a session from draft to in_review) goes through
 * `server/src/routes/method-core.routes.ts` over real HTTP, against the
 * real disposable Postgres — never a direct `INSERT`/`UPDATE` into
 * `method_session_roles`/`method_approvals`. That is the bug this file
 * exists to close: `http.integration.test.ts`'s own `driveToInReview`
 * helper still does a raw `INSERT INTO method_session_roles` because, before
 * this file, there was no HTTP path to do it.
 *
 * Run (from the worktree ROOT):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_s2" \
 *   npx vitest run server/src/method-core/__tests__/rolesAndApprovals.http.pg.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — a structural no-op ("skipped", never
 * "passed") unless RUN_DB_TESTS=1 and MOCK_DB=false and a postgres
 * DATABASE_URL are all present, matching this repo's `.pg.test.ts` convention.
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

describe.skipIf(!REAL_DB)('Method Kernel — roles/approvals HTTP surface (S2) — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s2-${SUFFIX}`;
  const OTHER_ORG = `org-s2-other-${SUFFIX}`;

  const OWNER = `user-s2-owner-${SUFFIX}`; // creates every session in this file
  const APPROVER = `user-s2-approver-${SUFFIX}`;
  const RESPONDENT = `user-s2-respondent-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s2-otherorg-${SUFFIX}`;

  const PACK_ID = `s2-test-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';
  let approverToken = '';
  let otherOrgToken = '';
  let respondentToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'S2 roles/approvals HTTP test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S2 roles/approvals HTTP test org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
      [APPROVER, ORG],
      [RESPONDENT, ORG],
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
    approverToken = sign(APPROVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);
    respondentToken = sign(RESPONDENT, ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'S2 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [OWNER, APPROVER, RESPONDENT, OTHER_ORG_USER],
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

  async function assignRoleHttp(sessionId: string, actorToken: string, userId: string, role: string) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ userId, role });
  }

  function revokeRoleHttp(sessionId: string, actorToken: string, userId: string, role: string) {
    return request(app)
      .delete(`/api/method/sessions/${sessionId}/roles/${userId}/${role}`)
      .set('Authorization', `Bearer ${actorToken}`);
  }

  async function transitionHttp(sessionId: string, actorToken: string, to: string) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${actorToken}`)
      .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
      .send({ to });
  }

  /**
   * Drives a freshly-created session (OWNER already holds 'owner', auto-
   * assigned on create) to 'in_review' — ENTIRELY over HTTP:
   *   1. OWNER self-assigns 'lead_assessor' via POST /roles (legal — a solo
   *      operator holding several WORKING roles is explicit-by-design per
   *      the kernel's own TRANSITION_AUTHORITY comment; 'lead_assessor' is
   *      NOT in POWER_ROLES, only 'approver' is).
   *   2. draft -> prepared -> active -> in_review via /transition.
   * No `pool.query` INSERT anywhere in this helper.
   */
  async function driveToInReviewViaHttp(sessionId: string): Promise<void> {
    const grant = await assignRoleHttp(sessionId, ownerToken, OWNER, 'lead_assessor');
    if (grant.status !== 201 && grant.status !== 200) {
      throw new Error(`driveToInReviewViaHttp: self-grant lead_assessor failed: ${grant.status} ${JSON.stringify(grant.body)}`);
    }
    for (const to of ['prepared', 'active', 'in_review']) {
      const res = await transitionHttp(sessionId, ownerToken, to);
      if (res.status !== 200) {
        throw new Error(`driveToInReviewViaHttp: transition to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
  }

  // ===========================================================================
  // Positive paths
  // ===========================================================================

  it('P1. assigning a role over HTTP is visible in the roster and needs zero SQL', async () => {
    const sessionId = await createSession(ownerToken);

    const res = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(true);

    const list = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: RESPONDENT, role: 'respondent' })])
    );

    // Also readable directly from the row the endpoint wrote — proves the
    // HTTP call is the ONLY write path, not a parallel in-memory mock.
    const row = await pool.query(
      `SELECT user_id, role FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, RESPONDENT]
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].role).toBe('respondent');
  });

  it('P2. revoking a role over HTTP removes it from the current roster', async () => {
    const sessionId = await createSession(ownerToken);
    await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');

    const revoke = await revokeRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBe(true);

    const list = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.body.roles).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: RESPONDENT, role: 'respondent' })])
    );
  });

  it('P3. revoking a role never assigned is refused with 404, nothing written', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await revokeRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('role_not_assigned');
  });

  it('P4. self-assigning a NON-power role (e.g. respondent) is allowed', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await assignRoleHttp(sessionId, ownerToken, OWNER, 'respondent');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(true);
  });

  it('P5. the full E2E path (assign -> drive to in_review -> approve -> freeze) needs zero manual SQL writes', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);
    const grant = await assignRoleHttp(sessionId, ownerToken, APPROVER, 'approver');
    expect(grant.status).toBe(201);

    const approve = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({ decision: 'approved' });
    expect(approve.status).toBe(201);
    expect(approve.body.approval.decision).toBe('approved');
    expect(approve.body.session.state).toBe('frozen');

    const row = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows[0].state).toBe('frozen');
  });

  // ===========================================================================
  // Hard rule #1 — no self-elevation, including "on behalf of"
  // ===========================================================================

  it('R1a. [DENY] a user cannot grant themselves the approver role', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await assignRoleHttp(sessionId, ownerToken, OWNER, 'approver');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('self_elevation_forbidden');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'approver'`,
      [sessionId, OWNER]
    );
    expect(row.rows).toHaveLength(0);
  });

  it('R1b. [DENY] the self-elevation guard cannot be bypassed by claiming a spoofed actor identity in the body', async () => {
    const sessionId = await createSession(ownerToken);
    // OWNER is genuinely the caller (real JWT). Body tries to disguise the
    // request as if RESPONDENT (a different person) were assigning the role
    // "on behalf of" OWNER — but the target is still OWNER, and the server
    // must derive the actor ONLY from the verified token, never from body
    // fields like `assignedBy`/`onBehalfOf`/`actorUserId`.
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: OWNER, role: 'approver', assignedBy: RESPONDENT, onBehalfOf: RESPONDENT, actorUserId: RESPONDENT });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('self_elevation_forbidden');

    // And the history log (if it existed) would show the REAL actor, never
    // the spoofed one — assert no row landed at all here (request refused).
    const row = await pool.query(
      `SELECT 1 FROM method_session_role_events WHERE session_id = $1 AND user_id = $2 AND role = 'approver'`,
      [sessionId, OWNER]
    );
    expect(row.rows).toHaveLength(0);
  });

  // ===========================================================================
  // Hard rule #2 — freeze only by 'approver' (via the approvals endpoint)
  // ===========================================================================

  it('R2. [DENY] an actor without the approver role cannot approve/freeze a session in review', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);
    // OWNER holds owner + lead_assessor, deliberately NOT approver.

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({ decision: 'approved' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');
    expect(res.body.requiredRole).toBe('approver');

    const row = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows[0].state).toBe('in_review');
    const approvals = await pool.query(`SELECT 1 FROM method_approvals WHERE session_id = $1`, [sessionId]);
    expect(approvals.rows).toHaveLength(0);
  });

  // ===========================================================================
  // Hard rule #3 — send back requires a comment
  // ===========================================================================

  it('R3a. [DENY] send-back without a comment is refused, session stays in_review', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `sendback:${randomUUID()}`)
      .send({ decision: 'sent_back' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('comment_required_for_send_back');

    const row = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows[0].state).toBe('in_review');
  });

  it('R3b. [ALLOW] send-back WITH a comment succeeds and is recorded on the trail', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `sendback:${randomUUID()}`)
      .send({ decision: 'sent_back', comment: 'Brakuje dowodu dla 1A — proszę uzupełnić.' });

    expect(res.status).toBe(201);
    expect(res.body.approval.decision).toBe('sent_back');
    expect(res.body.approval.comment).toBe('Brakuje dowodu dla 1A — proszę uzupełnić.');
    expect(res.body.session.state).toBe('active');

    const row = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows[0].state).toBe('active');
  });

  // ===========================================================================
  // Hard rule #4 — approval tied to the exact revision
  // ===========================================================================

  it('R4. a fresh revision (reopened session) starts with an EMPTY approval trail — the old approval does not carry over', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);
    await assignRoleHttp(sessionId, ownerToken, APPROVER, 'approver');

    const approve = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({ decision: 'approved' });
    expect(approve.status).toBe(201);
    expect(approve.body.session.state).toBe('frozen');

    const oldTrail = await request(app)
      .get(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(oldTrail.body.approvals).toHaveLength(1);
    expect(oldTrail.body.approvals[0].decision).toBe('approved');

    // Reopen: frozen -> active produces a NEW session id (the new revision).
    const reopen = await transitionHttp(sessionId, ownerToken, 'active');
    expect(reopen.status).toBe(200);
    const revisions = await request(app)
      .get(`/api/method/sessions/${sessionId}/events`) // sanity: original session id unchanged
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revisions.status).toBe(200);

    const revisionRows = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [sessionId]
    );
    expect(revisionRows.rows).toHaveLength(1);
    const newSessionId = revisionRows.rows[0].id as string;
    expect(newSessionId).not.toBe(sessionId);

    const newTrail = await request(app)
      .get(`/api/method/sessions/${newSessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(newTrail.status).toBe(200);
    expect(newTrail.body.approvals).toHaveLength(0); // hard rule #4: the old approval does not apply here

    // And the OLD session's trail is untouched by the reopen.
    const oldTrailAfter = await request(app)
      .get(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(oldTrailAfter.body.approvals).toHaveLength(1);
  });

  // ===========================================================================
  // Hard rule #5 — revoke never rewrites history
  // ===========================================================================

  it('R5. revoking a role appends a "revoked" event; the "assigned" event stays exactly as it was', async () => {
    const sessionId = await createSession(ownerToken);
    // Session creation itself already wrote one 'assigned' history event
    // (OWNER auto-granted 'owner') — history is scoped to the whole
    // session, not one role, so this test filters to RESPONDENT/respondent
    // specifically instead of asserting an absolute count.
    const assign = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(assign.status).toBe(201);

    const respondentEvents = (events: Array<{ userId: string; role: string }>) =>
      events.filter((e) => e.userId === RESPONDENT && e.role === 'respondent');

    const historyAfterAssign = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles/history`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(respondentEvents(historyAfterAssign.body.events)).toHaveLength(1);
    const assignedEvent = respondentEvents(historyAfterAssign.body.events)[0];
    expect(assignedEvent.action).toBe('assigned');
    expect(assignedEvent.userId).toBe(RESPONDENT);
    expect(assignedEvent.actorUserId).toBe(OWNER);

    const revoke = await revokeRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(revoke.status).toBe(200);

    const historyAfterRevoke = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles/history`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const respondentHistory = respondentEvents(historyAfterRevoke.body.events);
    expect(respondentHistory).toHaveLength(2);
    // The original 'assigned' row is untouched — byte-identical id/timestamp.
    const stillThere = respondentHistory.find((e: { id: string }) => e.id === assignedEvent.id);
    expect(stillThere).toEqual(assignedEvent);
    // A NEW 'revoked' event was appended, not a mutation of the old one.
    const revokedEvent = respondentHistory.find((e: { action: string }) => e.action === 'revoked');
    expect(revokedEvent).toBeTruthy();
    expect(revokedEvent.userId).toBe(RESPONDENT);
    expect(revokedEvent.actorUserId).toBe(OWNER);
    expect(revokedEvent.id).not.toBe(assignedEvent.id);
  });

  // ===========================================================================
  // Hard rule #6 — cross-org assignment refused
  // ===========================================================================

  it('R6. [DENY] a user from a different organization cannot be assigned a role on this session', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await assignRoleHttp(sessionId, ownerToken, OTHER_ORG_USER, 'respondent');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('cross_org_assignment_forbidden');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, OTHER_ORG_USER]
    );
    expect(row.rows).toHaveLength(0);
  });

  it('R6b. [DENY] a different organization cannot read this session\'s roles/approvals/history (tenant isolation)', async () => {
    const sessionId = await createSession(ownerToken);
    await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');

    const rolesRes = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(rolesRes.status).toBe(403);

    const historyRes = await request(app)
      .get(`/api/method/sessions/${sessionId}/roles/history`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(historyRes.status).toBe(403);

    const approvalsRes = await request(app)
      .get(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(approvalsRes.status).toBe(403);
  });

  // ===========================================================================
  // Hard rule #7 — duplicate assignment is idempotent
  // ===========================================================================

  it('R7. assigning the same (session, user, role) twice is idempotent — same effect, zero second row', async () => {
    const sessionId = await createSession(ownerToken);

    const first = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(first.status).toBe(201);
    expect(first.body.inserted).toBe(true);

    const second = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(second.status).toBe(200);
    expect(second.body.inserted).toBe(false);

    const rosterRows = await pool.query(
      `SELECT id FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'respondent'`,
      [sessionId, RESPONDENT]
    );
    expect(rosterRows.rows).toHaveLength(1);

    // The history log is likewise not inflated by the replay — exactly one
    // 'assigned' event, not two.
    const historyRows = await pool.query(
      `SELECT id FROM method_session_role_events WHERE session_id = $1 AND user_id = $2 AND role = 'respondent' AND action = 'assigned'`,
      [sessionId, RESPONDENT]
    );
    expect(historyRows.rows).toHaveLength(1);
  });

  // ===========================================================================
  // Hard rule #8 — roster management is owner/lead_assessor only, EXCEPT
  // self-declaring into a non-power role (S2 gap closed 2026-08-13; see
  // method-core.routes.ts's comment on this gate for the HTTP-500 postmortem)
  // ===========================================================================

  it('R8a. [DENY] an org member with no role on this session cannot grant a role to someone else', async () => {
    const sessionId = await createSession(ownerToken);
    // APPROVER exists in this org (has a valid token) but holds no role on
    // THIS particular session — a stranger to this session's roster.
    const res = await assignRoleHttp(sessionId, approverToken, RESPONDENT, 'respondent');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('role_management_forbidden');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, RESPONDENT]
    );
    expect(row.rows).toHaveLength(0);
  });

  it('R8b. [DENY] a respondent cannot grant a role to another user', async () => {
    const sessionId = await createSession(ownerToken);
    await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');

    const res = await assignRoleHttp(sessionId, respondentToken, APPROVER, 'evidence_owner');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('role_management_forbidden');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2`,
      [sessionId, APPROVER]
    );
    expect(row.rows).toHaveLength(0);
  });

  it('R8c. [ALLOW] owner and a delegated lead_assessor can both manage the roster', async () => {
    const sessionId = await createSession(ownerToken);

    // owner grants a role to someone else (not self) — plain roster mgmt.
    const ownerGrant = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');
    expect(ownerGrant.status).toBe(201);

    // owner delegates lead_assessor to APPROVER (not a self-assignment, and
    // lead_assessor is not in POWER_ROLES, so this is unconditionally legal).
    const delegate = await assignRoleHttp(sessionId, ownerToken, APPROVER, 'lead_assessor');
    expect(delegate.status).toBe(201);

    // APPROVER now holds lead_assessor on this session — the gate must
    // recognize that standing too, not just 'owner'. Grant a role to a
    // THIRD party (OWNER) — neither the actor nor a self-assignment, so
    // this only passes if APPROVER's lead_assessor standing is honored.
    const res = await assignRoleHttp(sessionId, approverToken, OWNER, 'evidence_owner');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(true);
  });

  it('R8d. [ALLOW] self-declaring into a non-power role succeeds even without owner/lead_assessor standing', async () => {
    const sessionId = await createSession(ownerToken);
    // RESPONDENT holds no role at all on this session yet — proves the
    // exception is unconditional participation, not "owner self-assigning
    // more roles on top of what they already hold".
    const res = await assignRoleHttp(sessionId, respondentToken, RESPONDENT, 'observer');
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(true);

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'observer'`,
      [sessionId, RESPONDENT]
    );
    expect(row.rows).toHaveLength(1);
  });

  it('R8e. [DENY] self-promotion to approver is refused even for an actor with no owner/lead_assessor standing', async () => {
    const sessionId = await createSession(ownerToken);
    await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'respondent');

    // Self-elevation (hard rule #1) must fire BEFORE the roster-management
    // gate even considers this actor's standing — same refusal shape as R1a.
    const res = await assignRoleHttp(sessionId, respondentToken, RESPONDENT, 'approver');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('self_elevation_forbidden');

    const row = await pool.query(
      `SELECT 1 FROM method_session_roles WHERE session_id = $1 AND user_id = $2 AND role = 'approver'`,
      [sessionId, RESPONDENT]
    );
    expect(row.rows).toHaveLength(0);
  });

  // ===========================================================================
  // Cross-cutting: validation / auth
  // ===========================================================================

  it('V1. an unknown role in the closed METHOD_PROCESS_ROLES set is rejected with 400', async () => {
    const sessionId = await createSession(ownerToken);
    const res = await assignRoleHttp(sessionId, ownerToken, RESPONDENT, 'super_admin_definitely_not_a_role');
    expect(res.status).toBe(400);
  });

  it('V2. an approval decision outside approved|sent_back is rejected with 400', async () => {
    const sessionId = await createSession(ownerToken);
    await driveToInReviewViaHttp(sessionId);
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `bad:${randomUUID()}`)
      .send({ decision: 'maybe_later' });
    expect(res.status).toBe(400);
  });

  it('V3. no Authorization header on any new S2 route is refused with 401', async () => {
    const sessionId = await createSession(ownerToken);
    const res1 = await request(app).get(`/api/method/sessions/${sessionId}/roles`);
    expect(res1.status).toBe(401);
    const res2 = await request(app).post(`/api/method/sessions/${sessionId}/roles`).send({ userId: RESPONDENT, role: 'respondent' });
    expect(res2.status).toBe(401);
    const res3 = await request(app).get(`/api/method/sessions/${sessionId}/approvals`);
    expect(res3.status).toBe(401);
  });
});
