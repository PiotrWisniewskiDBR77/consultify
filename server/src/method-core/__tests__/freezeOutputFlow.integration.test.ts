/**
 * @vitest-environment node
 *
 * Shared Method Kernel — A9 backend closure: freeze -> Output -> approval ->
 * Report -> Initiative, real PostgreSQL (P0B, 2026-08-13).
 *
 * Covers the 16-step P0B mandate end-to-end over REAL HTTP
 * (`server/src/routes/method-core.routes.ts`) against the disposable
 * Postgres at localhost:55440 — NOT a mock, NOT sqlite — with the REAL
 * `verifyToken` middleware verifying REAL signed JWTs against REAL seeded
 * `users`/`organizations` rows. Same pattern as `http.integration.test.ts`
 * (which already proves 1/2/4/16/create/idempotency/cross-org/401/409 at a
 * more general level) — this file is scoped to the freeze->Output->
 * approval->Report->Presentation->Initiative->reopen chain specifically, in
 * the order the mandate lists it, one `it()` per numbered step.
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://mac:mac@localhost:55440/mac_test" \
 *   npx vitest run server/src/method-core
 *
 * `describe.skipIf(!REAL_DB)` — structural no-op unless RUN_DB_TESTS=1 and a
 * postgres DATABASE_URL are both present.
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

describe.skipIf(!REAL_DB)('P0B — freeze -> Output -> approval -> Report -> Initiative (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-p0b-${SUFFIX}`;
  const OTHER_ORG = `org-p0b-other-${SUFFIX}`;
  const OWNER = `user-p0b-owner-${SUFFIX}`; // holds owner + lead_assessor
  const APPROVER = `user-p0b-approver-${SUFFIX}`; // holds approver ONLY
  const OTHER_ORG_USER = `user-p0b-otherorg-${SUFFIX}`;

  const PACK_ID = `p0b-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';
  const REVIEW_PACK_ID = `p0b-review-pack-${SUFFIX}`; // stays 'methodology_review' throughout

  let ownerToken = '';
  let approverToken = '';
  let otherOrgToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    // ★ Fail-closed (CEL 10): proves this suite is talking to a REAL
    // PostgreSQL, not a mock/sqlite fallback — throws if not. See
    // server/src/test-utils/dbFailClosed.ts header comment.
    const { assertRealPostgresTestDb } = await import('../../test-utils/dbFailClosed.js');
    await assertRealPostgresTestDb(pool);

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'P0B freeze/Output HTTP test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'P0B freeze/Output HTTP test org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
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
    approverToken = sign(APPROVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'P0B test pack (released)',
      readiness: 'released',
    });
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: REVIEW_PACK_ID,
      version: PACK_VERSION,
      name: 'P0B test pack (methodology_review — never released by this suite)',
      readiness: 'methodology_review',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(
    token: string,
    overrides: Record<string, unknown> = {}
  ): Promise<{ status: number; body: any }> {
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
        ...overrides,
      });
    return { status: res.status, body: res.body };
  }

  async function grantRole(sessionId: string, userId: string, role: string): Promise<void> {
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, userId, role]
    );
  }

  async function transitionTo(sessionId: string, to: string, token: string, extra: Record<string, unknown> = {}) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
      .send({ to, ...extra });
  }

  /** OWNER already holds 'owner' from create(); grant lead_assessor and walk draft -> in_review. */
  async function driveToInReview(sessionId: string): Promise<void> {
    await grantRole(sessionId, OWNER, 'lead_assessor');
    for (const to of ['prepared', 'active', 'in_review']) {
      const res = await transitionTo(sessionId, to, ownerToken);
      if (res.status !== 200) {
        throw new Error(`driveToInReview: transition to ${to} failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    }
  }

  async function addEvidenceAndAnswer(sessionId: string, unitId = '1A'): Promise<void> {
    const evidence = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId,
        payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      });
    if (evidence.status !== 201) {
      throw new Error(`addEvidenceAndAnswer: EVIDENCE_ATTACHED failed: ${evidence.status} ${JSON.stringify(evidence.body)}`);
    }
    const answer = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `answer:${randomUUID()}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId,
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      });
    if (answer.status !== 201) {
      throw new Error(`addEvidenceAndAnswer: ANSWER_CONFIRMED failed: ${answer.status} ${JSON.stringify(answer.body)}`);
    }
  }

  /** Full path: create -> in_review -> evidence/answer -> approver freeze. Returns {sessionId, output}. */
  async function createFrozenSessionWithOutput(): Promise<{ sessionId: string; output: any }> {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionId);
    const freeze = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (freeze.status !== 200) {
      throw new Error(`createFrozenSessionWithOutput: freeze failed: ${freeze.status} ${JSON.stringify(freeze.body)}`);
    }
    return { sessionId, output: freeze.body.output };
  }

  // =========================================================================
  // 1. freeze Session z revision check -> 409
  // =========================================================================
  it('1. freezing with a stale expectedVersion is refused 409, and no snapshot/Output is written', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');

    const before = await pool.query(`SELECT version, state, frozen_snapshot_id FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(before.rows[0].state).toBe('in_review');

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({ expectedVersion: 999 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('version_conflict');
    expect(res.body.currentVersion).toBe(before.rows[0].version);

    const after = await pool.query(`SELECT version, state, frozen_snapshot_id FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const outputs = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(outputs.rows).toHaveLength(0);
  });

  // =========================================================================
  // 2. idempotentny retry freeze
  // =========================================================================
  it('2. retrying freeze with the SAME Idempotency-Key returns the identical session+Output, no second write', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionId);

    const freezeKey = `freeze:${randomUUID()}`;
    const first = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', freezeKey)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', freezeKey)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.output.id).toBe(first.body.output.id);
    expect(second.body.session.version).toBe(first.body.session.version);

    const snapshots = await pool.query(`SELECT id FROM method_snapshots WHERE session_id = $1`, [sessionId]);
    expect(snapshots.rows).toHaveLength(1);
  });

  // =========================================================================
  // 3. utworzenie immutable Output
  // =========================================================================
  it('3. freeze creates exactly one immutable method_outputs row, readable via GET, no PUT/PATCH/DELETE route exists', async () => {
    const { sessionId, output } = await createFrozenSessionWithOutput();

    const rows = await pool.query(`SELECT * FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].id).toBe(output.id);
    expect(rows.rows[0].output_version).toBe(1);

    const getRes = await request(app)
      .get(`/api/method/outputs/${output.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.output.sessionId).toBe(sessionId);

    const put = await request(app)
      .put(`/api/method/outputs/${output.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scope: 'MUTATED' });
    expect(put.status).toBe(404);
    const del = await request(app).delete(`/api/method/outputs/${output.id}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(del.status).toBe(404);
  });

  // =========================================================================
  // 4. idempotentny retry Output (retry freeze -> zero duplikatu)
  // =========================================================================
  it('4. retrying freeze after the Output already exists still returns 200 with the SAME Output id, never a duplicate', async () => {
    const { sessionId, output } = await createFrozenSessionWithOutput();

    // A second, DIFFERENT Idempotency-Key freeze call on an already-frozen
    // session must not illegally-transition (session.state !== 'frozen'
    // check in the route) NOR mint a second Output.
    const retry = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-retry:${randomUUID()}`)
      .send({});
    expect(retry.status).toBe(200);
    expect(retry.body.output.id).toBe(output.id);

    const rows = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(rows.rows).toHaveLength(1);
  });

  // =========================================================================
  // 5. lineage Session revision -> Output
  // =========================================================================
  it('5. the Output traces back to the exact session revision and frozen snapshot that produced it', async () => {
    const { sessionId, output } = await createFrozenSessionWithOutput();

    const sessionRes = await request(app)
      .get(`/api/method/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(sessionRes.status).toBe(200);
    const session = sessionRes.body.session;

    expect(output.sessionId).toBe(sessionId);
    expect(output.snapshotId).toBe(session.frozenSnapshotId);
    expect(session.frozenSnapshotId).toBeTruthy();

    const snapshotRow = await pool.query(`SELECT session_id FROM method_snapshots WHERE id = $1`, [
      session.frozenSnapshotId,
    ]);
    expect(snapshotRow.rows[0].session_id).toBe(sessionId);
  });

  // =========================================================================
  // 6. późniejsza zmiana Session NIE mutuje Output (content_hash przed/po)
  // =========================================================================
  it('6. appending a new event to the (now frozen) session leaves the Output content_hash byte-identical', async () => {
    const { sessionId, output } = await createFrozenSessionWithOutput();

    const before = await request(app)
      .get(`/api/method/outputs/${output.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(before.status).toBe(200);
    const hashBefore: string = before.body.output.contentHash;
    expect(typeof hashBefore).toBe('string');
    expect(hashBefore.length).toBeGreaterThan(0);

    // The event log itself stays append-only even after freeze (it is not
    // gated on session.state) — this is exactly the "later session change"
    // this step must prove does NOT reach back into the immutable Output.
    const append = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `post-freeze-event:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `ev-post-freeze-${randomUUID()}`, evidenceType: 'document', strength: 'E4' },
      });
    expect(append.status).toBe(201);

    const after = await request(app)
      .get(`/api/method/outputs/${output.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(after.status).toBe(200);
    const hashAfter: string = after.body.output.contentHash;

    // Numeric/byte proof, not just "truthy": identical hash string.
    expect(hashAfter).toBe(hashBefore);
    expect(after.body.output.frozenAt).toBe(before.body.output.frozenAt);

    const dbRow = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [output.id]);
    expect(dbRow.rows[0].content_hash).toBe(hashBefore);
  });

  // =========================================================================
  // 7. review / send back (in_review -> active, SAME session, no revision)
  // =========================================================================
  it('7. sending an in-review session back to active keeps the SAME session id — not a revision', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);

    const sendBack = await transitionTo(sessionId, 'active', ownerToken);
    expect(sendBack.status).toBe(200);
    expect(sendBack.body.session.id).toBe(sessionId);
    expect(sendBack.body.session.state).toBe('active');
    expect(sendBack.body.session.revisionOfSessionId).toBeNull();

    const revisions = await pool.query(`SELECT id FROM method_sessions WHERE revision_of_session_id = $1`, [
      sessionId,
    ]);
    expect(revisions.rows).toHaveLength(0); // send-back is not a reopen
  });

  // =========================================================================
  // 8. utworzenie poprawionej rewizji (frozen -> active = nowa rewizja,
  //    stary Output nietknięty)
  // =========================================================================
  it('8. reopening a frozen session (frozen -> active) creates a NEW session revision; the old session and its Output are untouched', async () => {
    const { sessionId: originalSessionId, output: originalOutput } = await createFrozenSessionWithOutput();

    const originalBefore = await pool.query(`SELECT state, frozen_snapshot_id, version FROM method_sessions WHERE id = $1`, [
      originalSessionId,
    ]);
    const outputBefore = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [
      originalOutput.id,
    ]);

    // 'active' transition authority is owner|lead_assessor — OWNER holds both.
    const reopen = await transitionTo(originalSessionId, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    // The reopen transition response reports the ORIGINAL session (unchanged
    // by design — see MethodSessionService's header comment: no id of the
    // new revision is returned here, only discoverable via a fresh read).
    expect(reopen.body.session.id).toBe(originalSessionId);
    expect(reopen.body.session.state).toBe('frozen');

    const revisions = await pool.query(
      `SELECT id, state, revision_of_session_id, frozen_snapshot_id, version FROM method_sessions WHERE revision_of_session_id = $1`,
      [originalSessionId]
    );
    expect(revisions.rows).toHaveLength(1);
    const revision = revisions.rows[0];
    expect(revision.state).toBe('active');
    expect(revision.frozen_snapshot_id).toBeNull();
    expect(revision.version).toBe(1);

    const originalAfter = await pool.query(`SELECT state, frozen_snapshot_id, version FROM method_sessions WHERE id = $1`, [
      originalSessionId,
    ]);
    expect(originalAfter.rows[0]).toEqual(originalBefore.rows[0]);

    const outputAfter = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [
      originalOutput.id,
    ]);
    expect(outputAfter.rows[0].content_hash).toBe(outputBefore.rows[0].content_hash);

    // Store the revision id on the pool for step 9 via a query — instead we
    // just re-derive it the same way in the next test (independent test,
    // does its own full setup) to keep tests isolated from execution order.
  });

  // =========================================================================
  // 9. approval przez uprawnioną rolę (tylko approver) — on the CORRECTED
  //    revision, proving re-approval is required, never inherited.
  // =========================================================================
  it('9. freezing the corrected revision requires the approver role again; a non-approver is refused 403; the approver produces a LINKED Output revision', async () => {
    const { sessionId: originalSessionId, output: originalOutput } = await createFrozenSessionWithOutput();

    const reopen = await transitionTo(originalSessionId, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    const revisionRow = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [originalSessionId]
    );
    const revisionSessionId: string = revisionRow.rows[0].id;

    // Correction work happens on the NEW revision's own (empty) event log.
    await addEvidenceAndAnswer(revisionSessionId);
    await grantRole(revisionSessionId, OWNER, 'lead_assessor');
    for (const to of ['in_review']) {
      const res = await transitionTo(revisionSessionId, to, ownerToken);
      expect(res.status).toBe(200);
    }

    // OWNER holds owner+lead_assessor on the revision, deliberately NOT approver.
    const deniedFreeze = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/freeze`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    expect(deniedFreeze.status).toBe(403);
    expect(deniedFreeze.body.error).toBe('missing_permission');
    expect(deniedFreeze.body.requiredRole).toBe('approver');
    const stillInReview = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [revisionSessionId]);
    expect(stillInReview.rows[0].state).toBe('in_review');

    await grantRole(revisionSessionId, APPROVER, 'approver');
    const approvedFreeze = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    expect(approvedFreeze.status).toBe(200);
    const revisedOutput = approvedFreeze.body.output;

    // Real Output-to-Output lineage: the corrected revision's Output points
    // back at the original, and its version increments — proving "corrected
    // revision" produced a genuine new row in the SAME chain, not an
    // unrelated Output that merely shares a method pack.
    expect(revisedOutput.id).not.toBe(originalOutput.id);
    expect(revisedOutput.revisionOfOutputId).toBe(originalOutput.id);
    expect(revisedOutput.outputVersion).toBe(originalOutput.outputVersion + 1);
    expect(revisedOutput.sourceRevisionOfSessionId).toBe(originalSessionId);

    const isSuperseded = await request(app)
      .get(`/api/method/outputs/${originalOutput.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(isSuperseded.body.superseded).toBe(true);
    expect(isSuperseded.body.supersededByOutputId).toBe(revisedOutput.id);
  });

  // =========================================================================
  // 10. Report z approved Output
  // =========================================================================
  it('10. a Report Snapshot is built from the approver-frozen Output, with a server-computed hash', async () => {
    const { output } = await createFrozenSessionWithOutput();

    const content = {
      executiveSummary: `Zbudowane z zatwierdzonego Outputu ${output.id}`,
      findings: output.findings.map((f: { unitId: string; currentLevel: number | null }) => ({
        unitId: f.unitId,
        currentLevel: f.currentLevel,
      })),
    };
    const { computeContentHash } = await import('../db.js');
    const expectedHash = computeContentHash(content);

    const reportRes = await request(app)
      .post(`/api/method/outputs/${output.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'P0B report', content });

    expect(reportRes.status).toBe(201);
    expect(reportRes.body.report.outputId).toBe(output.id);
    expect(reportRes.body.report.contentHash).toBe(expectedHash);
    expect(reportRes.body.report.kind).toBe('report');
    expect(reportRes.body.report.status).toBe('current');
  });

  // =========================================================================
  // 11. Presentation z tego samego Artifact (ten sam snapshot, nie screenshot)
  // =========================================================================
  it('11. a Presentation renders from the SAME Output as the Report — same artefact, structured content, never an image', async () => {
    const { output } = await createFrozenSessionWithOutput();

    const reportContent = { executiveSummary: 'Report view', findings: output.findings.map((f: any) => f.unitId) };
    const reportRes = await request(app)
      .post(`/api/method/outputs/${output.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'P0B report (for presentation pairing)', content: reportContent });
    expect(reportRes.status).toBe(201);

    const presentationContent = {
      slides: [
        { title: 'Executive summary', body: `Output ${output.id}` },
        ...output.findings.map((f: any) => ({ title: f.unitId, body: f.businessMeaning })),
      ],
    };
    const presentationRes = await request(app)
      .post(`/api/method/outputs/${output.id}/presentation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'P0B presentation', content: presentationContent });

    expect(presentationRes.status).toBe(201);
    expect(presentationRes.body.report.outputId).toBe(output.id); // SAME Artifact/Output
    expect(presentationRes.body.report.kind).toBe('presentation');
    // Never a screenshot: content is structured JSON, not a data:/base64 image string.
    expect(typeof presentationRes.body.report.content).toBe('object');
    expect(JSON.stringify(presentationRes.body.report.content)).not.toMatch(/^"data:image/);

    const rows = await pool.query(
      `SELECT kind FROM method_report_snapshots WHERE output_id = $1 ORDER BY kind`,
      [output.id]
    );
    expect(rows.rows.map((r) => r.kind).sort()).toEqual(['presentation', 'report']);
  });

  // =========================================================================
  // 12. Initiative Proposal z approved Output
  // =========================================================================
  it('12. an Initiative Proposal Draft is created from the approved Output, structurally unable to become a Registered Initiative', async () => {
    const { output } = await createFrozenSessionWithOutput();
    const findingId = output.findings[0].id;

    const draftRes = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'P0B initiative draft',
        findingIds: [findingId],
        rationale: 'P0B test rationale',
        expectedOutcome: 'P0B test expected outcome',
        confidence: 'high',
      });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.draft.outputId).toBe(output.id);
    expect(draftRes.body.draft).not.toHaveProperty('initiativeId');
    expect(draftRes.body.draft).not.toHaveProperty('registeredInitiativeId');

    const registerAttempt = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts/${draftRes.body.draft.id}/register`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(registerAttempt.status).toBe(404);
  });

  // =========================================================================
  // 13. reopen wszystkich rezultatów
  // =========================================================================
  it('13. reopening + re-freezing supersedes the OLD Report/Presentation/Initiative Draft across the whole lineage, not just the newest session', async () => {
    const { sessionId: originalSessionId, output: outputA } = await createFrozenSessionWithOutput();

    const reportA = await request(app)
      .post(`/api/method/outputs/${outputA.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Report on A', content: { v: 'A' } });
    expect(reportA.status).toBe(201);

    const draftA = await request(app)
      .post(`/api/method/outputs/${outputA.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Draft on A',
        findingIds: [outputA.findings[0].id],
        rationale: 'r',
        expectedOutcome: 'e',
        confidence: 'low',
      });
    expect(draftA.status).toBe(201);

    // Reopen -> correct -> re-approve -> Output B (revisionOfOutputId = A).
    const reopen = await transitionTo(originalSessionId, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    const revisionRow = await pool.query(`SELECT id FROM method_sessions WHERE revision_of_session_id = $1`, [
      originalSessionId,
    ]);
    const revisionSessionId: string = revisionRow.rows[0].id;
    await addEvidenceAndAnswer(revisionSessionId);
    await grantRole(revisionSessionId, OWNER, 'lead_assessor');
    await grantRole(revisionSessionId, APPROVER, 'approver');
    await transitionTo(revisionSessionId, 'in_review', ownerToken);
    const freezeB = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    expect(freezeB.status).toBe(200);
    const outputB = freezeB.body.output;
    expect(outputB.revisionOfOutputId).toBe(outputA.id);

    // A fresh Report against B must supersede A's report/draft, EVEN THOUGH
    // reportA/draftA belong to `originalSessionId`, not `revisionSessionId`.
    const reportB = await request(app)
      .post(`/api/method/outputs/${outputB.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Report on B (corrected)', content: { v: 'B' } });
    expect(reportB.status).toBe(201);

    const reportARow = await pool.query(
      `SELECT status, superseded_by_output_id FROM method_report_snapshots WHERE id = $1`,
      [reportA.body.report.id]
    );
    expect(reportARow.rows[0].status).toBe('superseded');
    expect(reportARow.rows[0].superseded_by_output_id).toBe(outputB.id);

    const draftARow = await pool.query(
      `SELECT status, superseded_by_output_id FROM method_initiative_drafts WHERE id = $1`,
      [draftA.body.draft.id]
    );
    expect(draftARow.rows[0].status).toBe('superseded');
    expect(draftARow.rows[0].superseded_by_output_id).toBe(outputB.id);

    // reportB itself is untouched (belongs to the NEW output, not superseded by itself).
    const reportBRow = await pool.query(`SELECT status FROM method_report_snapshots WHERE id = $1`, [
      reportB.body.report.id,
    ]);
    expect(reportBRow.rows[0].status).toBe('current');
  });

  // =========================================================================
  // 14. cross-org i unauthorized rejection na powyższych
  // =========================================================================
  describe('14. cross-org and unauthorized rejection', () => {
    it('14a. freeze: no Authorization header -> 401; wrong org -> 403, session untouched', async () => {
      const createRes = await createSession(ownerToken);
      const sessionId = createRes.body.session.id;
      await driveToInReview(sessionId);
      await grantRole(sessionId, APPROVER, 'approver');

      const noAuth = await request(app)
        .post(`/api/method/sessions/${sessionId}/freeze`)
        .set('Idempotency-Key', `freeze:${randomUUID()}`)
        .send({});
      expect(noAuth.status).toBe(401);

      const crossOrg = await request(app)
        .post(`/api/method/sessions/${sessionId}/freeze`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .set('Idempotency-Key', `freeze:${randomUUID()}`)
        .send({});
      expect(crossOrg.status).toBe(403);

      const stillInReview = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
      expect(stillInReview.rows[0].state).toBe('in_review');
    });

    it('14b. Output read: no Authorization -> 401; wrong org -> 404 (never leaks existence)', async () => {
      const { output } = await createFrozenSessionWithOutput();

      const noAuth = await request(app).get(`/api/method/outputs/${output.id}`);
      expect(noAuth.status).toBe(401);

      const crossOrg = await request(app)
        .get(`/api/method/outputs/${output.id}`)
        .set('Authorization', `Bearer ${otherOrgToken}`);
      expect(crossOrg.status).toBe(404);
      expect(crossOrg.body.output).toBeUndefined();
    });

    it('14c. Report/Presentation/Initiative-draft creation: wrong org -> 404 (Output invisible), no Authorization -> 401', async () => {
      const { output } = await createFrozenSessionWithOutput();

      for (const path of ['report', 'presentation'] as const) {
        const noAuth = await request(app)
          .post(`/api/method/outputs/${output.id}/${path}`)
          .send({ title: 't', content: {} });
        expect(noAuth.status).toBe(401);

        const crossOrg = await request(app)
          .post(`/api/method/outputs/${output.id}/${path}`)
          .set('Authorization', `Bearer ${otherOrgToken}`)
          .send({ title: 't', content: {} });
        expect(crossOrg.status).toBe(404);
      }

      const crossOrgDraft = await request(app)
        .post(`/api/method/outputs/${output.id}/initiative-drafts`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .send({
          title: 't',
          findingIds: [output.findings[0].id],
          rationale: 'r',
          expectedOutcome: 'e',
          confidence: 'low',
        });
      expect(crossOrgDraft.status).toBe(404);

      const reportRows = await pool.query(`SELECT id FROM method_report_snapshots WHERE output_id = $1`, [output.id]);
      expect(reportRows.rows).toHaveLength(0);
    });

    it('14d. reopen (frozen -> active) transition: wrong org -> 403, no revision row created', async () => {
      const { sessionId } = await createFrozenSessionWithOutput();

      const crossOrg = await request(app)
        .post(`/api/method/sessions/${sessionId}/transition`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .set('Idempotency-Key', `transition:${randomUUID()}`)
        .send({ to: 'active' });
      expect(crossOrg.status).toBe(403);

      const revisions = await pool.query(`SELECT id FROM method_sessions WHERE revision_of_session_id = $1`, [
        sessionId,
      ]);
      expect(revisions.rows).toHaveLength(0);
    });
  });

  // =========================================================================
  // 15. awaria pomiędzy freeze a Output — symuluj przerwanie
  // =========================================================================
  it('15. an interruption between freeze (snapshot durable) and Output (never written) self-heals on the next freeze call', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionId);

    // Write EXACTLY the state a crash between snapshotOnFreeze's two halves
    // would leave: state='frozen', frozen_snapshot_id set, but no Output row
    // — written directly via SQL (the one window a route-level test cannot
    // otherwise reach deterministically).
    const snapshotId = randomUUID();
    await pool.query(
      `INSERT INTO method_snapshots (id, organization_id, session_id, method_pack_version, payload_json, content_hash, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
      [snapshotId, ORG, sessionId, PACK_VERSION, JSON.stringify({ interrupted: true }), 'p0b-interrupted-hash']
    );
    await pool.query(
      `UPDATE method_sessions SET state = 'frozen', frozen_snapshot_id = $1, version = version + 1 WHERE id = $2`,
      [snapshotId, sessionId]
    );

    const preOutputs = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(preOutputs.rows).toHaveLength(0); // confirms the interruption is real

    const heal = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-heal:${randomUUID()}`)
      .send({});
    expect(heal.status).toBe(200);
    expect(heal.body.selfHealed).toBe(true);
    expect(heal.body.output).toBeTruthy();

    const postOutputs = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(postOutputs.rows).toHaveLength(1);
  });

  // =========================================================================
  // 16. bezpieczny retry bez duplikatu po tej awarii
  // =========================================================================
  it('16. retrying freeze again after the self-heal is safe: still one Output, same id', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionId);

    const snapshotId = randomUUID();
    await pool.query(
      `INSERT INTO method_snapshots (id, organization_id, session_id, method_pack_version, payload_json, content_hash, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
      [snapshotId, ORG, sessionId, PACK_VERSION, JSON.stringify({ interrupted: true }), 'p0b-interrupted-hash-2']
    );
    await pool.query(
      `UPDATE method_sessions SET state = 'frozen', frozen_snapshot_id = $1, version = version + 1 WHERE id = $2`,
      [snapshotId, sessionId]
    );

    const heal = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-heal:${randomUUID()}`)
      .send({});
    expect(heal.status).toBe(200);
    const healedOutputId = heal.body.output.id;

    for (let i = 0; i < 3; i++) {
      const retry = await request(app)
        .post(`/api/method/sessions/${sessionId}/freeze`)
        .set('Authorization', `Bearer ${approverToken}`)
        .set('Idempotency-Key', `freeze-heal-retry-${i}:${randomUUID()}`)
        .send({});
      expect(retry.status).toBe(200);
      expect(retry.body.output.id).toBe(healedOutputId);
      expect(retry.body.selfHealed).toBe(false);
    }

    const rows = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(rows.rows).toHaveLength(1);
  });

  // =========================================================================
  // ★ methodology_review pack rules — demo bypass discipline
  // =========================================================================
  describe('★ demo bypass discipline (methodology_review pack)', () => {
    it('production always refuses session start against methodology_review — no HTTP path bypasses this', async () => {
      const { isDemoBypassAllowed } = await import('../demoBypass.js');
      expect(
        isDemoBypassAllowed({ NODE_ENV: 'production', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, true)
      ).toBe(false);
    });

    it('demo bypass does NOT change method_packs.readiness, before or after the whole freeze->Output->Report flow', async () => {
      const priorFlag = process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
      process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = 'true';
      try {
        const createRes = await createSession(ownerToken, { methodPackId: REVIEW_PACK_ID, demoBypass: true });
        expect(createRes.status).toBe(201);
        expect(createRes.body.demoBypassActive).toBe(true);
        const sessionId = createRes.body.session.id;

        const readinessBefore = await pool.query(
          `SELECT readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
          [ORG, REVIEW_PACK_ID, PACK_VERSION]
        );
        expect(readinessBefore.rows[0].readiness).toBe('methodology_review');

        await driveToInReview(sessionId);
        await grantRole(sessionId, APPROVER, 'approver');
        await addEvidenceAndAnswer(sessionId);
        const freeze = await request(app)
          .post(`/api/method/sessions/${sessionId}/freeze`)
          .set('Authorization', `Bearer ${approverToken}`)
          .set('Idempotency-Key', `freeze:${randomUUID()}`)
          .send({});
        expect(freeze.status).toBe(200);
        const output = freeze.body.output;

        const reportRes = await request(app)
          .post(`/api/method/outputs/${output.id}/report`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: 'demo report', content: { demo: true } });
        expect(reportRes.status).toBe(201);

        const readinessAfter = await pool.query(
          `SELECT readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
          [ORG, REVIEW_PACK_ID, PACK_VERSION]
        );
        expect(readinessAfter.rows[0].readiness).toBe('methodology_review');
      } finally {
        if (priorFlag === undefined) delete process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
        else process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = priorFlag;
      }
    });

    it('a demo-bypassed Output and its Report carry an explicit, visible demonstration marker — never indistinguishable from production', async () => {
      const priorFlag = process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
      process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = 'true';
      try {
        const createRes = await createSession(ownerToken, { methodPackId: REVIEW_PACK_ID, demoBypass: true });
        const sessionId = createRes.body.session.id;
        await driveToInReview(sessionId);
        await grantRole(sessionId, APPROVER, 'approver');
        await addEvidenceAndAnswer(sessionId);
        const freeze = await request(app)
          .post(`/api/method/sessions/${sessionId}/freeze`)
          .set('Authorization', `Bearer ${approverToken}`)
          .set('Idempotency-Key', `freeze:${randomUUID()}`)
          .send({});
        expect(freeze.status).toBe(200);
        const output = freeze.body.output;

        // Machine-readable field, visible on the freeze response...
        expect(output.demoBypassActive).toBe(true);
        // ...AND durable in the database (not just a transient response shape)...
        const outputRow = await pool.query(`SELECT demo_bypass_active FROM method_outputs WHERE id = $1`, [output.id]);
        expect(outputRow.rows[0].demo_bypass_active).toBe(true);
        // ...AND human-readable inside the Output's own required `limitations`.
        expect(output.limitations.some((l: string) => l.includes('demo bypass'))).toBe(true);

        // Re-reading the Output over HTTP (not just the freeze response) still shows it.
        const getOutput = await request(app)
          .get(`/api/method/outputs/${output.id}`)
          .set('Authorization', `Bearer ${ownerToken}`);
        expect(getOutput.body.output.demoBypassActive).toBe(true);

        const reportRes = await request(app)
          .post(`/api/method/outputs/${output.id}/report`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: 'demo report', content: { demo: true } });
        expect(reportRes.status).toBe(201);
        expect(reportRes.body.report.demoBypassActive).toBe(true);
        expect(reportRes.body.demoBypassActive).toBe(true);
        expect(typeof reportRes.body.demoBypassNotice).toBe('string');

        const reportRow = await pool.query(`SELECT demo_bypass_active FROM method_report_snapshots WHERE id = $1`, [
          reportRes.body.report.id,
        ]);
        expect(reportRow.rows[0].demo_bypass_active).toBe(true);
      } finally {
        if (priorFlag === undefined) delete process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
        else process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = priorFlag;
      }
    });

    it('a PRODUCTION Output (no demo bypass) carries demoBypassActive: false — the marker is never "on" by default', async () => {
      const { output } = await createFrozenSessionWithOutput();
      expect(output.demoBypassActive).toBe(false);
      expect(output.limitations.some((l: string) => l.includes('demo bypass'))).toBe(false);
    });

    it('demo bypass never produces a released/pilot pack: no HTTP path exists to flip method_packs.readiness at all', async () => {
      // Structural proof, mirroring the "no register route" pattern: a
      // plausible "approve/release pack" endpoint simply does not exist on
      // this router — grep-level proof that no code path here issues an
      // UPDATE method_packs ... SET readiness, demo or not.
      const attempt1 = await request(app)
        .post(`/api/method/packs/${REVIEW_PACK_ID}/release`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({});
      expect(attempt1.status).toBe(404);
      const attempt2 = await request(app)
        .post(`/api/method/packs/${REVIEW_PACK_ID}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({});
      expect(attempt2.status).toBe(404);
    });
  });
});
