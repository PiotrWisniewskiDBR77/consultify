/**
 * @vitest-environment node
 *
 * Shared Method Kernel — SIRI travels the SAME kernel path as DRD, real
 * PostgreSQL (T4, 2026-08-13).
 *
 * Proves the T4 mandate end-to-end over REAL HTTP
 * (`server/src/routes/method-core.routes.ts`) against a real Postgres
 * database — NOT a mock — using the REAL 16 SIRI dimension unit ids
 * (`src/services/siriStructure.ts`'s `SIRI_PRIORITISATION_AREAS`, hardcoded
 * here as literal strings rather than imported: `server/tsconfig.json` has
 * `rootDir: "."` scoped to `server/`, so a `server/src/**` file cannot
 * import from the repo-root `src/` tree without breaking `tsc --build`
 * — see `server/src/method-core/outputs/EventDerivedOutputBridge.ts`'s
 * header comment for the same documented constraint). Pattern mirrors
 * `freezeOutputFlow.integration.test.ts` (the DRD-adjacent P0B suite) and
 * `httpDownstreamListing.integration.test.ts` (S1) — same
 * `express() + app.use('/api/method', methodCoreRoutes)` wiring, same real
 * signed JWTs, same disposable per-suite organization.
 *
 * ★ The kernel (`MethodSessionService`, `MethodPackRegistry`,
 * `EventDerivedOutputBridge`, this router) carries NO `if (methodId ===
 * 'siri')` branch anywhere — this file's entire job is to prove that SIRI's
 * REAL pack id/version/unit ids travel that already-generic path correctly,
 * not to add any SIRI-specific server code.
 *
 * ★ Legal boundary: SIRI's compiled pack readiness is honestly 'draft'
 * (`src/method-core/methods/siri/compileSiriPack.ts` — per-dimension Band
 * text is licensed content, not transcribed). This suite therefore starts
 * sessions via the structural demo bypass
 * (`server/src/method-core/demoBypass.ts`) — same mechanism, same
 * discipline `freezeOutputFlow.integration.test.ts` uses for DRD's
 * `methodology_review` pack — and separately asserts the bypass NEVER
 * writes `method_packs.readiness`, i.e. this suite does not and cannot
 * "podnieść readiness metodologiczny" of SIRI.
 *
 * Run (from the worktree ROOT, not server/):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_t4" \
 *   npx vitest run server/src/method-core/__tests__/siriFullFlow.integration.test.ts
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

// Must match src/method-core/methods/siri/compileSiriPack.ts's
// SIRI_METHOD_PACK_ID / SIRI_METHOD_PACK_VERSION exactly (cannot import
// across the server/tsconfig rootDir boundary — see header comment above).
const SIRI_METHOD_PACK_ID = 'siri';
const SIRI_METHOD_PACK_VERSION = '0.1.0-draft';

// The real 16 canonical SIRI dimensions (src/services/siriStructure.ts,
// SIRI_PRIORITISATION_AREAS ids) — NOT the 8 pillars. Verified by direct
// grep of that file at the time this test was written.
const SIRI_16_DIMENSION_IDS = [
  'vertical_integration',
  'horizontal_integration',
  'integrated_product_lifecycle',
  'shop_floor_automation',
  'enterprise_automation',
  'facility_automation',
  'shop_floor_connectivity',
  'enterprise_connectivity',
  'facility_connectivity',
  'shop_floor_intelligence',
  'enterprise_intelligence',
  'facility_intelligence',
  'workforce_learning',
  'leadership_competency',
  'strategy_governance',
  'inter_intra_collaboration',
] as const;

describe.skipIf(!REAL_DB)('T4 — SIRI travels the same kernel path as DRD (real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-t4-siri-${SUFFIX}`;
  const OWNER = `user-t4-siri-owner-${SUFFIX}`; // holds owner + lead_assessor
  const APPROVER = `user-t4-siri-approver-${SUFFIX}`; // holds approver ONLY

  let ownerToken = '';
  let approverToken = '';
  let originalDemoBypassEnv: string | undefined;

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    // The demo bypass operator gate (server/src/method-core/demoBypass.ts)
    // must be explicitly turned on for this deployment — NEVER assume it,
    // NEVER touch this outside a controlled test process.
    originalDemoBypassEnv = process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS;
    process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = 'true';

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    const { assertRealDatabase, fromPgPool } = await import('../../testing/assertRealDatabase.js');
    await assertRealDatabase(fromPgPool(pool));

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'T4 SIRI kernel-parity test org',
    ]);
    for (const id of [OWNER, APPROVER]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, ORG, `${id}@example.test`, 'user']
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

    // Register the REAL SIRI pack id/version at its HONEST readiness
    // ('draft') so GET /packs (the Library step) shows the true value — this
    // registration does NOT gate session start here (demo bypass does that
    // instead, deliberately, because 'draft' correctly refuses a normal
    // create-session call — see the dedicated test below).
    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: SIRI_METHOD_PACK_ID,
      version: SIRI_METHOD_PACK_VERSION,
      name: 'Smart Industry Readiness Index (SIRI)',
      readiness: 'draft',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    process.env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS = originalDemoBypassEnv;
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER]]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSiriSession(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `create:${randomUUID()}`)
      .send({
        module: 'assessment',
        methodPackId: SIRI_METHOD_PACK_ID,
        methodPackVersion: SIRI_METHOD_PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
        demoBypass: true,
        ...overrides,
      });
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
    return request(app)
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

  /** Answers + evidence across ALL 16 real SIRI dimensions — proves the
   * whole 16D surface, not one cherry-picked unit, reaches the frozen
   * Output. Level 3 with E2 evidence for every dimension (no-leapfrog /
   * 80:20 progression itself is an adapter-side, client-only concern —
   * see siriAdapter.test.ts / siriScoringFixtures.test.ts; the kernel event
   * store accepts a confirmed level as an honest correction, per unit). */
  async function answerAllSixteenDimensions(sessionId: string): Promise<void> {
    for (const unitId of SIRI_16_DIMENSION_IDS) {
      const evidence = await request(app)
        .post(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `evidence:${unitId}:${randomUUID()}`)
        .send({
          type: 'EVIDENCE_ATTACHED',
          unitId,
          payload: { evidenceId: `ev-${unitId}-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
        });
      if (evidence.status !== 201) {
        throw new Error(`EVIDENCE_ATTACHED(${unitId}) failed: ${evidence.status} ${JSON.stringify(evidence.body)}`);
      }
      const answer = await request(app)
        .post(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `answer:${unitId}:${randomUUID()}`)
        .send({
          type: 'ANSWER_CONFIRMED',
          unitId,
          level: 3,
          payload: { questionId: `q-${unitId}`, answerState: 'confirmed' },
        });
      if (answer.status !== 201) {
        throw new Error(`ANSWER_CONFIRMED(${unitId}) failed: ${answer.status} ${JSON.stringify(answer.body)}`);
      }
    }
  }

  /** Full path: create (demo bypass) -> in_review -> 16D answers/evidence ->
   * approver freeze. Returns {sessionId, output}. */
  async function createFrozenSiriSessionWithOutput(): Promise<{ sessionId: string; output: any }> {
    const createRes = await createSiriSession();
    if (createRes.status !== 201) {
      throw new Error(`createSiriSession failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
    }
    const sessionId = createRes.body.session.id;
    await driveToInReview(sessionId);
    await grantRole(sessionId, APPROVER, 'approver');
    await answerAllSixteenDimensions(sessionId);
    const freeze = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (freeze.status !== 200) {
      throw new Error(`freeze failed: ${freeze.status} ${JSON.stringify(freeze.body)}`);
    }
    return { sessionId, output: freeze.body.output };
  }

  // =========================================================================
  // 1. Library — GET /packs shows SIRI at its HONEST readiness
  // =========================================================================
  it('1. Library: GET /packs lists the SIRI pack with its honest "draft" readiness — never inflated', async () => {
    const res = await request(app).get('/api/method/packs').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const siriPack = res.body.packs.find((p: any) => p.packId === SIRI_METHOD_PACK_ID);
    expect(siriPack).toBeDefined();
    expect(siriPack.readiness).toBe('draft');
  });

  // =========================================================================
  // 2. Without demo bypass, a "draft" pack honestly refuses to start
  // =========================================================================
  it('2. sesja: without demoBypass, the honest "draft" readiness refuses session start (422 pack_not_released)', async () => {
    const res = await createSiriSession({ demoBypass: false });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pack_not_released');
    expect(res.body.refusal.methodPackId).toBe(SIRI_METHOD_PACK_ID);
  });

  // =========================================================================
  // 3. sesja -> odpowiedzi i dowody: create + all 16 dimensions
  // =========================================================================
  it('3. sesja + odpowiedzi/dowody: demoBypass starts a session against methodPackId="siri", accepts evidence+answers for all 16 dimensions', async () => {
    const createRes = await createSiriSession();
    expect(createRes.status).toBe(201);
    expect(createRes.body.session.methodPackId).toBe(SIRI_METHOD_PACK_ID);
    expect(createRes.body.demoBypassActive).toBe(true);
    const sessionId = createRes.body.session.id;

    await driveToInReview(sessionId);
    await answerAllSixteenDimensions(sessionId);

    const events = await request(app)
      .get(`/api/method/sessions/${sessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(events.status).toBe(200);
    const confirmedUnitIds = new Set(
      events.body.events.filter((e: any) => e.type === 'ANSWER_CONFIRMED').map((e: any) => e.unitId)
    );
    expect(confirmedUnitIds.size).toBe(16);
    for (const unitId of SIRI_16_DIMENSION_IDS) expect(confirmedUnitIds.has(unitId)).toBe(true);
  });

  // =========================================================================
  // 4. freeze -> Output carries all 16 dimensions, marked as demo bypass
  // =========================================================================
  it('4. freeze -> Output: all 16 dimensions present at level 3, demoBypassActive visible and never indistinguishable from production', async () => {
    const { output } = await createFrozenSiriSessionWithOutput();

    expect(output.methodPackId).toBe(SIRI_METHOD_PACK_ID);
    expect(Object.keys(output.current)).toHaveLength(16);
    for (const unitId of SIRI_16_DIMENSION_IDS) {
      expect(output.current[unitId]).toBe(3);
    }
    expect(output.findings).toHaveLength(16);

    expect(output.demoBypassActive).toBe(true);
    expect(output.limitations.some((l: string) => l.includes('demo bypass'))).toBe(true);
  });

  // =========================================================================
  // 5. TIER gate: the kernel Output itself carries NO prioritisation before
  //    the client explicitly asks for it (adapter-level TIER-after-freeze is
  //    covered by siriTierView.test.ts / siriMethodPack.test.ts — this
  //    asserts the KERNEL side of the same "never on live data" guarantee:
  //    prioritisationResult is null until a caller computes it client-side
  //    from the frozen, immutable Output).
  // =========================================================================
  it('5. TIER: the frozen Output carries prioritisationResult=null — TIER is a client-side, post-freeze-only computation, never baked in live', async () => {
    const { output } = await createFrozenSiriSessionWithOutput();
    expect(output.prioritisationResult).toBeNull();
    // ...but the frozen levels needed to compute it are all there, keyed by
    // the real 16 dimension ids siriAdapter.prioritise() expects.
    expect(Object.keys(output.current).sort()).toEqual([...SIRI_16_DIMENSION_IDS].sort());
  });

  // =========================================================================
  // 6. Report Snapshot z zamrożonego Outputu
  // =========================================================================
  it('6. Report: a Report Snapshot is built from the frozen SIRI Output', async () => {
    const { output } = await createFrozenSiriSessionWithOutput();

    const content = {
      executiveSummary: `SIRI Output ${output.id} — 16/16 dimensions scored`,
      findings: output.findings.map((f: { unitId: string; currentLevel: number | null }) => ({
        unitId: f.unitId,
        currentLevel: f.currentLevel,
      })),
    };
    const reportRes = await request(app)
      .post(`/api/method/outputs/${output.id}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'T4 SIRI report', content });

    expect(reportRes.status).toBe(201);
    expect(reportRes.body.report.outputId).toBe(output.id);
    expect(reportRes.body.report.kind).toBe('report');
    expect(reportRes.body.report.status).toBe('current');
  });

  // =========================================================================
  // 7. Initiative Proposal Draft z zamrożonego Outputu
  // =========================================================================
  it('7. Initiative Proposal: created from the frozen Output, structurally unable to become a Registered Initiative', async () => {
    const { output } = await createFrozenSiriSessionWithOutput();
    const findingId = output.findings[0].id;

    const draftRes = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'T4 SIRI initiative draft',
        findingIds: [findingId],
        rationale: 'T4 test rationale',
        expectedOutcome: 'T4 test expected outcome',
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
  // 8. restart/reopen: frozen -> active creates a NEW revision; re-freeze
  //    supersedes the old Output; the whole lineage is discoverable
  // =========================================================================
  it('8. restart/reopen: frozen -> active creates a new SIRI session revision; re-freezing produces a linked, superseding Output', async () => {
    const { sessionId: originalSessionId, output: originalOutput } = await createFrozenSiriSessionWithOutput();

    const reopen = await transitionTo(originalSessionId, 'active', ownerToken);
    expect(reopen.status).toBe(200);
    expect(reopen.body.session.id).toBe(originalSessionId); // response still reports the ORIGINAL

    const revisionRow = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1`,
      [originalSessionId]
    );
    expect(revisionRow.rows).toHaveLength(1);
    const revisionSessionId: string = revisionRow.rows[0].id;

    // Correction on the new revision's own (empty) event log — re-answer one
    // dimension at a different level, matching a real "reopen to correct".
    await grantRole(revisionSessionId, OWNER, 'lead_assessor');
    await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `evidence:corrected:${randomUUID()}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: 'vertical_integration',
        payload: { evidenceId: `ev-corrected-${randomUUID()}`, evidenceType: 'document', strength: 'E3' },
      });
    await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `answer:corrected:${randomUUID()}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: 'vertical_integration',
        level: 4,
        payload: { questionId: 'q-vertical_integration-corrected', answerState: 'confirmed' },
      });
    const toReview = await transitionTo(revisionSessionId, 'in_review', ownerToken);
    expect(toReview.status).toBe(200);

    await grantRole(revisionSessionId, APPROVER, 'approver');
    const refreeze = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    expect(refreeze.status).toBe(200);
    const revisedOutput = refreeze.body.output;

    expect(revisedOutput.id).not.toBe(originalOutput.id);
    expect(revisedOutput.revisionOfOutputId).toBe(originalOutput.id);
    expect(revisedOutput.outputVersion).toBe(originalOutput.outputVersion + 1);
    expect(revisedOutput.current.vertical_integration).toBe(4); // corrected value visible

    const isSuperseded = await request(app)
      .get(`/api/method/outputs/${originalOutput.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(isSuperseded.body.superseded).toBe(true);
    expect(isSuperseded.body.supersededByOutputId).toBe(revisedOutput.id);

    // -- restart: the WHOLE lineage (original + revision + both Outputs) is
    // rediscoverable from either session id — "po restarcie użytkownik
    // odnajduje i otwiera całą historię pracy".
    const lineage = await request(app)
      .get(`/api/method/sessions/${originalSessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(lineage.status).toBe(200);
    expect(lineage.body.sessions.map((s: any) => s.id).sort()).toEqual(
      [originalSessionId, revisionSessionId].sort()
    );
    expect(lineage.body.outputs).toHaveLength(2);
    const outputStatuses = lineage.body.outputs.reduce(
      (acc: Record<string, string>, o: any) => ({ ...acc, [o.output.id]: o.status }),
      {}
    );
    expect(outputStatuses[originalOutput.id]).toBe('superseded');
    expect(outputStatuses[revisedOutput.id]).toBe('current');
  });

  // =========================================================================
  // 9. Demo bypass discipline — never inflates SIRI's real readiness
  // =========================================================================
  it('9. demo bypass never writes method_packs.readiness — SIRI stays honestly "draft" after the whole flow', async () => {
    await createFrozenSiriSessionWithOutput();

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    const pack = await methodPackRegistry.getPack(ORG, SIRI_METHOD_PACK_ID, SIRI_METHOD_PACK_VERSION);
    expect(pack?.readiness).toBe('draft');

    const libraryAfter = await request(app).get('/api/method/packs').set('Authorization', `Bearer ${ownerToken}`);
    const siriPackAfter = libraryAfter.body.packs.find((p: any) => p.packId === SIRI_METHOD_PACK_ID);
    expect(siriPackAfter.readiness).toBe('draft');
  });

  it('10. production always refuses SIRI session start via demo bypass — no HTTP path bypasses this', async () => {
    const { isDemoBypassAllowed } = await import('../demoBypass.js');
    expect(isDemoBypassAllowed({ NODE_ENV: 'production', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, true)).toBe(
      false
    );
  });
});
