/**
 * INTEGRATION GATE — conversation -> Case, driven over the REAL CHAT ROUTE.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS AT ALL
 * ===========================================================================
 * `caseIntakeService.pg.test.ts` next door already proves the service. It
 * proves it by CALLING THE SERVICE, and until this packet the only HTTP
 * surface in front of that service was
 * `POST /api/v8/case-workspace/case-intake/work-orders/*` — an endpoint whose
 * own header admits nothing calls it ("this packet deliberately does NOT edit
 * chat.routes.ts … it builds the contract they will call"). So every green
 * assertion about "a conversation creates exactly one Case" was made about a
 * path no conversation travels.
 *
 * This suite therefore drives the router the chat surface is actually mounted
 * on — `routes/v8/chat.routes.ts`, mounted at `/api/v8/chat`
 * (routes/v8/index.ts:96) — and the Teresa router at `/api/v8/teresa`
 * (index.ts:129). Same routers, same middleware order, real services, real
 * PostgreSQL.
 *
 * ===========================================================================
 * WHAT IS REAL HERE AND WHAT IS NOT — stated plainly, not buried
 * ===========================================================================
 * REAL: the router objects imported from production source; the production
 * `attachV8Context` middleware; `correlationMiddleware`; every caseWorkspace
 * service; `chatExecutionService.classifyIntent`; the error funnel; a real
 * PostgreSQL; and every state assertion, made OUT OF BAND through a separate
 * `pg.Pool` rather than from a response body.
 *
 * SUBSTITUTED: the credential. `req.user` is set by a test middleware and the
 * REAL `attachV8Context` derives `req.v8Context` from it — no JWT is minted
 * and no signature is verified in this process. That boundary is proved
 * separately and end to end (real `POST /api/auth/login`, real bcrypt, real
 * signature, plus negative controls: forged signature -> 401, `e2e:true` token
 * -> 401) in `docs/product/case-workspace/LIVE_STACK_RUNBOOK.md`. It is NOT
 * re-proved here, and this suite must never be read as evidence about
 * authentication. What it IS evidence about is authorization: every denial
 * below comes from the real `requireOrgMember`/`requireCaseAccess` reading
 * real `organization_members` rows.
 *
 * NOT MOCKED ANYWHERE: there is no `vi.mock` in this file. Deliberate — the
 * sibling route suites mock the services out, which makes them contract tests
 * and leaves "did a row appear" unanswerable.
 *
 * ===========================================================================
 * GATE — `NODE_ENV=test` alone is a trap
 * ===========================================================================
 * `getDatabase()` returns an in-memory MOCK unless `RUN_DB_TESTS === '1'` AND
 * `MOCK_DB === 'false'`; every write then silently becomes a no-op and a suite
 * about "exactly one row exists" passes while touching nothing. Reachability
 * and schema are probed; failure SKIPS LOUDLY.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://…/case_workspace_test \
 *   npx vitest run \
 *     server/src/services/caseWorkspace/__tests__/integration/chatIntake.pg.test.ts \
 *     --environment node
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attachV8Context } from '../../../../middleware/v8Auth.middleware.js';
import chatRoutes from '../../../../routes/v8/chat.routes.js';
import teresaRoutes from '../../../../routes/v8/teresa.routes.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../../utils/RequestStore.js';
import {
  CONNECTION_STRING,
  ContractFixtures,
  isContractDbReachable,
  warnSkipped,
} from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

const CHAT = '/api/v8/chat';
const TERESA = '/api/v8/teresa';

const REACHABLE = await isContractDbReachable();
warnSkipped('chatIntake integration suite', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

interface Caller {
  organizationId: string;
  userId: string;
  userRole: string;
}

/**
 * Production middleware order: correlation -> credential -> the REAL
 * `attachV8Context` -> the real chat/Teresa routers -> the real error mapper.
 *
 * Note what is NOT done here: `req.v8Context` is never assigned directly (the
 * sibling harnesses do that). Setting only `req.user` and letting the
 * production middleware derive the context means the context-attachment path
 * — sanitisation, the missing-org/missing-user denials — is exercised rather
 * than skipped.
 */
function createChatApp(caller: Caller): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use((req: any, _res, next) => {
    req.user = {
      id: caller.userId,
      organizationId: caller.organizationId,
      role: caller.userRole,
      isSuperAdmin: false,
    };
    req.userRole = caller.userRole;
    req.get = (name: string) => req.headers[name.toLowerCase()];
    next();
  });
  app.use(attachV8Context);
  app.use(CHAT, chatRoutes);
  app.use(TERESA, teresaRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

/** A message `classifyIntent` classifies as conversational — a pure question. */
const INFORMATIONAL_MESSAGE = 'What is the current status of the energy contract review?';
/** A message `classifyIntent` classifies as governed work. */
const GOVERNED_MESSAGE =
  'Please create a report comparing three energy supply contracts for the Plock plant.';

/**
 * A realistic work order. Polish content, because that is what a consultant
 * actually confirms, and no email/token-shaped substrings that `PiiRedactor`
 * would rewrite inside the stored summary (a rewritten field would break the
 * reconstruction digest check and it must be clear that is a REAL failure,
 * not fixture noise).
 */
function workOrderBody(projectId: string, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    goal: 'Przygotowac rekomendacje optymalizacji kosztow zakupu energii dla zakladu w Plocku.',
    scope: [
      'Zebrac dane o zuzyciu energii z ostatnich 24 miesiecy.',
      'Porownac trzy warianty kontraktu.',
      'Wskazac wariant rekomendowany wraz z ryzykami.',
    ],
    expectedOutcome: 'Dokument rekomendacji z trzema wariantami i jednym wskazaniem.',
    constraints: ['Bez zmiany dostawcy przed koncem roku.'],
    successCriteria: ['Zarzad akceptuje rekomendacje na posiedzeniu.'],
    contractedClosureType: 'DECISION_COMPLETED',
    caseProfile: 'STANDARD',
    governanceTier: 'STANDARD',
    autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
    ...overrides,
  };
}

suite('chat/Teresa -> Case, over the real chat route, on a real PostgreSQL (E8 / Stream B)', () => {
  let control: Pool;
  let fixtures: ContractFixtures;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    fixtures = new ContractFixtures(control);
  }, 60_000);

  afterAll(async () => {
    await fixtures?.teardown().catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 120_000);

  // -------------------------------------------------------------------------
  // Out-of-band readers. Never a response body, never the service's own
  // connection: a row read inside the writing transaction is visible even if
  // that transaction later rolls back, so only a committed row seen from
  // another connection proves anything.
  // -------------------------------------------------------------------------

  async function countCasesForOrg(orgId: string): Promise<number> {
    const r = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_core WHERE organization_id = $1`,
      [orgId]
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async function readCase(orgId: string) {
    const r = await control.query(
      `SELECT case_id, project_id, case_status, case_profile, governance_tier,
              autonomy_policy, contracted_closure_type, created_by_actor_id, version
         FROM case_core WHERE organization_id = $1`,
      [orgId]
    );
    return r.rows;
  }

  /**
   * Runs are counted in BOTH tables a Run could land in. The existence probe
   * is not decoration: "the table wasn't there" must never be able to read as
   * "no Run was created", which is the exact shape of a false green for a
   * zero-Run assertion.
   */
  async function countRunsForOrg(orgId: string): Promise<number> {
    const present = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('case_workspace_run_bindings', 'v8_execution_runs')`
    );
    expect(Number(present.rows[0]?.n ?? 0)).toBe(2);

    const bindings = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_workspace_run_bindings WHERE organization_id = $1`,
      [orgId]
    );
    const runs = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM v8_execution_runs WHERE organization_id = $1`,
      [orgId]
    );
    return Number(bindings.rows[0]?.n ?? 0) + Number(runs.rows[0]?.n ?? 0);
  }

  async function readOutbox(orgId: string) {
    const r = await control.query<{
      event_id: string;
      event_type: string;
      aggregate_type: string;
      aggregate_id: string;
      case_id: string | null;
      actor_user_id: string;
      causation_id: string | null;
      redacted_summary: Record<string, unknown>;
    }>(
      `SELECT event_id, event_type, aggregate_type, aggregate_id, case_id, actor_user_id,
              causation_id, redacted_summary
         FROM case_workspace_event_outbox
        WHERE organization_id = $1
        ORDER BY created_at ASC, event_id ASC`,
      [orgId]
    );
    return r.rows;
  }

  // =========================================================================
  // 1. CW-CANON-01 — an informational conversation leaves NOTHING behind
  // =========================================================================

  it('an informational chat turn on the real chat route creates ZERO Cases, ZERO Runs and ZERO events (CW-CANON-01)', async () => {
    const f = await fixtures.seedFixture('canon01');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const res = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: INFORMATIONAL_MESSAGE });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('informational');
    expect(res.body.data.intent.intentType).toBe('conversational');
    expect(res.body.data.workOrder).toBeNull();
    expect(res.body.data.caseCreated).toBe(false);
    expect(res.body.data.runCreated).toBe(false);

    // The claims that matter, read out of band.
    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);

    // …and the conversation has no Case to return to.
    const link = await request(app).get(
      `${CHAT}/conversations/${conversationId}/case-intake/case`
    );
    expect(link.status).toBe(200);
    expect(link.body.data).toBeNull();
  }, 60_000);

  it('a clearly informational turn is refused a proposal EVEN IF a work order is attached — a question cannot be turned into work by the request body', async () => {
    const f = await fixtures.seedFixture('canon01-attached');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const res = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: INFORMATIONAL_MESSAGE, workOrder: workOrderBody(f.projectId) });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('informational');
    expect(res.body.data.workOrderDigest).toBeNull();

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);
  }, 60_000);

  // =========================================================================
  // 2. Proposal + confirmation of the CURRENT digest — exactly one Case
  // =========================================================================

  it('a governed turn proposes the exact summary (goal/scope/outcome) with a digest, and still creates ZERO Cases and ZERO Runs', async () => {
    const f = await fixtures.seedFixture('propose');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    const res = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: body });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('work_order_proposed');
    expect(res.body.data.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.body.data.caseCreated).toBe(false);
    expect(res.body.data.runCreated).toBe(false);

    // WHAT THE HUMAN READS. The three fields a confirmation dialogue must
    // state, returned byte-identical to what was sent — the UI renders the
    // digested object, never its own copy.
    expect(res.body.data.workOrder.goal).toBe(body.goal);
    expect(res.body.data.workOrder.scope).toEqual(body.scope);
    expect(res.body.data.workOrder.expectedOutcome).toBe(body.expectedOutcome);
    // The conversation binding is server-set, not body-set.
    expect(res.body.data.workOrder.sourceConversationId).toBe(conversationId);
    // STANDARD: nothing may start until a plan is published and started.
    expect(res.body.data.runStartPolicy).toBe('REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START');

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);

    const events = await readOutbox(f.orgId);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('case.intake.work_order_proposed');
    // NULL case_id is the machine-readable form of "no Case was created".
    expect(events[0].case_id).toBeNull();

    // Read-back returns the same order and the same digest.
    const current = await request(app).get(
      `${CHAT}/conversations/${conversationId}/case-intake/work-order`
    );
    expect(current.status).toBe(200);
    expect(current.body.data.workOrderDigest).toBe(res.body.data.workOrderDigest);
    expect(current.body.data.workOrder.goal).toBe(body.goal);
  }, 60_000);

  it('confirming the CURRENT digest creates exactly ONE Case whose stored fields are the ones the human confirmed, and ZERO Runs (STANDARD)', async () => {
    const f = await fixtures.seedFixture('confirm');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: body });
    expect(proposed.status).toBe(200);
    const digest = proposed.body.data.workOrderDigest as string;

    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.caseCreated).toBe(true);
    expect(confirmed.body.data.reused).toBe(false);
    expect(confirmed.body.data.runCreated).toBe(false);
    expect(confirmed.body.data.workOrderDigest).toBe(digest);
    expect(confirmed.body.data.conversationId).toBe(conversationId);

    // EXACTLY ONE Case, out of band.
    const cases = await readCase(f.orgId);
    expect(cases).toHaveLength(1);
    // "What you confirmed is what the system carries" — the governance fields
    // in the digested order are the ones now stored on the Case.
    expect(cases[0].case_profile).toBe('STANDARD');
    expect(cases[0].governance_tier).toBe('STANDARD');
    expect(cases[0].autonomy_policy).toBe('ASK_MATERIAL_ACTIONS');
    expect(cases[0].contracted_closure_type).toBe('DECISION_COMPLETED');
    expect(cases[0].case_status).toBe('DRAFT');
    expect(cases[0].created_by_actor_id).toBe(f.memberUserId);

    // STANDARD: creating the Case starts nothing.
    expect(await countRunsForOrg(f.orgId)).toBe(0);

    // The audit chain: proposal -> case.created -> confirmation, and the
    // confirmed event carries the exact summary that was shown.
    const events = await readOutbox(f.orgId);
    const types = events.map((e) => e.event_type);
    expect(types).toEqual([
      'case.intake.work_order_proposed',
      'case.created',
      'case.intake.work_order_confirmed',
    ]);
    const confirmedEvent = events[2];
    expect(confirmedEvent.redacted_summary.goal).toBe(body.goal);
    expect(confirmedEvent.redacted_summary.scope).toEqual(body.scope);
    expect(confirmedEvent.redacted_summary.expectedOutcome).toBe(body.expectedOutcome);
    expect(confirmedEvent.redacted_summary.runCreated).toBe(false);

    // Both directions of the return link.
    const forward = await request(app).get(
      `${CHAT}/conversations/${conversationId}/case-intake/case`
    );
    expect(forward.status).toBe(200);
    expect(forward.body.data.caseId).toBe(cases[0].case_id);

    const back = await request(app).get(
      `${CHAT}/case-intake/cases/${cases[0].case_id}/conversation`
    );
    expect(back.status).toBe(200);
    expect(back.body.data.conversationId).toBe(conversationId);
    expect(back.body.data.workOrderDigest).toBe(digest);
  }, 60_000);

  // =========================================================================
  // 3. THE SECURITY CASE — a superseded summary can no longer be confirmed
  // =========================================================================

  it('confirming a STALE digest (the summary was redrafted after it was shown) is REFUSED and leaves ZERO Cases; the current digest then works', async () => {
    const f = await fixtures.seedFixture('stale');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    // Teresa shows summary A…
    const first = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: workOrderBody(f.projectId) });
    expect(first.status).toBe(200);
    const staleDigest = first.body.data.workOrderDigest as string;

    // …the conversation moves on and Teresa redrafts it into summary B.
    const redrafted = workOrderBody(f.projectId, {
      goal: 'Przygotowac rekomendacje optymalizacji kosztow zakupu energii dla DWOCH zakladow: Plock i Wloclawek.',
    });
    const second = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: redrafted });
    expect(second.status).toBe(200);
    const currentDigest = second.body.data.workOrderDigest as string;
    expect(currentDigest).not.toBe(staleDigest);

    // The human's browser still holds the OLD digest and clicks confirm.
    const stale = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: staleDigest });

    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('INTAKE_WORK_ORDER_DIGEST_STALE');
    // The refusal is the whole point: nothing was created.
    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(
      (await readOutbox(f.orgId)).some((e) => e.event_type === 'case.intake.work_order_confirmed')
    ).toBe(false);

    // NEGATIVE CONTROL. Without this, a route that refused EVERY confirmation
    // would produce exactly the same green above.
    const ok = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: currentDigest });
    expect(ok.status).toBe(201);
    expect(await countCasesForOrg(f.orgId)).toBe(1);

    // And what got created is summary B — the one that was current — not A.
    const events = await readOutbox(f.orgId);
    const confirmedEvent = events.find(
      (e) => e.event_type === 'case.intake.work_order_confirmed'
    );
    expect(confirmedEvent?.redacted_summary.goal).toBe(redrafted.goal);
  }, 60_000);

  it('a confirmation for a conversation that never showed a work order is refused, and creates nothing', async () => {
    const f = await fixtures.seedFixture('never-shown');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });

    const res = await request(app)
      .post(`${CHAT}/conversations/conv-${randomUUID()}/case-intake/confirm`)
      .send({ confirmedDigest: `sha256:${'a'.repeat(64)}` });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INTAKE_CONVERSATION_WORK_ORDER_NOT_PROPOSED');
    expect(await countCasesForOrg(f.orgId)).toBe(0);
  }, 60_000);

  // =========================================================================
  // 4. Idempotency — refresh, retry and a genuine race all yield ONE Case
  // =========================================================================

  it('a refresh/retry of the same confirmation returns the SAME Case with 200 and creates no second Case', async () => {
    const f = await fixtures.seedFixture('retry');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: workOrderBody(f.projectId) });
    const digest = proposed.body.data.workOrderDigest as string;

    const first = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    const second = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.caseCreated).toBe(false);
    expect(second.body.data.reused).toBe(true);
    expect(second.body.data.reuseReason).toBe('work_order_already_confirmed');
    expect(second.body.data.caseId).toBe(first.body.data.caseId);

    expect(await countCasesForOrg(f.orgId)).toBe(1);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    // The deterministic confirmed-event id collapses the second event too.
    const confirmations = (await readOutbox(f.orgId)).filter(
      (e) => e.event_type === 'case.intake.work_order_confirmed'
    );
    expect(confirmations).toHaveLength(1);
  }, 60_000);

  it('TWO CONCURRENT confirmations (Promise.all) create exactly ONE Case — the race is decided by the database, not by a read-then-write', async () => {
    const f = await fixtures.seedFixture('race');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: workOrderBody(f.projectId) });
    const digest = proposed.body.data.workOrderDigest as string;

    const [a, b] = await Promise.all([
      request(app)
        .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
        .send({ confirmedDigest: digest }),
      request(app)
        .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
        .send({ confirmedDigest: digest }),
    ]);

    // Neither side is allowed to fail — the loser gets the winner's Case.
    expect([a.status, b.status].every((s) => s === 200 || s === 201)).toBe(true);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    expect(a.body.data.caseId).toBe(b.body.data.caseId);
    expect([a.body.data.caseCreated, b.body.data.caseCreated].filter(Boolean)).toHaveLength(1);

    // THE assertion, out of band.
    expect(await countCasesForOrg(f.orgId)).toBe(1);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    const created = (await readOutbox(f.orgId)).filter((e) => e.event_type === 'case.created');
    expect(created).toHaveLength(1);
  }, 90_000);

  // =========================================================================
  // 5. LIGHT policy — zero or one Run; intake itself always zero
  // =========================================================================

  it('LIGHT: confirming creates one Case, ZERO Runs from intake, and reports that at most ONE Run may be started next', async () => {
    const f = await fixtures.seedFixture('light');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({
        message: GOVERNED_MESSAGE,
        workOrder: workOrderBody(f.projectId, {
          caseProfile: 'LIGHT',
          governanceTier: 'LIGHTWEIGHT',
        }),
      });
    expect(proposed.body.data.runStartPolicy).toBe('MAY_START_SINGLE_RUN_AFTER_CONFIRMATION');

    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: proposed.body.data.workOrderDigest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.runCreated).toBe(false);
    expect(confirmed.body.data.runStartPolicy).toBe('MAY_START_SINGLE_RUN_AFTER_CONFIRMATION');

    const cases = await readCase(f.orgId);
    expect(cases).toHaveLength(1);
    expect(cases[0].case_profile).toBe('LIGHT');

    // "Zero or one" — intake spends none of that budget.
    const runs = await countRunsForOrg(f.orgId);
    expect(runs).toBe(0);
    expect(runs).toBeLessThanOrEqual(1);
  }, 60_000);

  it('TRANSFORMATION: creating the Case starts nothing and says so — a plan must be published and started explicitly', async () => {
    const f = await fixtures.seedFixture('transformation');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({
        message: GOVERNED_MESSAGE,
        workOrder: workOrderBody(f.projectId, {
          caseProfile: 'TRANSFORMATION',
          governanceTier: 'CONTROLLED',
        }),
      });
    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: proposed.body.data.workOrderDigest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.runStartPolicy).toBe('REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START');
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(await countCasesForOrg(f.orgId)).toBe(1);
  }, 60_000);

  // =========================================================================
  // 6. Cross-tenant — refused, and refused identically whether or not the
  //    thing being probed exists
  // =========================================================================

  it('a foreign-tenant actor is refused on every intake route, learns NOTHING about existence, and leaves the tenant untouched', async () => {
    const victim = await fixtures.seedFixture('victim');
    const attackerOrg = await fixtures.seedOrg('attacker');
    const attackerUser = await fixtures.seedUser(attackerOrg, 'attacker');
    await fixtures.seedMembership(attackerOrg, attackerUser, 'ADMIN');

    const victimApp = createChatApp({
      organizationId: victim.orgId,
      userId: victim.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(victimApp)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: workOrderBody(victim.projectId) });
    const digest = proposed.body.data.workOrderDigest as string;
    const confirmed = await request(victimApp)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(confirmed.status).toBe(201);
    const caseId = confirmed.body.data.caseId as string;

    // The attacker is an ACTIVE, legitimate member — of the WRONG org. They
    // point every route at the victim's real identifiers.
    const attackerApp = createChatApp({
      organizationId: attackerOrg,
      userId: attackerUser,
      userRole: 'ADMIN',
    });

    const realConv = await request(attackerApp)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    const fakeConv = await request(attackerApp)
      .post(`${CHAT}/conversations/conv-${randomUUID()}/case-intake/confirm`)
      .send({ confirmedDigest: digest });

    // Refused. NOT 2xx, and NOT 5xx — a guard that "protects" by crashing is
    // a different defect wearing a denial's coat.
    expect([realConv.status, fakeConv.status].every((s) => s >= 400 && s < 500)).toBe(true);
    /**
     * THE ORACLE TEST, and the reason this assertion is written on EQUALITY
     * rather than on a specific code. The refusal here is not `not_org_member`
     * — the attacker IS an active member, of their own org — it is
     * `intake_conversation_work_order_not_proposed` (422), because every
     * lookup is scoped to the org resolved from the CALLER's context, so the
     * victim's conversation simply does not exist as far as this caller is
     * concerned. That is the stronger posture: the endpoint does not "deny
     * access to something", it has nothing to deny access to. What must hold,
     * and what is asserted, is that a REAL victim conversation and an INVENTED
     * id produce the SAME status and the SAME code — otherwise the difference
     * itself would be the oracle.
     */
    expect(realConv.status).toBe(fakeConv.status);
    expect(realConv.body.error.code).toBe(fakeConv.body.error.code);

    // The forward read is org-scoped the same way: the attacker is told
    // "no Case for that conversation", exactly as they would be for an id
    // that never existed — never the victim's caseId.
    const readForward = await request(attackerApp).get(
      `${CHAT}/conversations/${conversationId}/case-intake/case`
    );
    const readForwardFake = await request(attackerApp).get(
      `${CHAT}/conversations/conv-${randomUUID()}/case-intake/case`
    );
    expect(readForward.status).toBe(readForwardFake.status);
    expect(readForward.body.data).toBeNull();
    expect(readForwardFake.body.data).toBeNull();
    expect(JSON.stringify(readForward.body)).not.toContain(caseId);

    // The case-scoped read answers 404, never 403 — a cross-tenant caseId must
    // be indistinguishable from a missing one (SEC-009).
    const realCase = await request(attackerApp).get(
      `${CHAT}/case-intake/cases/${caseId}/conversation`
    );
    const fakeCase = await request(attackerApp).get(
      `${CHAT}/case-intake/cases/case-${randomUUID()}/conversation`
    );
    expect(realCase.status).toBe(404);
    expect(fakeCase.status).toBe(404);
    expect(realCase.body.error.code).toBe(fakeCase.body.error.code);

    // The victim's state is exactly as it was, and no event names the attacker.
    expect(await countCasesForOrg(victim.orgId)).toBe(1);
    expect(await countCasesForOrg(attackerOrg)).toBe(0);
    expect(await countRunsForOrg(victim.orgId)).toBe(0);
    const victimEvents = await readOutbox(victim.orgId);
    expect(victimEvents.some((e) => e.actor_user_id === attackerUser)).toBe(false);
    expect(await readOutbox(attackerOrg)).toHaveLength(0);
  }, 90_000);

  it('a REVOKED member cannot confirm, while an active colleague still can (negative control)', async () => {
    const f = await fixtures.seedFixture('revoked');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE, workOrder: workOrderBody(f.projectId) });
    const digest = proposed.body.data.workOrderDigest as string;

    await control.query(
      `UPDATE organization_members SET status = 'REVOKED' WHERE organization_id = $1 AND user_id = $2`,
      [f.orgId, f.memberUserId]
    );

    const denied = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(denied.status).toBe(403);
    expect(await countCasesForOrg(f.orgId)).toBe(0);

    // NEGATIVE CONTROL: the same call, by a still-ACTIVE colleague, succeeds.
    const colleagueApp = createChatApp({
      organizationId: f.orgId,
      userId: f.adminUserId,
      userRole: 'ADMIN',
    });
    const allowed = await request(colleagueApp)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(allowed.status).toBe(201);
    expect(await countCasesForOrg(f.orgId)).toBe(1);
  }, 60_000);

  // =========================================================================
  // 7. Teresa and chat are ONE intake, not two
  // =========================================================================

  it('a summary shown by Teresa can be confirmed on the chat route and yields the SAME single Case — the two surfaces share one work order', async () => {
    const f = await fixtures.seedFixture('teresa');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    // Teresa presents the exact summary…
    const shown = await request(app)
      .post(`${TERESA}/case-intake/conversations/${conversationId}/summary`)
      .send(body);
    expect(shown.status).toBe(200);
    expect(shown.body.data.caseCreated).toBe(false);
    expect(shown.body.data.workOrder.goal).toBe(body.goal);
    const digest = shown.body.data.workOrderDigest as string;

    // …the chat route sees the identical current order.
    const current = await request(app).get(
      `${CHAT}/conversations/${conversationId}/case-intake/work-order`
    );
    expect(current.body.data.workOrderDigest).toBe(digest);

    // …and confirming on EITHER surface produces one Case.
    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(confirmed.status).toBe(201);

    const again = await request(app)
      .post(`${TERESA}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: digest });
    expect(again.status).toBe(200);
    expect(again.body.data.caseId).toBe(confirmed.body.data.caseId);

    expect(await countCasesForOrg(f.orgId)).toBe(1);
    expect(await countRunsForOrg(f.orgId)).toBe(0);

    const back = await request(app).get(
      `${TERESA}/case-intake/cases/${confirmed.body.data.caseId}/conversation`
    );
    expect(back.body.data.conversationId).toBe(conversationId);
  }, 90_000);

  // =========================================================================
  // 8. Validation — a summary that cannot state goal/scope/outcome is not a
  //    work order and must never reach the digest
  // =========================================================================

  it('a work order missing goal, scope or expected outcome is rejected with 400 and creates nothing', async () => {
    const f = await fixtures.seedFixture('validation');
    const app = createChatApp({
      organizationId: f.orgId,
      userId: f.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;

    for (const missing of ['goal', 'scope', 'expectedOutcome'] as const) {
      const body: Record<string, unknown> = workOrderBody(f.projectId);
      delete body[missing];
      const res = await request(app)
        .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
        .send({ message: GOVERNED_MESSAGE, workOrder: body });
      expect(res.status).toBe(400);
    }

    // A malformed digest never reaches the service either.
    const badDigest = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: 'not-a-digest' });
    expect(badDigest.status).toBe(400);

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);
  }, 60_000);
});
