/**
 * @vitest-environment node
 *
 * Shared Method Kernel — HTTP surface, real PostgreSQL (P0, 2026-08-13).
 *
 * Proves `server/src/routes/method-core.routes.ts` end-to-end against the
 * disposable Postgres at localhost:55440 (NOT a mock, NOT sqlite) with the
 * REAL `verifyToken` middleware (no auth mock) verifying REAL signed JWTs
 * against REAL seeded `users`/`organizations` rows — mirroring the proven
 * pattern in `server/src/controllers/__tests__/superadminMfaMethods.pg.test.ts`.
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://mac:mac@localhost:55440/mac_test" \
 *   npx vitest run server/src/method-core
 *
 * `describe.skipIf(!REAL_DB)` — this suite is a structural no-op (all cases
 * report "skipped", not "passed") unless RUN_DB_TESTS=1 and a postgres
 * DATABASE_URL are both present, matching the repo's `.pg.test.ts` convention.
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

describe.skipIf(!REAL_DB)('Method Kernel HTTP surface — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-p0-${SUFFIX}`;
  const OTHER_ORG = `org-p0-other-${SUFFIX}`;
  const OWNER = `user-p0-owner-${SUFFIX}`;
  const APPROVER = `user-p0-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-p0-otherorg-${SUFFIX}`;

  const PACK_ID = `p0-test-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';
  const REVIEW_PACK_ID = `p0-review-pack-${SUFFIX}`; // stays 'methodology_review' throughout

  let ownerToken = '';
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
      'P0 method-core HTTP test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'P0 method-core HTTP test org (other tenant)',
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
      name: 'P0 test pack (released)',
      readiness: 'released',
    });
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: REVIEW_PACK_ID,
      version: PACK_VERSION,
      name: 'P0 test pack (methodology_review — never released by this suite)',
      readiness: 'methodology_review',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    // Additive-only cleanup, cascading from organizations (every method_* FK
    // is ON DELETE CASCADE — see server/migrations/20260813_method_core_kernel.sql
    // and .../20260813_method_outputs.sql). users.organization_id has NO
    // cascade, so users must go first or the organizations DELETE 23503s.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(token: string, overrides: Record<string, unknown> = {}) {
    const idemKey = `create:${randomUUID()}`;
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({
        module: 'assessment',
        methodPackId: PACK_ID,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
        ...overrides,
      });
    return res;
  }

  async function driveToInReview(sessionId: string): Promise<void> {
    // OWNER already holds 'owner' (auto-assigned on create). 'in_review'
    // requires lead_assessor|assessor — grant it directly (role assignment
    // is not one of the 12 HTTP endpoints in scope; a real deployment wires
    // this from project/team roles, out of this kernel's reach by design).
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'lead_assessor', now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, OWNER]
    );
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

  // ---------------------------------------------------------------------------
  // 1. create -> resume: session read from DB
  // ---------------------------------------------------------------------------
  it('1. create -> resume: the resumed session is read back from the database', async () => {
    const createRes = await createSession(ownerToken);
    expect(createRes.status).toBe(201);
    const sessionId = createRes.body.session.id;

    const row = await pool.query(`SELECT * FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].organization_id).toBe(ORG);
    expect(row.rows[0].state).toBe('draft');

    const resumeRes = await request(app)
      .get(`/api/method/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.session.id).toBe(sessionId);
    expect(resumeRes.body.session.state).toBe('draft');
    expect(resumeRes.body.roles).toContain('owner');
  });

  // ---------------------------------------------------------------------------
  // 2. append 2x same Idempotency-Key -> 1 event
  // ---------------------------------------------------------------------------
  it('2. appending the same event twice with the same Idempotency-Key produces exactly ONE row', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    const idemKey = `append:${randomUUID()}`;

    const first = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed', text: 'yes' },
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed', text: 'yes' },
      });
    expect(second.status).toBe(201);
    expect(second.body.event.id).toBe(first.body.event.id);

    const rows = await pool.query(
      `SELECT id FROM method_events WHERE session_id = $1 AND idempotency_key = $2`,
      [sessionId, idemKey]
    );
    expect(rows.rows).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 3. stale version -> 409, zero write
  // ---------------------------------------------------------------------------
  it('3. a transition with a stale expectedVersion is refused with 409 and writes nothing', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    expect(createRes.body.session.version).toBe(1);

    const before = await pool.query(`SELECT version, state, updated_at FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `transition:${randomUUID()}`)
      .send({ to: 'prepared', expectedVersion: 999 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('version_conflict');
    expect(res.body.currentVersion).toBe(1);

    const after = await pool.query(`SELECT version, state, updated_at FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  // ---------------------------------------------------------------------------
  // 4. freeze -> Output; retry freeze -> SAME Output, not a second one
  // ---------------------------------------------------------------------------
  it('4. freeze creates an Output; retrying freeze with the same key returns the SAME Output', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);

    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
    // Give the finding a supporting-evidence event so the derived Output has
    // >= 1 finding (MethodOutputService.validateFreezeInput requirement).
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

    const freezeKey = `freeze:${randomUUID()}`;
    const first = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', freezeKey)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.output).toBeTruthy();
    const outputId = first.body.output.id;

    const second = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', freezeKey)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.output.id).toBe(outputId);

    const rows = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(rows.rows).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 5. role without approver -> freeze refused
  // ---------------------------------------------------------------------------
  it('5. an actor without the approver role is refused a freeze (403)', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    // OWNER holds owner + lead_assessor, deliberately NOT approver.

    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('missing_permission');
    expect(res.body.requiredRole).toBe('approver');

    const stillInReview = await pool.query(`SELECT state FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(stillInReview.rows[0].state).toBe('in_review');
  });

  // ---------------------------------------------------------------------------
  // 6. cross-org session read refused
  // ---------------------------------------------------------------------------
  it('6. a different organization cannot read this session (403), no data leaked', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;

    const res = await request(app)
      .get(`/api/method/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(403);
    expect(res.body.session).toBeUndefined();

    const eventsRes = await request(app)
      .get(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(eventsRes.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // 7. no auth -> 401
  // ---------------------------------------------------------------------------
  it('7. a request with no Authorization header is refused with 401', async () => {
    const res = await request(app).get('/api/method/packs');
    expect(res.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // 8. Output is not modifiable through the API
  // ---------------------------------------------------------------------------
  it('8. the Output resource has no mutating route at all (PUT/PATCH/DELETE all 404)', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
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
    const outputId = freeze.body.output.id;

    const put = await request(app)
      .put(`/api/method/outputs/${outputId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scope: 'MUTATED' });
    const patch = await request(app)
      .patch(`/api/method/outputs/${outputId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ scope: 'MUTATED' });
    const del = await request(app).delete(`/api/method/outputs/${outputId}`).set('Authorization', `Bearer ${ownerToken}`);

    expect(put.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);

    const unchanged = await pool.query(`SELECT scope FROM method_outputs WHERE id = $1`, [outputId]);
    expect(unchanged.rows[0].scope).not.toBe('MUTATED');
  });

  // ---------------------------------------------------------------------------
  // 9. Report is rendered from the snapshot (real Output data, hash proven)
  // ---------------------------------------------------------------------------
  it('9. a Report Snapshot is built from the real frozen Output, with a server-computed hash', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
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
    const output = freeze.body.output;

    const outputRes = await request(app)
      .get(`/api/method/outputs/${output.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(outputRes.status).toBe(200);

    const content = {
      executiveSummary: `Zbudowane z Outputu ${outputRes.body.output.id}`,
      findings: outputRes.body.output.findings.map((f: { unitId: string; currentLevel: number | null }) => ({
        unitId: f.unitId,
        currentLevel: f.currentLevel,
      })),
    };

    const { computeContentHash } = await import('../db.js');
    const expectedHash = computeContentHash(content);

    const reportRes = await request(app)
      .post(`/api/method/outputs/${output.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'P0 test report', content });

    expect(reportRes.status).toBe(201);
    expect(reportRes.body.report.outputId).toBe(output.id);
    expect(reportRes.body.report.sessionId).toBe(sessionId);
    expect(reportRes.body.report.contentHash).toBe(expectedHash);
  });

  // ---------------------------------------------------------------------------
  // 10. Initiative Draft has no path to Registered
  // ---------------------------------------------------------------------------
  it('10. an Initiative Proposal Draft has structurally no path to a Registered Initiative', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
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
    const output = freeze.body.output;
    const findingId = output.findings[0].id;

    const draftRes = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Domknięcie luki 1A',
        findingIds: [findingId],
        rationale: 'test rationale',
        expectedOutcome: 'test expected outcome',
        confidence: 'medium',
      });
    expect(draftRes.status).toBe(201);
    expect(draftRes.body.draft).not.toHaveProperty('initiativeId');
    expect(draftRes.body.draft).not.toHaveProperty('registeredInitiativeId');

    // Structural proof at the schema level, not just "the JSON happens to lack a field".
    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'method_initiative_drafts'`
    );
    const columnNames = columns.rows.map((r) => r.column_name);
    expect(columnNames).not.toContain('initiative_id');
    expect(columnNames).not.toContain('registered_initiative_id');

    // No such route exists at all — a plausible "register" endpoint 404s.
    const registerAttempt = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts/${draftRes.body.draft.id}/register`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(registerAttempt.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 11. interruption between freeze and Output -> retry without a duplicate
  // ---------------------------------------------------------------------------
  it('11. an interruption between freeze and Output self-heals on retry without creating a duplicate Output', async () => {
    const createRes = await createSession(ownerToken);
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now()) ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({ type: 'EVIDENCE_ATTACHED', unitId: '1A', payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' } });

    // Simulate the EXACT interruption window documented in
    // EventDerivedOutputBridge's header comment: the freeze snapshot is
    // already durable (state='frozen', frozen_snapshot_id set) but the
    // process died before onSessionFrozen -> freezeOutput ran. Written
    // directly via SQL (not through the HTTP freeze handler) — this is the
    // one scenario a route-level test cannot otherwise reach deterministically.
    const snapshotId = randomUUID();
    await pool.query(
      `INSERT INTO method_snapshots (id, organization_id, session_id, method_pack_version, payload_json, content_hash, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())`,
      [snapshotId, ORG, sessionId, PACK_VERSION, JSON.stringify({ interrupted: true }), 'interrupted-test-hash']
    );
    await pool.query(
      `UPDATE method_sessions SET state = 'frozen', frozen_snapshot_id = $1, version = version + 1 WHERE id = $2`,
      [snapshotId, sessionId]
    );

    const preOutputs = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(preOutputs.rows).toHaveLength(0); // confirms the interruption is real: no Output yet

    const first = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-heal:${randomUUID()}`)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.selfHealed).toBe(true);
    expect(first.body.output).toBeTruthy();
    const healedOutputId = first.body.output.id;

    const second = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-heal-retry:${randomUUID()}`)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.output.id).toBe(healedOutputId);

    const rows = await pool.query(`SELECT id FROM method_outputs WHERE session_id = $1`, [sessionId]);
    expect(rows.rows).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 12. production config rejects demo bypass
  // ---------------------------------------------------------------------------
  it('12a. isDemoBypassAllowed refuses unconditionally when NODE_ENV=production, regardless of the operator flag or the request', async () => {
    const { isDemoBypassAllowed } = await import('../demoBypass.js');

    // A prod deploy with the operator flag on AND the client explicitly
    // asking for bypass is STILL refused — the environment check is not
    // overridable by any flag or any request body.
    expect(
      isDemoBypassAllowed({ NODE_ENV: 'production', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, true)
    ).toBe(false);
    expect(isDemoBypassAllowed({ NODE_ENV: 'production' }, true)).toBe(false);

    // Non-prod + operator flag on + client requested -> allowed.
    expect(isDemoBypassAllowed({ NODE_ENV: 'test', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, true)).toBe(
      true
    );
    // Non-prod but operator flag OFF (unset) -> refused (default OFF).
    expect(isDemoBypassAllowed({ NODE_ENV: 'test' }, true)).toBe(false);
    // Non-prod + operator flag on but client did NOT ask for it -> refused.
    expect(
      isDemoBypassAllowed({ NODE_ENV: 'test', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, false)
    ).toBe(false);
  });

  it('12b. HTTP: without bypass, creating a session against a methodology_review pack is refused (422) and the pack readiness is never touched', async () => {
    const res = await createSession(ownerToken, { methodPackId: REVIEW_PACK_ID, demoBypass: false });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pack_not_released');

    const pack = await pool.query(
      `SELECT readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
      [ORG, REVIEW_PACK_ID, PACK_VERSION]
    );
    expect(pack.rows[0].readiness).toBe('methodology_review');
  });

  it('12c. HTTP: WITH the operator flag explicitly on (this non-prod test env) and an explicit client request, bypass creates a session — and still never rewrites pack readiness', async () => {
    const priorFlag = process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
    process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = 'true';
    try {
      const res = await createSession(ownerToken, { methodPackId: REVIEW_PACK_ID, demoBypass: true });
      expect(res.status).toBe(201);
      expect(res.body.demoBypassActive).toBe(true);
      expect(typeof res.body.demoBypassNotice).toBe('string');

      const pack = await pool.query(
        `SELECT readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
        [ORG, REVIEW_PACK_ID, PACK_VERSION]
      );
      expect(pack.rows[0].readiness).toBe('methodology_review');
    } finally {
      if (priorFlag === undefined) delete process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
      else process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = priorFlag;
    }
  });
});
