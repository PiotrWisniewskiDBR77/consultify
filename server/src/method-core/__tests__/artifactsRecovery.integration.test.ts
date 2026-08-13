/**
 * @vitest-environment node
 *
 * S1 — artifacts-after-restart recovery surface (CEL 2, 2026-08-13).
 *
 * Covers the 9 new read-only GET endpoints added to
 * `server/src/routes/method-core.routes.ts`:
 *   GET /sessions/:id/outputs
 *   GET /outputs/:id/revisions
 *   GET /sessions/:id/reports
 *   GET /sessions/:id/presentations
 *   GET /sessions/:id/initiative-drafts
 *   GET /reports/:id
 *   GET /presentations/:id
 *   GET /initiative-drafts/:id
 *   GET /sessions/:id/lineage
 *
 * Same pattern as `freezeOutputFlow.integration.test.ts` (real PostgreSQL,
 * real signed JWTs, real `verifyToken` middleware) — this file is scoped to
 * the RECOVERY read surface: after a session is frozen, reopened and
 * re-frozen (a real "restart and come back" scenario), can a caller find
 * every Output/Report/Presentation/Initiative Draft across the WHOLE
 * lineage, deterministically, paginated, tenant-isolated, auth-gated?
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://t:t@localhost:55495/t_test" \
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

describe.skipIf(!REAL_DB)('S1 — artifacts recovery surface (real PostgreSQL)', () => {
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
  const ORG = `org-s1-${SUFFIX}`;
  const OTHER_ORG = `org-s1-other-${SUFFIX}`;
  const OWNER = `user-s1-owner-${SUFFIX}`; // owner + lead_assessor
  const APPROVER = `user-s1-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s1-otherorg-${SUFFIX}`;

  const PACK_ID = `s1-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

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
      'S1 artifacts recovery test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S1 artifacts recovery test org (other tenant)',
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
      name: 'S1 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
    httpServer = app.listen(0);
  });

  afterAll(async () => {

    await new Promise<void>((r) => httpServer.close(() => r()));
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(token: string): Promise<{ status: number; body: any }> {
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

  async function transitionTo(sessionId: string, to: string, token: string) {
    return request(httpServer)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
      .send({ to });
  }

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
    const evidence = await request(httpServer)
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
    const answer = await request(httpServer)
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

  async function freezeSession(sessionId: string, token: string): Promise<any> {
    const res = await request(httpServer)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (res.status !== 200) {
      throw new Error(`freezeSession: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  /** Full lineage: sessionA -> freeze -> outputA (v1) -> report/presentation/
   * draft on A -> reopen -> sessionB -> freeze -> outputB (v2, revision of A,
   * supersedes A's report/presentation/draft) -> fresh report/presentation/
   * draft on B. Returns every id a test might want to assert against. */
  async function buildTwoVersionLineage() {
    const createRes = await createSession(ownerToken);
    const sessionA = createRes.body.session.id;
    await driveToInReview(sessionA);
    await grantRole(sessionA, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionA);
    const freezeA = await freezeSession(sessionA, approverToken);
    const outputA = freezeA.output;

    const reportA = await request(httpServer)
      .post(`/api/method/outputs/${outputA.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Report on A', content: { v: 'A' } });
    expect(reportA.status).toBe(201);

    const presentationA = await request(httpServer)
      .post(`/api/method/outputs/${outputA.id}/presentation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Presentation on A', content: { slides: [{ title: 'A' }] } });
    expect(presentationA.status).toBe(201);

    const draftA = await request(httpServer)
      .post(`/api/method/outputs/${outputA.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Draft on A',
        findingIds: [outputA.findings[0].id],
        rationale: 'r-A',
        expectedOutcome: 'e-A',
        confidence: 'low',
      });
    expect(draftA.status).toBe(201);

    const reopen = await transitionTo(sessionA, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    const revisionRow = await pool.query(`SELECT id FROM method_sessions WHERE revision_of_session_id = $1`, [
      sessionA,
    ]);
    const sessionB: string = revisionRow.rows[0].id;
    await addEvidenceAndAnswer(sessionB, '1B');
    await grantRole(sessionB, OWNER, 'lead_assessor');
    await grantRole(sessionB, APPROVER, 'approver');
    await transitionTo(sessionB, 'in_review', ownerToken);
    const freezeB = await freezeSession(sessionB, approverToken);
    const outputB = freezeB.output;
    expect(outputB.revisionOfOutputId).toBe(outputA.id);

    const reportB = await request(httpServer)
      .post(`/api/method/outputs/${outputB.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Report on B (corrected)', content: { v: 'B' } });
    expect(reportB.status).toBe(201);

    const presentationB = await request(httpServer)
      .post(`/api/method/outputs/${outputB.id}/presentation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Presentation on B (corrected)', content: { slides: [{ title: 'B' }] } });
    expect(presentationB.status).toBe(201);

    const draftB = await request(httpServer)
      .post(`/api/method/outputs/${outputB.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Draft on B',
        findingIds: [outputB.findings[0].id],
        rationale: 'r-B',
        expectedOutcome: 'e-B',
        confidence: 'high',
      });
    expect(draftB.status).toBe(201);

    return {
      sessionA,
      sessionB,
      outputA,
      outputB,
      reportA: reportA.body.report,
      reportB: reportB.body.report,
      presentationA: presentationA.body.report,
      presentationB: presentationB.body.report,
      draftA: draftA.body.draft,
      draftB: draftB.body.draft,
    };
  }

  // =========================================================================
  // 1. Outputs list: v1 after freeze; v1+v2 with correct current/superseded
  //    after reopen+freeze — queried from EITHER session id in the lineage.
  // =========================================================================
  it('1. GET /sessions/:id/outputs returns v1 alone after first freeze, then v1+v2 (current/superseded) after reopen+refreeze', async () => {
    const createRes = await createSession(ownerToken);
    const sessionA = createRes.body.session.id;
    await driveToInReview(sessionA);
    await grantRole(sessionA, APPROVER, 'approver');
    await addEvidenceAndAnswer(sessionA);
    const freezeA = await freezeSession(sessionA, approverToken);
    const outputA = freezeA.output;

    const afterFirstFreeze = await request(httpServer)
      .get(`/api/method/sessions/${sessionA}/outputs`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(afterFirstFreeze.status).toBe(200);
    expect(afterFirstFreeze.body.outputs).toHaveLength(1);
    expect(afterFirstFreeze.body.outputs[0].id).toBe(outputA.id);
    expect(afterFirstFreeze.body.outputs[0].outputVersion).toBe(1);
    expect(afterFirstFreeze.body.outputs[0].status).toBe('current');
    expect(afterFirstFreeze.body.outputs[0].supersededByOutputId).toBeNull();
    expect(afterFirstFreeze.body.total).toBe(1);

    const reopen = await transitionTo(sessionA, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    const revisionRow = await pool.query(`SELECT id FROM method_sessions WHERE revision_of_session_id = $1`, [
      sessionA,
    ]);
    const sessionB: string = revisionRow.rows[0].id;
    await addEvidenceAndAnswer(sessionB, '1B');
    await grantRole(sessionB, OWNER, 'lead_assessor');
    await grantRole(sessionB, APPROVER, 'approver');
    await transitionTo(sessionB, 'in_review', ownerToken);
    const freezeB = await freezeSession(sessionB, approverToken);
    const outputB = freezeB.output;

    for (const queryFrom of [sessionA, sessionB]) {
      const afterReopen = await request(httpServer)
        .get(`/api/method/sessions/${queryFrom}/outputs`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(afterReopen.status).toBe(200);
      expect(afterReopen.body.total).toBe(2);
      const byId: Record<string, any> = Object.fromEntries(
        afterReopen.body.outputs.map((o: any) => [o.id, o])
      );
      expect(byId[outputA.id].status).toBe('superseded');
      expect(byId[outputA.id].supersededByOutputId).toBe(outputB.id);
      expect(byId[outputB.id].status).toBe('current');
      expect(byId[outputB.id].supersededByOutputId).toBeNull();
      // deterministic version order
      expect(afterReopen.body.outputs.map((o: any) => o.outputVersion)).toEqual([1, 2]);
    }
  });

  // =========================================================================
  // 2. Revisions chain in version order
  // =========================================================================
  it('2. GET /outputs/:id/revisions returns the chain in version order, from either end', async () => {
    const { outputA, outputB } = await buildTwoVersionLineage();

    for (const fromId of [outputA.id, outputB.id]) {
      const res = await request(httpServer)
        .get(`/api/method/outputs/${fromId}/revisions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.revisions.map((r: any) => r.outputVersion)).toEqual([1, 2]);
      expect(res.body.revisions[0].id).toBe(outputA.id);
      expect(res.body.revisions[1].id).toBe(outputB.id);
      expect(res.body.total).toBe(2);
    }
  });

  // =========================================================================
  // 3. Determinism — two calls, identical order, on every list endpoint
  // =========================================================================
  it('3. every list endpoint is deterministic across repeated calls', async () => {
    const lineage = await buildTwoVersionLineage();

    const endpoints = [
      `/api/method/sessions/${lineage.sessionA}/outputs`,
      `/api/method/outputs/${lineage.outputA.id}/revisions`,
      `/api/method/sessions/${lineage.sessionA}/reports`,
      `/api/method/sessions/${lineage.sessionA}/presentations`,
      `/api/method/sessions/${lineage.sessionA}/initiative-drafts`,
    ];

    for (const path of endpoints) {
      const first = await request(httpServer).get(path).set('Authorization', `Bearer ${ownerToken}`);
      const second = await request(httpServer).get(path).set('Authorization', `Bearer ${ownerToken}`);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
    }
  });

  // =========================================================================
  // 4. Pagination — limit=1&offset=1 returns the second element + total
  // =========================================================================
  it('4. pagination: limit=1&offset=1 returns the second element and the correct total', async () => {
    const lineage = await buildTwoVersionLineage();

    const full = await request(httpServer)
      .get(`/api/method/sessions/${lineage.sessionA}/outputs`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(full.body.total).toBe(2);
    const secondFromFull = full.body.outputs[1];

    const paged = await request(httpServer)
      .get(`/api/method/sessions/${lineage.sessionA}/outputs?limit=1&offset=1`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(paged.status).toBe(200);
    expect(paged.body.outputs).toHaveLength(1);
    expect(paged.body.outputs[0].id).toBe(secondFromFull.id);
    expect(paged.body.total).toBe(2);
    expect(paged.body.limit).toBe(1);
    expect(paged.body.offset).toBe(1);
  });

  // =========================================================================
  // 5. Cross-org -> 404 on every endpoint
  // =========================================================================
  it('5. cross-org access reads as 404 on every S1 endpoint', async () => {
    const lineage = await buildTwoVersionLineage();

    const getPaths = [
      `/api/method/sessions/${lineage.sessionA}/outputs`,
      `/api/method/outputs/${lineage.outputA.id}/revisions`,
      `/api/method/sessions/${lineage.sessionA}/reports`,
      `/api/method/sessions/${lineage.sessionA}/presentations`,
      `/api/method/sessions/${lineage.sessionA}/initiative-drafts`,
      `/api/method/reports/${lineage.reportA.id}`,
      `/api/method/presentations/${lineage.presentationA.id}`,
      `/api/method/initiative-drafts/${lineage.draftA.id}`,
      `/api/method/sessions/${lineage.sessionA}/lineage`,
    ];

    for (const path of getPaths) {
      const res = await request(httpServer).get(path).set('Authorization', `Bearer ${otherOrgToken}`);
      expect(res.status, `expected 404 for ${path}`).toBe(404);
    }
  });

  // =========================================================================
  // 6. No auth -> 401 on every endpoint
  // =========================================================================
  it('6. missing Authorization header is refused 401 on every S1 endpoint', async () => {
    const lineage = await buildTwoVersionLineage();

    const getPaths = [
      `/api/method/sessions/${lineage.sessionA}/outputs`,
      `/api/method/outputs/${lineage.outputA.id}/revisions`,
      `/api/method/sessions/${lineage.sessionA}/reports`,
      `/api/method/sessions/${lineage.sessionA}/presentations`,
      `/api/method/sessions/${lineage.sessionA}/initiative-drafts`,
      `/api/method/reports/${lineage.reportA.id}`,
      `/api/method/presentations/${lineage.presentationA.id}`,
      `/api/method/initiative-drafts/${lineage.draftA.id}`,
      `/api/method/sessions/${lineage.sessionA}/lineage`,
    ];

    for (const path of getPaths) {
      const res = await request(httpServer).get(path);
      expect(res.status, `expected 401 for ${path}`).toBe(401);
    }
  });

  // =========================================================================
  // 7. Lineage tree contains session + revision + both Outputs + downstream
  // =========================================================================
  it('7. GET /sessions/:id/lineage contains both sessions, both Outputs (with status) and downstream artefacts', async () => {
    const lineage = await buildTwoVersionLineage();

    const res = await request(httpServer)
      .get(`/api/method/sessions/${lineage.sessionA}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const tree = res.body.lineage;

    const sessionIds = tree.sessions.map((s: any) => s.id).sort();
    expect(sessionIds).toEqual([lineage.sessionA, lineage.sessionB].sort());

    const outputIds = tree.outputs.map((o: any) => o.id).sort();
    expect(outputIds).toEqual([lineage.outputA.id, lineage.outputB.id].sort());
    const byId: Record<string, any> = Object.fromEntries(tree.outputs.map((o: any) => [o.id, o]));
    expect(byId[lineage.outputA.id].status).toBe('superseded');
    expect(byId[lineage.outputB.id].status).toBe('current');

    expect(tree.reports.map((r: any) => r.id).sort()).toEqual(
      [lineage.reportA.id, lineage.reportB.id].sort()
    );
    expect(tree.presentations.map((p: any) => p.id).sort()).toEqual(
      [lineage.presentationA.id, lineage.presentationB.id].sort()
    );
    expect(tree.initiativeDrafts.map((d: any) => d.id).sort()).toEqual(
      [lineage.draftA.id, lineage.draftB.id].sort()
    );

    const reportById: Record<string, any> = Object.fromEntries(tree.reports.map((r: any) => [r.id, r]));
    expect(reportById[lineage.reportA.id].status).toBe('superseded');
    expect(reportById[lineage.reportB.id].status).toBe('current');
  });

  // =========================================================================
  // 8. Single-record endpoints — happy path + kind guard
  // =========================================================================
  it('8. GET /reports/:id, /presentations/:id, /initiative-drafts/:id return the exact record, and reject the wrong kind', async () => {
    const lineage = await buildTwoVersionLineage();

    const reportRes = await request(httpServer)
      .get(`/api/method/reports/${lineage.reportA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.report.id).toBe(lineage.reportA.id);
    expect(reportRes.body.report.kind).toBe('report');

    // A presentation id fetched via the /reports/:id route must 404 (kind guard).
    const wrongKind = await request(httpServer)
      .get(`/api/method/reports/${lineage.presentationA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(wrongKind.status).toBe(404);

    const presentationRes = await request(httpServer)
      .get(`/api/method/presentations/${lineage.presentationA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(presentationRes.status).toBe(200);
    expect(presentationRes.body.presentation.kind).toBe('presentation');

    const draftRes = await request(httpServer)
      .get(`/api/method/initiative-drafts/${lineage.draftA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.draft.id).toBe(lineage.draftA.id);
    expect(draftRes.body.draft.status).toBe('superseded');
  });

  // =========================================================================
  // 9. Reports/Presentations/Initiative Drafts lists reflect lineage-wide
  //    supersession, queried from EITHER session id.
  // =========================================================================
  it('9. GET /sessions/:id/reports|presentations|initiative-drafts show BOTH versions with correct status, from either session id', async () => {
    const lineage = await buildTwoVersionLineage();

    for (const queryFrom of [lineage.sessionA, lineage.sessionB]) {
      const reports = await request(httpServer)
        .get(`/api/method/sessions/${queryFrom}/reports`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reports.body.total).toBe(2);
      const reportById: Record<string, any> = Object.fromEntries(
        reports.body.reports.map((r: any) => [r.id, r])
      );
      expect(reportById[lineage.reportA.id].status).toBe('superseded');
      expect(reportById[lineage.reportB.id].status).toBe('current');

      const presentations = await request(httpServer)
        .get(`/api/method/sessions/${queryFrom}/presentations`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(presentations.body.total).toBe(2);

      const drafts = await request(httpServer)
        .get(`/api/method/sessions/${queryFrom}/initiative-drafts`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(drafts.body.total).toBe(2);
      const draftById: Record<string, any> = Object.fromEntries(drafts.body.drafts.map((d: any) => [d.id, d]));
      expect(draftById[lineage.draftA.id].status).toBe('superseded');
      expect(draftById[lineage.draftB.id].status).toBe('current');
    }
  });

  // =========================================================================
  // 10. Session not found -> 404 (not a crash) for a random/garbage id
  // =========================================================================
  it('10. a well-formed but non-existent session id 404s cleanly on the session-scoped endpoints', async () => {
    const fakeId = randomUUID();
    for (const path of [
      `/api/method/sessions/${fakeId}/outputs`,
      `/api/method/sessions/${fakeId}/reports`,
      `/api/method/sessions/${fakeId}/presentations`,
      `/api/method/sessions/${fakeId}/initiative-drafts`,
      `/api/method/sessions/${fakeId}/lineage`,
    ]) {
      const res = await request(httpServer).get(path).set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status, `expected 404 for ${path}`).toBe(404);
    }
  });
});
