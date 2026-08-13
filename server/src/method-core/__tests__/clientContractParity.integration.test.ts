/**
 * @vitest-environment jsdom
 *
 * Shared Method Kernel — CLIENT/SERVER contract parity, real HTTP + real
 * PostgreSQL (T2, 2026-08-13).
 *
 * ★ `@vitest-environment jsdom` (NOT the `server/**` -> 'node' default from
 * `vitest.config.ts`'s `environmentMatchGlobs`, which every OTHER file in
 * this directory relies on): this file is the one kernel HTTP test that
 * loads the actual BROWSER client (`src/method-core/api/methodCoreApi.ts`,
 * `ArtifactLineagePanel.tsx`), and `src/services/api/baseClient.ts` reads
 * `sessionStorage`/`localStorage` at module-load and call time — those only
 * exist under jsdom.
 *
 * Two teams worked in parallel: one built the kernel's read endpoints
 * (`GET /outputs`, `/outputs/:id/revisions`, `/reports`, `/reports/:id`,
 * `/presentations`, `/presentations/:id`, `/initiative-drafts`,
 * `/initiative-drafts/:id`, `/sessions/:id/lineage`, `/sessions`); the other
 * wrote the browser client (`src/method-core/api/methodCoreApi.ts`) and the
 * Assessment artifacts UI AGAINST A DESCRIPTION of those paths, before the
 * server routes existed. Nobody had checked whether the two shapes actually
 * agree.
 *
 * This file is that check. It does NOT hit the server with `supertest` and
 * assert on raw JSON (`httpDownstreamListing.integration.test.ts` and
 * `httpSessionsListing.integration.test.ts` already do that, thoroughly, and
 * are reused here only for FIXTURE SETUP). Instead it:
 *
 *   1. boots the real kernel router (`apiGateway`-equivalent: the same
 *      `method-core.routes.ts` router other kernel HTTP tests mount) behind
 *      a REAL listening `http.Server` (not just an in-process supertest
 *      instance) — a real TCP round trip, because the browser client's
 *      `fetchWithRetry` needs a real origin to `fetch()` against;
 *   2. imports the REAL exported functions from
 *      `src/method-core/api/methodCoreApi.ts` — never reimplements their
 *      parsing — and calls them the same way the UI does;
 *   3. asserts on the PARSED, typed objects those functions return, not on
 *      raw response bodies — this is what catches the defensive-parsing
 *      failure mode the client's own header comment warns about: a shape
 *      mismatch silently becoming `undefined`/`null`/an empty array instead
 *      of an error;
 *   4. for the lineage endpoint, additionally runs the raw response through
 *      `ArtifactLineagePanel`'s exported `normalizeLineage` — the SAME
 *      function the actual panel component uses to decide what to render.
 *
 * ★ `tests/setup.ts` globally stubs `global.fetch` to a fixed `{data: []}`
 * response (to block accidental network calls from unrelated unit tests).
 * That stub is DELIBERATELY overridden in `beforeAll` below with `undici`'s
 * real `fetch`, routed at a real listening port — see the comment there for
 * why this is safe and why `supertest` alone could not exercise the actual
 * client code path (the client calls the GLOBAL `fetch`, not an injectable
 * agent).
 *
 * Environment (jsdom, the project default — no `@vitest-environment node`
 * override): the browser client's `fetchWithRetry`/`getHeaders`
 * (`src/services/api/baseClient.ts`) read `localStorage`/`sessionStorage` at
 * call time (token) and at module-load time (correlation id) — this file
 * needs those to exist, unlike the pure-`supertest` kernel HTTP tests.
 *
 * Run (from the worktree ROOT):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_t2" \
 *   npx vitest run server/src/method-core/__tests__/clientContractParity.integration.test.ts
 *
 * `describe.skipIf(!REAL_DB)` — structurally a no-op (every case reports
 * "skipped", never "passed") unless RUN_DB_TESTS=1, MOCK_DB=false and a
 * postgres DATABASE_URL are all present.
 */
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { fetch as undiciFetch } from 'undici';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { normalizeLineage } from '@/components/assessment/artifacts/ArtifactLineagePanel';
import {
  getInitiativeDraft,
  getOutput,
  getPresentationSnapshot,
  getReportSnapshot,
  getSessionLineage,
  isAuthError,
  listInitiativeDrafts,
  listOutputRevisions,
  listOutputs,
  listPresentations,
  listReports,
  listSessions,
  MethodCoreApiError,
} from '@/method-core/api/methodCoreApi';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('Method Kernel — client/server contract parity (real HTTP, real PostgreSQL)', () => {
  let app: Express;
  let pool: import('pg').Pool;
  let httpServer: http.Server;
  let baseUrl: string;
  let originalFetch: typeof fetch;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-t2-${SUFFIX}`;
  const OTHER_ORG = `org-t2-other-${SUFFIX}`;
  const OWNER = `user-t2-owner-${SUFFIX}`;
  const APPROVER = `user-t2-approver-${SUFFIX}`;
  const OTHER_ORG_USER = `user-t2-otherorg-${SUFFIX}`;

  const PACK_ID = `t2-test-pack-${SUFFIX}`;
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
      'T2 client-contract test org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'T2 client-contract test org (other tenant)',
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
      name: 'T2 test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);

    // A REAL listening server — the browser client's `fetchWithRetry` calls
    // the global `fetch`, which needs a real origin to resolve a relative
    // '/api/method/...' URL against (supertest alone never opens a real
    // socket the global `fetch` could reach).
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    originalFetch = globalThis.fetch;
    // `tests/setup.ts` replaces `global.fetch` with a `vi.fn()` that always
    // resolves `{data: []}` (to stop unrelated unit tests from making real
    // network calls) — that stub would make every assertion below pass
    // VACUOUSLY (empty lists, `null` details) regardless of whether the
    // client's parsing is actually correct. `undici`'s `fetch` is a REAL,
    // independent implementation (not derived from `globalThis.fetch`, which
    // is already the stub by the time this file's own code runs — setup
    // files execute first) — it is what makes this a REAL HTTP round trip
    // instead of a test that could not fail.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : (input as string);
      return undiciFetch(url, init as never) as unknown as Promise<Response>;
    }) as typeof fetch;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    // Additive-only cleanup, cascading from organizations (every method_*
    // FK is ON DELETE CASCADE). users.organization_id has no cascade, so
    // users must go first or the organizations DELETE 23503s.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();
  });

  /** Every `it()` block sets its own actor before calling a client function
   * — never leave a stale token from a previous case. */
  beforeEach(() => {
    localStorage.clear();
  });

  function actAs(token: string): void {
    localStorage.setItem('token', token);
  }

  // -- fixture setup (supertest, in-process — mirrors S1's proven pattern;
  //    this file's OWN subject is the read/list client functions below, not
  //    these writes) ----------------------------------------------------

  async function createSessionRow(overrides: Record<string, unknown> = {}) {
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
      throw new Error(`createSessionRow failed: ${res.status} ${JSON.stringify(res.body)}`);
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

  async function freezeSessionRow(sessionId: string): Promise<Record<string, unknown>> {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze:${randomUUID()}`)
      .send({});
    if (res.status !== 200) {
      throw new Error(`freezeSessionRow failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.output as Record<string, unknown>;
  }

  /** Full happy-path: create -> in_review -> finding -> freeze -> Output. */
  async function fullFreezeFlow(overrides: Record<string, unknown> = {}): Promise<{
    sessionId: string;
    output: Record<string, unknown>;
  }> {
    const sessionId = await createSessionRow(overrides);
    await grantRoles(sessionId);
    await driveToInReview(sessionId);
    await addFinding(sessionId);
    const output = await freezeSessionRow(sessionId);
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
        rationale: 'T2 test rationale',
        expectedOutcome: 'T2 test expected outcome',
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
    const revisionRow = await pool.query(
      `SELECT id FROM method_sessions WHERE revision_of_session_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [sessionId]
    );
    const revisionSessionId = revisionRow.rows[0].id as string;

    await grantRoles(revisionSessionId);
    await driveToInReview(revisionSessionId);
    await addFinding(revisionSessionId, '1B');
    const output = await freezeSessionRow(revisionSessionId);
    return { revisionSessionId, output };
  }

  // ===========================================================================
  // 1. listOutputs() — parsed fields are non-empty and honest, current status
  //    resolved from the REAL server-side `status` field (the T2 fix: the
  //    server sends `status: 'current'|'superseded'` per row, never a literal
  //    `isSuperseded` boolean — before the fix, `isSuperseded` was ALWAYS
  //    `null` here, silently, never an error).
  // ===========================================================================
  it('1. listOutputs(): a fresh Output parses with non-null scope/module/version/frozenAt and isSuperseded === false', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();

    const { outputs, total } = await listOutputs();
    expect(typeof total).toBe('number');
    const row = outputs.find((o) => o.id === output.id);
    expect(row).toBeTruthy();
    expect(row!.scope).toBeTruthy();
    expect(row!.module).toBe('assessment');
    expect(row!.outputVersion).toBe(1);
    expect(row!.frozenAt).toBeTruthy();
    expect(row!.contentHash).toBeTruthy();
    expect(row!.findingsCount).toBeGreaterThan(0);
    expect(row!.limitationsCount).toBeGreaterThan(0);
    expect(row!.revisionOfOutputId).toBeNull();
    // ★ THE FIX: this used to be `null` unconditionally (client only read a
    // nonexistent `r.isSuperseded` boolean). It must now be a real `false`.
    expect(row!.isSuperseded).toBe(false);
    expect(row!.supersededByOutputId).toBeNull();
  });

  // ===========================================================================
  // 2. listOutputs() across a reopen: v1 correctly reads as superseded===true,
  //    v2 as superseded===false, WITHOUT the UI needing its page-scoped
  //    revisionOfOutputId fallback (AssessmentOutputsTab.isRowSuperseded) —
  //    the list endpoint's own per-row answer is now authoritative.
  // ===========================================================================
  it('2. listOutputs(): after a reopen, v1.isSuperseded===true / v2.isSuperseded===false, sourced from the list endpoint itself', async () => {
    actAs(ownerToken);
    // A reopen freezes v2 under a NEW session id (the revision), not the
    // original `sessionId` — filtering by the ORIGINAL sessionId alone would
    // only ever find v1 (see reference test 13's same note). `projectId` is
    // copied onto the revision session (MethodSessionService reopen path),
    // so it is the filter that reaches BOTH members of the lineage.
    const projectId = `proj-t2-reopen-${randomUUID()}`;
    const { sessionId, output: v1 } = await fullFreezeFlow({ projectId });
    const { output: v2 } = await reopenAndFreeze(sessionId);

    const { outputs } = await listOutputs({ projectId });
    const rowV1 = outputs.find((o) => o.id === v1.id);
    const rowV2 = outputs.find((o) => o.id === v2.id);
    expect(rowV1).toBeTruthy();
    expect(rowV2).toBeTruthy();
    expect(rowV1!.isSuperseded).toBe(true);
    expect(rowV1!.supersededByOutputId).toBe(v2.id);
    expect(rowV2!.isSuperseded).toBe(false);
    expect(rowV2!.supersededByOutputId).toBeNull();
    expect(rowV2!.revisionOfOutputId).toBe(v1.id);
  });

  // ===========================================================================
  // 3. listOutputs({sessionId}) / listOutputs({projectId}) filters — and
  //    tenant isolation through the client (not just the raw route).
  // ===========================================================================
  it('3. listOutputs({sessionId}/{projectId}) filters correctly, and another org sees none of it', async () => {
    actAs(ownerToken);
    const projectId = `proj-t2-${randomUUID()}`;
    const inProject = await fullFreezeFlow({ projectId });
    const outsideProject = await fullFreezeFlow({ projectId: null });

    const bySession = await listOutputs({ sessionId: inProject.sessionId });
    expect(bySession.outputs.map((o) => o.id)).toEqual([inProject.output.id]);

    const byProject = await listOutputs({ projectId });
    const projectIds = byProject.outputs.map((o) => o.id);
    expect(projectIds).toContain(inProject.output.id);
    expect(projectIds).not.toContain(outsideProject.output.id);

    actAs(otherOrgToken);
    const otherView = await listOutputs();
    expect(otherView.outputs.map((o) => o.id)).not.toContain(inProject.output.id);
  });

  // ===========================================================================
  // 4. listOutputs({status}) — the `status` query param T2 added to the
  //    client (previously dropped entirely, even though the server always
  //    supported it) actually reaches the server and filters.
  // ===========================================================================
  it('4. listOutputs({status: "current"|"superseded"}) reaches the server and filters correctly', async () => {
    actAs(ownerToken);
    // Same reopen-crosses-sessions caveat as test 2 — scope by projectId,
    // which both v1's original session and v2's revision session carry.
    const projectId = `proj-t2-status-${randomUUID()}`;
    const { sessionId, output: v1 } = await fullFreezeFlow({ projectId });
    const { output: v2 } = await reopenAndFreeze(sessionId);

    const current = await listOutputs({ projectId, status: 'current' });
    expect(current.outputs.map((o) => o.id)).toEqual([v2.id]);

    const superseded = await listOutputs({ projectId, status: 'superseded' });
    expect(superseded.outputs.map((o) => o.id)).toEqual([v1.id]);
  });

  // ===========================================================================
  // 5. getOutput(id) — findings/limitations arrays are real and non-empty,
  //    the detail's own `superseded`/`supersededByOutputId` (a DIFFERENT
  //    response shape than the list row — top-level siblings of `output`,
  //    not fields ON it) parse correctly for both a current and a superseded
  //    Output.
  // ===========================================================================
  it('5. getOutput(id): findings/limitations are real arrays and superseded/supersededByOutputId are correct for both v1 and v2', async () => {
    actAs(ownerToken);
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const { output: v2 } = await reopenAndFreeze(sessionId);

    const detailV1 = await getOutput(v1.id as string);
    expect(detailV1.output.findings.length).toBeGreaterThan(0);
    expect(detailV1.output.limitations.length).toBeGreaterThan(0);
    expect(detailV1.superseded).toBe(true);
    expect(detailV1.supersededByOutputId).toBe(v2.id);

    const detailV2 = await getOutput(v2.id as string);
    expect(detailV2.superseded).toBe(false);
    expect(detailV2.supersededByOutputId).toBeNull();
    void sessionId;
  });

  // ===========================================================================
  // 6. listOutputRevisions(id) — full chain, current/superseded, reachable
  //    from EITHER member's id (already-matching shape; still exercised
  //    through the real client and asserted on the PARSED objects).
  // ===========================================================================
  it('6. listOutputRevisions(id): full chain reachable from either v1 or v2, statuses correct', async () => {
    actAs(ownerToken);
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const { output: v2 } = await reopenAndFreeze(sessionId);

    const fromV1 = await listOutputRevisions(v1.id as string);
    const fromV2 = await listOutputRevisions(v2.id as string);
    expect(fromV1.map((r) => r.id)).toEqual(fromV2.map((r) => r.id));
    expect(fromV1).toHaveLength(2);

    const byId = new Map(fromV1.map((r) => [r.id, r]));
    expect(byId.get(v1.id as string)?.status).toBe('superseded');
    expect(byId.get(v1.id as string)?.supersededByOutputId).toBe(v2.id);
    expect(byId.get(v2.id as string)?.status).toBe('current');
    expect(byId.get(v2.id as string)?.outputVersion).toBe(2);
  });

  // ===========================================================================
  // 7 & 8. listReports() / getReportSnapshot(id) — title/status/contentHash
  //    parse, and the persisted structured content round-trips through the
  //    client exactly as posted.
  // ===========================================================================
  it('7. listReports(): a posted Report parses with non-null title/status/contentHash/kind', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const report = await postArtefact(output.id as string, 'report', 'T2 report');

    const reports = await listReports({ outputId: output.id as string });
    const row = reports.find((r) => r.id === report.id);
    expect(row).toBeTruthy();
    expect(row!.title).toBe('T2 report');
    expect(row!.status).toBe('current');
    expect(row!.contentHash).toBeTruthy();
    expect(row!.kind).toBe('report');
    expect(row!.outputId).toBe(output.id);
    expect(row!.sessionId).toBe(output.sessionId);
  });

  it('8. getReportSnapshot(id): persisted structured content round-trips through the client', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const report = await postArtefact(output.id as string, 'report', 'T2 report detail');

    const detail = await getReportSnapshot(report.id as string);
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe('T2 report detail');
    expect(detail!.content).toEqual({ executiveSummary: `report for ${output.id as string}` });
  });

  // ===========================================================================
  // 9 & 10. listPresentations() / getPresentationSnapshot(id) — same table,
  //    `kind` discipline; verifies the client keeps Reports and
  //    Presentations separated (a `getReportSnapshot` on a Presentation id
  //    404s -> `null`, not a wrong-kind row).
  // ===========================================================================
  it('9. listPresentations(): a posted Presentation parses correctly and is absent from listReports()', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const presentation = await postArtefact(output.id as string, 'presentation', 'T2 presentation');
    const report = await postArtefact(output.id as string, 'report', 'T2 sibling report');

    const presentations = await listPresentations({ outputId: output.id as string });
    const row = presentations.find((p) => p.id === presentation.id);
    expect(row).toBeTruthy();
    expect(row!.kind).toBe('presentation');
    expect(presentations.map((p) => p.id)).not.toContain(report.id);

    const reports = await listReports({ outputId: output.id as string });
    expect(reports.map((r) => r.id)).not.toContain(presentation.id);
  });

  it('10. getPresentationSnapshot(id): content round-trips; getReportSnapshot on the same id refuses with 404 (kind mismatch, not a wrong row)', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const presentation = await postArtefact(output.id as string, 'presentation', 'T2 presentation detail');

    const detail = await getPresentationSnapshot(presentation.id as string);
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe('T2 presentation detail');
    expect(detail!.content).toEqual({ executiveSummary: `presentation for ${output.id as string}` });

    // ★ `getReportSnapshot`'s declared return type is `... | null`, but its
    // implementation only ever produces `null` from a malformed 200 body —
    // a 404 (kind mismatch, wrong org, made-up id) throws `MethodCoreApiError`
    // BEFORE that branch is reached (`handle()` throws on `!res.ok`). Asserts
    // the REAL behavior here rather than the type's implied contract; noted
    // in the report as a client-internal (not client/server) inconsistency —
    // callers (`AssessmentReportsTab`) already `.catch()` this, so no UI break.
    await expect(getReportSnapshot(presentation.id as string)).rejects.toMatchObject({ status: 404 });
  });

  // ===========================================================================
  // 11. listReports({status}) — supersession after a corrected Output gets
  //    its own new Report, verified through the client's `status` filter
  //    (the T2-added param) and the client's default (no filter = all).
  // ===========================================================================
  it('11. listReports({status}): the old Report becomes superseded, the new one current, and the default (no filter) returns both', async () => {
    actAs(ownerToken);
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const reportV1 = await postArtefact(v1.id as string, 'report', 'T2 report v1');
    const { output: v2 } = await reopenAndFreeze(sessionId);
    const reportV2 = await postArtefact(v2.id as string, 'report', 'T2 report v2');

    const supersededList = await listReports({ sessionId: v1.sessionId as string, status: 'superseded' });
    expect(supersededList.map((r) => r.id)).toContain(reportV1.id);

    const currentList = await listReports({ sessionId: v2.sessionId as string, status: 'current' });
    expect(currentList.map((r) => r.id)).toContain(reportV2.id);

    const unfiltered = await listReports({ sessionId: v1.sessionId as string });
    expect(unfiltered.map((r) => r.id)).toContain(reportV1.id);
  });

  // ===========================================================================
  // 12 & 13. listInitiativeDrafts() / getInitiativeDraft(id) — findingIds,
  //    rationale, expectedOutcome, confidence all parse non-empty.
  // ===========================================================================
  it('12. listInitiativeDrafts(): a posted draft parses with non-empty findingIds/rationale/expectedOutcome/confidence', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const draft = await postInitiativeDraft(output);

    const drafts = await listInitiativeDrafts({ outputId: output.id as string });
    const row = drafts.find((d) => d.id === draft.id);
    expect(row).toBeTruthy();
    expect(row!.findingIds.length).toBeGreaterThan(0);
    expect(row!.rationale).toBe('T2 test rationale');
    expect(row!.expectedOutcome).toBe('T2 test expected outcome');
    expect(row!.confidence).toBe('medium');
    expect(row!.status).toBe('current');
  });

  it('13. getInitiativeDraft(id): full detail matches the posted draft; another org gets a 404 rejection', async () => {
    actAs(ownerToken);
    const { output } = await fullFreezeFlow();
    const draft = await postInitiativeDraft(output);

    const detail = await getInitiativeDraft(draft.id as string);
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe(draft.title);
    expect(detail!.findingIds).toEqual(draft.findingIds);

    // Same "declared `| null` but a 404 actually throws" behavior as
    // `getReportSnapshot` (see test 10's comment) — assert what really
    // happens: a rejected promise, not a resolved `null`.
    actAs(otherOrgToken);
    await expect(getInitiativeDraft(draft.id as string)).rejects.toMatchObject({ status: 404 });
  });

  // ===========================================================================
  // 14 & 15. getSessionLineage() + ArtifactLineagePanel's normalizeLineage —
  //    THE OTHER T2 FIX. The real response is
  //    `{rootSessionId, sessions, outputs: [{output, status,
  //    supersededByOutputId, reports, presentations, initiativeDrafts}]}` —
  //    nested wrapper objects, not the flat named-array envelope the panel's
  //    generic fallback assumed. Before the fix, `normalizeLineage` matched
  //    the `outputs` key, then read every wrapper's absent `.id` directly —
  //    every group silently rendered EMPTY even with a full history.
  // ===========================================================================
  it('14. getSessionLineage() + normalizeLineage(): the full chain (Output, Report, Presentation, Initiative Draft) is NOT silently empty', async () => {
    actAs(ownerToken);
    const { sessionId, output } = await fullFreezeFlow();
    const report = await postArtefact(output.id as string, 'report', 'T2 lineage report');
    const presentation = await postArtefact(output.id as string, 'presentation', 'T2 lineage presentation');
    const draft = await postInitiativeDraft(output);

    const raw = await getSessionLineage(sessionId);
    const normalized = normalizeLineage(raw, sessionId);

    expect(normalized).not.toBeNull();
    // ★ THE FIX: pre-fix, all four of these were `[]` regardless of what was
    // actually frozen/posted — the "no frozen Output yet." empty state would
    // have rendered for a session that plainly has one.
    expect(normalized!.outputs).toHaveLength(1);
    expect(normalized!.outputs[0].id).toBe(output.id);
    expect(normalized!.outputs[0].status).toBe('current');
    expect(normalized!.reports.map((r) => r.id)).toEqual([report.id]);
    expect(normalized!.presentations.map((p) => p.id)).toEqual([presentation.id]);
    expect(normalized!.initiativeDrafts.map((d) => d.id)).toEqual([draft.id]);
  });

  it('15. getSessionLineage() + normalizeLineage(): both revisions appear with correct current/superseded status, from either session id, and 403 across tenants surfaces via isAuthError', async () => {
    actAs(ownerToken);
    const { sessionId, output: v1 } = await fullFreezeFlow();
    const { revisionSessionId, output: v2 } = await reopenAndFreeze(sessionId);

    const rawFromRoot = await getSessionLineage(sessionId);
    const normalizedFromRoot = normalizeLineage(rawFromRoot, sessionId);
    expect(normalizedFromRoot).not.toBeNull();
    const idsFromRoot = normalizedFromRoot!.outputs.map((o) => o.id).sort();
    expect(idsFromRoot).toEqual([v1.id, v2.id].sort());
    const statusById = new Map(normalizedFromRoot!.outputs.map((o) => [o.id, o.status]));
    expect(statusById.get(v1.id as string)).toBe('superseded');
    expect(statusById.get(v2.id as string)).toBe('current');

    const rawFromRevision = await getSessionLineage(revisionSessionId);
    const normalizedFromRevision = normalizeLineage(rawFromRevision, revisionSessionId);
    expect(normalizedFromRevision!.outputs.map((o) => o.id).sort()).toEqual(idsFromRoot);

    actAs(otherOrgToken);
    await expect(getSessionLineage(sessionId)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(MethodCoreApiError);
      expect((err as MethodCoreApiError).status).toBe(403);
      expect(isAuthError(err)).toBe(true);
      return true;
    });
  });

  // ===========================================================================
  // 16. listSessions() — org-wide "pokaż moje sesje" list, tenant isolation,
  //    hasFrozenOutput enrichment.
  // ===========================================================================
  it('16. listSessions(): includes a created session, marks hasFrozenOutput after freeze, and is tenant-isolated', async () => {
    actAs(ownerToken);
    const { sessionId } = await fullFreezeFlow();

    const { sessions, total } = await listSessions();
    expect(typeof total).toBe('number');
    const row = sessions.find((s) => s.id === sessionId);
    expect(row).toBeTruthy();
    expect(row!.hasFrozenOutput).toBe(true);
    expect(row!.module).toBe('assessment');

    const scoped = await listSessions({ methodPackId: PACK_ID });
    expect(scoped.sessions.map((s) => s.id)).toContain(sessionId);

    actAs(otherOrgToken);
    const otherView = await listSessions();
    expect(otherView.sessions.map((s) => s.id)).not.toContain(sessionId);
  });

  // ===========================================================================
  // 17. Empty lists — a project/session with zero rows is an honest empty
  //    array with total 0 on EVERY list client function, never a thrown
  //    error and never a fabricated row.
  // ===========================================================================
  it('17. an empty result set is [] with total 0, never an error, on every list() client function', async () => {
    actAs(ownerToken);
    const emptyProjectId = `proj-empty-t2-${randomUUID()}`;

    const outputs = await listOutputs({ projectId: emptyProjectId });
    expect(outputs.outputs).toEqual([]);
    expect(outputs.total).toBe(0);

    const reports = await listReports({ sessionId: `no-such-session-${randomUUID()}` });
    expect(reports).toEqual([]);

    const presentations = await listPresentations({ sessionId: `no-such-session-${randomUUID()}` });
    expect(presentations).toEqual([]);

    const drafts = await listInitiativeDrafts({ sessionId: `no-such-session-${randomUUID()}` });
    expect(drafts).toEqual([]);
  });

  // ===========================================================================
  // 18. Lineage on a session with no frozen Output yet — normalizeLineage
  //    must produce genuinely EMPTY groups (not `null`/"unrecognized shape"),
  //    the one case where an all-empty result IS the honest answer.
  // ===========================================================================
  it('18. normalizeLineage() on a session with nothing frozen yet: recognized shape, all groups genuinely empty', async () => {
    actAs(ownerToken);
    const sessionId = await createSessionRow();

    const raw = await getSessionLineage(sessionId);
    const normalized = normalizeLineage(raw, sessionId);
    expect(normalized).not.toBeNull();
    expect(normalized!.outputs).toEqual([]);
    expect(normalized!.reports).toEqual([]);
    expect(normalized!.presentations).toEqual([]);
    expect(normalized!.initiativeDrafts).toEqual([]);
  });
});
