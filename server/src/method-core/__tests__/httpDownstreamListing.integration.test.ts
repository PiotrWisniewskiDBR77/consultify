/**
 * @vitest-environment node
 *
 * Shared Method Kernel — downstream listing/lookup HTTP surface, real
 * PostgreSQL (S1, 2026-08-13).
 *
 * Proves the "po restarcie użytkownik odnajduje i otwiera całą historię
 * pracy" gap is closed: list/get for Outputs, Output revisions
 * (current/superseded), Reports, Presentations, Initiative Proposal Drafts,
 * and the full sesja → rewizje → Output → Report/Presentation → Initiative
 * Proposal lineage tree — all against the REAL kernel services and a REAL
 * Postgres database (NOT a mock), mirroring the proven pattern in
 * `http.integration.test.ts` (create/resume/freeze/idempotency).
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_s1" \
 *   npx vitest run server/src/method-core/__tests__/httpDownstreamListing.integration.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — a structural no-op (every case reports
 * "skipped", never "passed") unless RUN_DB_TESTS=1 and MOCK_DB=false and a
 * postgres DATABASE_URL are all present.
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

describe.skipIf(!REAL_DB)('Method Kernel — downstream listing/lookup HTTP surface (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s1-${SUFFIX}`;
  const OTHER_ORG = `org-s1-other-${SUFFIX}`;
  const OWNER = `user-s1-owner-${SUFFIX}`;
  const APPROVER = `user-s1-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-s1-otherorg-${SUFFIX}`;

  const PACK_ID = `s1-test-pack-${SUFFIX}`;
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

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'S1 method-core listing test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'S1 method-core listing test org (other tenant)',
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
  });

  afterAll(async () => {
    // Additive-only cleanup, cascading from organizations (every method_*
    // FK is ON DELETE CASCADE). users.organization_id has no cascade, so
    // users must go first or the organizations DELETE 23503s.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(overrides: Record<string, unknown> = {}) {
    const idemKey = `create:${randomUUID()}`;
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({
        module: 'assessment',
        methodPackId: PACK_ID,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
        ...overrides,
      });
    if (res.status !== 201) {
      throw new Error(`createSession failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.session.id as string;
  }

  async function grantRoles(sessionId: string): Promise<void> {
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'lead_assessor', now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, OWNER]
    );
    await pool.query(
      `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'approver', now())
       ON CONFLICT (session_id, user_id, role) DO NOTHING`,
      [randomUUID(), ORG, sessionId, APPROVER]
    );
  }

  async function driveToInReview(sessionId: string): Promise<void> {
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

  async function addFinding(sessionId: string, unitId = '1A'): Promise<void> {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId,
        payload: { evidenceId: `ev-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      });
    if (res.status !== 201) {
      throw new Error(`addFinding: EVIDENCE_ATTACHED failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    await request(app)
      .post(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `answer:${randomUUID()}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId,
        level: 3,
        payload: { questionId: 'q1', answerState: 'confirmed' },
      });
  }

  async function freezeSession(sessionId: string): Promise<Record<string, unknown>> {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (res.status !== 200) {
      throw new Error(`freezeSession failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.output as Record<string, unknown>;
  }

  /** Full happy-path: create -> in_review -> finding -> freeze -> Output. */
  async function fullFreezeFlow(overrides: Record<string, unknown> = {}): Promise<{
    sessionId: string;
    output: Record<string, unknown>;
  }> {
    const sessionId = await createSession(overrides);
    await grantRoles(sessionId);
    await driveToInReview(sessionId);
    await addFinding(sessionId);
    const output = await freezeSession(sessionId);
    return { sessionId, output };
  }

  async function postArtefact(
    outputId: string,
    kind: 'report' | 'presentation',
    title: string
  ): Promise<Record<string, unknown>> {
    const path = kind === 'report' ? 'report' : 'presentation';
    const res = await request(app)
      .post(`/api/method/outputs/${outputId}/${path}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title, content: { executiveSummary: `${kind} for ${outputId}` } });
    if (res.status !== 201) {
      throw new Error(`postArtefact(${kind}) failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.report as Record<string, unknown>;
  }

  async function postInitiativeDraft(output: Record<string, unknown>): Promise<Record<string, unknown>> {
    const findings = output.findings as Array<{ id: string }>;
    const res = await request(app)
      .post(`/api/method/outputs/${output.id as string}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `Draft for ${output.id as string}`,
        findingIds: [findings[0].id],
        rationale: 'S1 test rationale',
        expectedOutcome: 'S1 test expected outcome',
        confidence: 'medium',
      });
    if (res.status !== 201) {
      throw new Error(`postInitiativeDraft failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.draft as Record<string, unknown>;
  }

  /** Reopens `sessionId` (frozen -> active, new revision), drives the NEW
   * revision session to a fresh freeze, and returns its id + Output. */
  async function reopenAndFreeze(sessionId: string): Promise<{
    revisionSessionId: string;
    output: Record<string, unknown>;
  }> {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `reopen:${randomUUID()}`)
      .send({ to: 'active' });
    if (res.status !== 200) {
      throw new Error(`reopen transition failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    // The reopen response returns the OLD session (still 'frozen') — the new
    // revision's id is discoverable only via the DB / listRevisions, exactly
    // as MethodSessionService's header comment documents.
    const revisionRow = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );
    const revisionSessionId = revisionRow.rows[0].id as string;

    await grantRoles(revisionSessionId);
    await driveToInReview(revisionSessionId);
    await addFinding(revisionSessionId, '1B');
    const output = await freezeSession(revisionSessionId);
    return { revisionSessionId, output };
  }

  // ---------------------------------------------------------------------------
  // 1. Outputs list — tenant isolation deny-path
  // ---------------------------------------------------------------------------
  it('1. GET /outputs: another organization\'s token never sees this organization\'s Output', async () => {
    const { output } = await fullFreezeFlow();

    const ownRes = await request(app)
      .get('/api/method/outputs')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.outputs.map((o: { id: string }) => o.id)).toContain(output.id);

    const otherRes = await request(app)
      .get('/api/method/outputs')
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.outputs.map((o: { id: string }) => o.id)).not.toContain(output.id);
    expect(otherRes.body.total).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 2. GET /outputs/:id — identical to the frozen row in the database
  // ---------------------------------------------------------------------------
  it('2. GET /outputs/:id returns a snapshot byte-identical to the frozen database row', async () => {
    const { output } = await fullFreezeFlow();

    const dbRow = await pool.query(`SELECT content_hash, scope FROM method_outputs WHERE id = $1`, [
      output.id,
    ]);
    expect(dbRow.rows).toHaveLength(1);

    const res = await request(app)
      .get(`/api/method/outputs/${output.id as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.output.contentHash).toBe(dbRow.rows[0].content_hash);
    expect(res.body.output.scope).toBe(dbRow.rows[0].scope);

    const dbFindings = await pool.query(
      `SELECT business_meaning FROM method_findings WHERE output_id = $1 ORDER BY id`,
      [output.id]
    );
    const responseFindings = [...(res.body.output.findings as Array<{ businessMeaning: string }>)].sort(
      (a, b) => a.businessMeaning.localeCompare(b.businessMeaning)
    );
    expect(responseFindings.map((f) => f.businessMeaning).sort()).toEqual(
      dbFindings.rows.map((r) => r.business_meaning).sort()
    );
  });

  // ---------------------------------------------------------------------------
  // 3. GET /outputs?sessionId= filters to exactly that session's Output
  // ---------------------------------------------------------------------------
  it('3. GET /outputs?sessionId= returns only the Output for that session', async () => {
    const a = await fullFreezeFlow();
    const b = await fullFreezeFlow();

    const res = await request(app)
      .get(`/api/method/outputs?sessionId=${a.sessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.outputs.map((o: { id: string }) => o.id);
    expect(ids).toContain(a.output.id);
    expect(ids).not.toContain(b.output.id);
  });

  // ---------------------------------------------------------------------------
  // 4. GET /outputs?projectId= filters to exactly that project's Outputs
  // ---------------------------------------------------------------------------
  it('4. GET /outputs?projectId= returns only Outputs whose session belongs to that project', async () => {
    const projectId = `proj-${randomUUID()}`;
    const inProject = await fullFreezeFlow({ projectId });
    const outsideProject = await fullFreezeFlow({ projectId: null });

    const res = await request(app)
      .get(`/api/method/outputs?projectId=${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.outputs.map((o: { id: string }) => o.id);
    expect(ids).toContain(inProject.output.id);
    expect(ids).not.toContain(outsideProject.output.id);
  });

  // ---------------------------------------------------------------------------
  // 5. Pagination — limit/offset cover the full set without gaps or dupes
  // ---------------------------------------------------------------------------
  it('5. GET /outputs pagination: limit + offset page through the full set with no gaps or duplicates', async () => {
    const projectId = `proj-page-${randomUUID()}`;
    const created = [await fullFreezeFlow({ projectId }), await fullFreezeFlow({ projectId }), await fullFreezeFlow({ projectId })];
    const expectedIds = new Set(created.map((c) => c.output.id as string));

    const page1 = await request(app)
      .get(`/api/method/outputs?projectId=${projectId}&limit=2&offset=0`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.outputs).toHaveLength(2);
    expect(page1.body.total).toBe(3);

    const page2 = await request(app)
      .get(`/api/method/outputs?projectId=${projectId}&limit=2&offset=2`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.outputs).toHaveLength(1);
    expect(page2.body.total).toBe(3);

    const seenIds = [...page1.body.outputs, ...page2.body.outputs].map((o: { id: string }) => o.id);
    expect(new Set(seenIds)).toEqual(expectedIds);
    expect(seenIds).toHaveLength(3); // no duplicate across pages
  });

  // ---------------------------------------------------------------------------
  // 6. Pagination — unlimited return is refused, not clamped-and-served
  // ---------------------------------------------------------------------------
  it('6. GET /outputs refuses an unbounded ?limit= instead of silently serving everything', async () => {
    const res = await request(app)
      .get('/api/method/outputs?limit=999999')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
    expect(res.body.outputs).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 7. Deterministic sort — identical timestamps still yield a stable order
  // ---------------------------------------------------------------------------
  it('7. GET /outputs: two Outputs with an IDENTICAL frozen_at sort in the SAME order across two calls', async () => {
    const projectId = `proj-tie-${randomUUID()}`;
    const first = await fullFreezeFlow({ projectId });
    const second = await fullFreezeFlow({ projectId });

    const tiedTimestamp = new Date().toISOString();
    await pool.query(`UPDATE method_outputs SET frozen_at = $1 WHERE id = ANY($2)`, [
      tiedTimestamp,
      [first.output.id, second.output.id],
    ]);

    const call1 = await request(app)
      .get(`/api/method/outputs?projectId=${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const call2 = await request(app)
      .get(`/api/method/outputs?projectId=${projectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(call1.status).toBe(200);
    expect(call2.status).toBe(200);
    const order1 = call1.body.outputs.map((o: { id: string }) => o.id);
    const order2 = call2.body.outputs.map((o: { id: string }) => o.id);
    expect(order1).toEqual(order2);
    expect(order1).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // 8. Revisions — current vs superseded, symmetric from either member's id
  // ---------------------------------------------------------------------------
  it('8. GET /outputs/:id/revisions: the newest revision is current, the older is superseded, from EITHER id', async () => {
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const { output: v2 } = await reopenAndFreeze(sessionId);
    expect(v2.revisionOfOutputId).toBe(v1.id);

    const fromV1 = await request(app)
      .get(`/api/method/outputs/${v1.id as string}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const fromV2 = await request(app)
      .get(`/api/method/outputs/${v2.id as string}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(fromV1.status).toBe(200);
    expect(fromV2.status).toBe(200);
    expect(fromV1.body.revisions.map((r: { id: string }) => r.id)).toEqual(
      fromV2.body.revisions.map((r: { id: string }) => r.id)
    );
    expect(fromV1.body.total).toBe(2);

    const byId = new Map(fromV1.body.revisions.map((r: { id: string; status: string }) => [r.id, r.status]));
    expect(byId.get(v1.id as string)).toBe('superseded');
    expect(byId.get(v2.id as string)).toBe('current');
  });

  // ---------------------------------------------------------------------------
  // 9. Revisions — 404 for another organization's Output id
  // ---------------------------------------------------------------------------
  it('9. GET /outputs/:id/revisions: another organization\'s Output id is refused with 404, not leaked', async () => {
    const { output } = await fullFreezeFlow();

    const res = await request(app)
      .get(`/api/method/outputs/${output.id as string}/revisions`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 10. Revisions — 404 for a made-up id
  // ---------------------------------------------------------------------------
  it('10. GET /outputs/:id/revisions: a made-up id is refused with 404', async () => {
    const res = await request(app)
      .get(`/api/method/outputs/${randomUUID()}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 11. Reports vs Presentations — separate lists, get-by-id refuses the
  // wrong kind (same table, kind must gate both list AND single-get)
  // ---------------------------------------------------------------------------
  it('11. GET /reports and GET /presentations list only their own kind; GET .../:id 404s on a kind mismatch', async () => {
    const { output } = await fullFreezeFlow();
    const report = await postArtefact(output.id as string, 'report', 'S1 report');
    const presentation = await postArtefact(output.id as string, 'presentation', 'S1 presentation');

    const reportsList = await request(app)
      .get(`/api/method/reports?sessionId=${output.sessionId as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reportsList.status).toBe(200);
    const reportIds = reportsList.body.reports.map((r: { id: string }) => r.id);
    expect(reportIds).toContain(report.id);
    expect(reportIds).not.toContain(presentation.id);

    const presentationsList = await request(app)
      .get(`/api/method/presentations?sessionId=${output.sessionId as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(presentationsList.status).toBe(200);
    const presentationIds = presentationsList.body.presentations.map((p: { id: string }) => p.id);
    expect(presentationIds).toContain(presentation.id);
    expect(presentationIds).not.toContain(report.id);

    const wrongKind = await request(app)
      .get(`/api/method/reports/${presentation.id as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(wrongKind.status).toBe(404);

    const rightKind = await request(app)
      .get(`/api/method/reports/${report.id as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(rightKind.status).toBe(200);
    expect(rightKind.body.report.contentHash).toBe(report.contentHash);
  });

  // ---------------------------------------------------------------------------
  // 12. Reports/Presentations — tenant isolation deny-path
  // ---------------------------------------------------------------------------
  it('12. GET /reports and GET /presentations: another organization\'s token sees none of this organization\'s snapshots', async () => {
    const { output } = await fullFreezeFlow();
    await postArtefact(output.id as string, 'report', 'S1 isolation report');
    await postArtefact(output.id as string, 'presentation', 'S1 isolation presentation');

    const reportsOther = await request(app)
      .get('/api/method/reports')
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(reportsOther.status).toBe(200);
    expect(reportsOther.body.total).toBe(0);

    const presentationsOther = await request(app)
      .get('/api/method/presentations')
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(presentationsOther.status).toBe(200);
    expect(presentationsOther.body.total).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 13. Reports — status filter reflects supersession after a corrected
  // Output gets its own new Report
  // ---------------------------------------------------------------------------
  it('13. GET /reports?status=: the old Report becomes superseded once a new Report is filed against a corrected Output', async () => {
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const reportV1 = await postArtefact(v1.id as string, 'report', 'S1 report v1');

    const { output: v2 } = await reopenAndFreeze(sessionId);
    const reportV2 = await postArtefact(v2.id as string, 'report', 'S1 report v2');

    const currentList = await request(app)
      .get(`/api/method/reports?sessionId=${v1.sessionId as string}&status=current`)
      .set('Authorization', `Bearer ${ownerToken}`);
    // reportV1 lives on sessionId (v1's own session); reportV2 lives on the
    // reopened revision's session — query each session explicitly.
    expect(currentList.status).toBe(200);
    expect(currentList.body.reports.map((r: { id: string }) => r.id)).not.toContain(reportV1.id);

    const supersededList = await request(app)
      .get(`/api/method/reports?sessionId=${v1.sessionId as string}&status=superseded`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(supersededList.status).toBe(200);
    expect(supersededList.body.reports.map((r: { id: string }) => r.id)).toContain(reportV1.id);

    const v2SessionCurrent = await request(app)
      .get(`/api/method/reports?sessionId=${v2.sessionId as string}&status=current`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(v2SessionCurrent.body.reports.map((r: { id: string }) => r.id)).toContain(reportV2.id);
    void sessionId;
  });

  // ---------------------------------------------------------------------------
  // 14. Initiative Drafts — list + get-by-id + tenant isolation
  // ---------------------------------------------------------------------------
  it('14. GET /initiative-drafts (list + :id) works and is tenant-isolated', async () => {
    const { output } = await fullFreezeFlow();
    const draft = await postInitiativeDraft(output);

    const list = await request(app)
      .get(`/api/method/initiative-drafts?sessionId=${output.sessionId as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.initiativeDrafts.map((d: { id: string }) => d.id)).toContain(draft.id);

    const single = await request(app)
      .get(`/api/method/initiative-drafts/${draft.id as string}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(single.status).toBe(200);
    expect(single.body.draft.title).toBe(draft.title);

    const otherList = await request(app)
      .get('/api/method/initiative-drafts')
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(otherList.body.initiativeDrafts.map((d: { id: string }) => d.id)).not.toContain(draft.id);

    const otherSingle = await request(app)
      .get(`/api/method/initiative-drafts/${draft.id as string}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(otherSingle.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 15. Lineage tree — full chain: sesja -> Output -> Report/Presentation ->
  // Initiative Proposal
  // ---------------------------------------------------------------------------
  it('15. GET /sessions/:id/lineage contains the full sesja -> Output -> Report/Presentation -> Initiative Proposal chain', async () => {
    const { sessionId, output } = await fullFreezeFlow();
    const report = await postArtefact(output.id as string, 'report', 'S1 lineage report');
    const presentation = await postArtefact(output.id as string, 'presentation', 'S1 lineage presentation');
    const draft = await postInitiativeDraft(output);

    const res = await request(app)
      .get(`/api/method/sessions/${sessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rootSessionId).toBe(sessionId);
    expect(res.body.sessions.map((s: { id: string }) => s.id)).toEqual([sessionId]);

    expect(res.body.outputs).toHaveLength(1);
    const node = res.body.outputs[0];
    expect(node.output.id).toBe(output.id);
    expect(node.status).toBe('current');
    expect(node.reports.map((r: { id: string }) => r.id)).toEqual([report.id]);
    expect(node.presentations.map((p: { id: string }) => p.id)).toEqual([presentation.id]);
    expect(node.initiativeDrafts.map((d: { id: string }) => d.id)).toEqual([draft.id]);
  });

  // ---------------------------------------------------------------------------
  // 16. Lineage tree — reachable identically from the root OR a later
  // revision, and refused cross-tenant
  // ---------------------------------------------------------------------------
  it('16. GET /sessions/:id/lineage: reachable from EITHER the root or a reopened revision, and refused across tenants', async () => {
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const { revisionSessionId, output: v2 } = await reopenAndFreeze(sessionId);

    const fromRoot = await request(app)
      .get(`/api/method/sessions/${sessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const fromRevision = await request(app)
      .get(`/api/method/sessions/${revisionSessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(fromRoot.status).toBe(200);
    expect(fromRevision.status).toBe(200);
    expect(fromRoot.body.rootSessionId).toBe(sessionId);
    expect(fromRevision.body.rootSessionId).toBe(sessionId);

    const sessionIdsFromRoot = fromRoot.body.sessions.map((s: { id: string }) => s.id).sort();
    const sessionIdsFromRevision = fromRevision.body.sessions.map((s: { id: string }) => s.id).sort();
    expect(sessionIdsFromRoot).toEqual([sessionId, revisionSessionId].sort());
    expect(sessionIdsFromRoot).toEqual(sessionIdsFromRevision);

    const outputIdsFromRoot = fromRoot.body.outputs
      .map((o: { output: { id: string } }) => o.output.id)
      .sort();
    expect(outputIdsFromRoot).toEqual([v1.id, v2.id].sort());

    const denied = await request(app)
      .get(`/api/method/sessions/${sessionId}/lineage`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.sessions).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 17. Empty lists — a project/session with zero rows returns [], not an
  // error, on every list endpoint
  // ---------------------------------------------------------------------------
  it('17. an empty result set is an empty array with total 0, never an error, on every list endpoint', async () => {
    const emptyProjectId = `proj-empty-${randomUUID()}`;

    const outputs = await request(app)
      .get(`/api/method/outputs?projectId=${emptyProjectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(outputs.status).toBe(200);
    expect(outputs.body.outputs).toEqual([]);
    expect(outputs.body.total).toBe(0);

    const reports = await request(app)
      .get(`/api/method/reports?projectId=${emptyProjectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reports.status).toBe(200);
    expect(reports.body.reports).toEqual([]);
    expect(reports.body.total).toBe(0);

    const presentations = await request(app)
      .get(`/api/method/presentations?projectId=${emptyProjectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(presentations.status).toBe(200);
    expect(presentations.body.presentations).toEqual([]);
    expect(presentations.body.total).toBe(0);

    const drafts = await request(app)
      .get(`/api/method/initiative-drafts?projectId=${emptyProjectId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(drafts.status).toBe(200);
    expect(drafts.body.initiativeDrafts).toEqual([]);
    expect(drafts.body.total).toBe(0);
  });
});
