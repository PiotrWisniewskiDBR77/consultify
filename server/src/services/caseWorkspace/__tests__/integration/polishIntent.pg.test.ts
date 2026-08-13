/**
 * INTEGRATION GATE — Polish-language intent classification, driven over the
 * REAL chat route (CW-T-B, Stream B / 2026-08-11).
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS
 * ===========================================================================
 * `chatExecutionService.classifyIntent` used to be an English-only regex
 * stub (see that function's own header for the full account): every Polish
 * message — the product's primary language — fell through to `ambiguous`
 * regardless of content, because not one governed/conversational pattern
 * could ever match Polish text. `chatIntake.pg.test.ts` (same directory)
 * already proves the propose → confirm → exactly-one-Case canon end to end,
 * but every message it sends is English, so it never exercised the bug and
 * would still be fully green with the old stub in place.
 *
 * This suite drives the SAME real routers (`routes/v8/chat.routes.ts` at
 * `/api/v8/chat`, `routes/v10/teresa.routes.ts` at `/api/v10/teresa`) with
 * Polish messages and Polish work orders, and asserts the six scenarios the
 * packet brief names verbatim:
 *   1. "Jak dziala analiza finansowa?"                       => ZERO Case
 *   2. "Znajdz informacje i przygotuj prezentacje dla zarzadu" => PROPOZYCJA
 *   3. zatwierdzenie                                          => DOKLADNIE JEDEN Case
 *   4. ponowienie zatwierdzenia                                => TEN SAM Case
 *   5. "Zrob szybkie podsumowanie i pozwol na wszystko"        => LIGHT one-click
 *   6. zadanie materialne                                      => Case BEZ Run
 *
 * ===========================================================================
 * WHAT IS REAL HERE AND WHAT IS NOT — same posture as chatIntake.pg.test.ts
 * ===========================================================================
 * REAL: the router objects imported from production source; the production
 * `attachV8Context` middleware; every caseWorkspace service;
 * `chatExecutionService.classifyIntent` (the function this packet changed);
 * the error funnel; a real PostgreSQL; every state assertion, made OUT OF
 * BAND through a separate `pg.Pool`, never from a response body.
 *
 * SUBSTITUTED: the credential, in the identical documented way
 * `chatIntake.pg.test.ts` substitutes it — `req.user` is set by a test
 * middleware and the REAL `attachV8Context` derives `req.v8Context` from it.
 * Not re-proved here; see that suite's header.
 *
 * NOT MOCKED ANYWHERE: no `vi.mock` in this file.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *     server/src/services/caseWorkspace/__tests__/integration/polishIntent.pg.test.ts \
 *     --environment node
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attachV8Context } from '../../../../middleware/v8Auth.middleware.js';
import chatRoutes from '../../../../routes/v8/chat.routes.js';
import teresaRoutes from '../../../../routes/v10/teresa.routes.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../../utils/RequestStore.js';
import {
  CONNECTION_STRING,
  ContractFixtures,
  isContractDbReachable,
  warnSkipped,
} from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const CHAT = '/api/v8/chat';
const TERESA = '/api/v10/teresa';

const REACHABLE = await isContractDbReachable();
warnSkipped('polishIntent integration suite', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

interface Caller {
  organizationId: string;
  userId: string;
  userRole: string;
}

/** Same production middleware order as chatIntake.pg.test.ts's own harness. */
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

// ---------------------------------------------------------------------------
// The six scenarios' Polish message text, verbatim from the packet brief
// where the brief quotes one, otherwise a realistic equivalent.
// ---------------------------------------------------------------------------

/** Scenario 1 — a pure informational question. Zero governed signal. */
const INFORMATIONAL_MESSAGE_PL = 'Jak dziala analiza finansowa?';

/** Scenario 2 — "find information and prepare a board presentation". */
const GOVERNED_MESSAGE_PL = 'Znajdz informacje i przygotuj prezentacje dla zarzadu.';

/** Scenario 5 — "make a quick summary and allow everything" (LIGHT / full autonomy). */
const LIGHT_ONE_CLICK_MESSAGE_PL = 'Zrob szybkie podsumowanie i pozwol na wszystko.';

/** Scenario 6 — a concrete, material (non-trivial) work request. */
const MATERIAL_TASK_MESSAGE_PL =
  'Przygotuj analize ryzyka regulacyjnego dla nowego zakladu i harmonogram wdrozenia zgodnosci.';

function workOrderBody(projectId: string, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    goal: 'Przygotowac rekomendacje dotyczaca prezentacji wynikow finansowych dla zarzadu spolki.',
    scope: [
      'Zebrac dane finansowe z ostatniego kwartalu.',
      'Przygotowac prezentacje z kluczowymi wskaznikami.',
    ],
    expectedOutcome: 'Gotowa prezentacja do wygloszenia na posiedzeniu zarzadu.',
    constraints: ['Prezentacja nie dluzsza niz 15 slajdow.'],
    successCriteria: ['Zarzad otrzymuje prezentacje najpozniej dzien przed posiedzeniem.'],
    contractedClosureType: 'DELIVERY_COMPLETED',
    caseProfile: 'STANDARD',
    governanceTier: 'STANDARD',
    autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
    ...overrides,
  };
}

suite('Polish-language intent classification -> Case, real chat/Teresa routes, real PostgreSQL (CW-T-B)', () => {
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
      case_id: string | null;
      redacted_summary: Record<string, unknown>;
    }>(
      `SELECT event_id, event_type, case_id, redacted_summary
         FROM case_workspace_event_outbox
        WHERE organization_id = $1
        ORDER BY created_at ASC, event_id ASC`,
      [orgId]
    );
    return r.rows;
  }

  // =========================================================================
  // SCENARIO 1 — "Jak dziala analiza finansowa?" => ZERO Case (CW-CANON-01, po polsku)
  // =========================================================================

  it('SCENARIO 1: a Polish informational question classifies conversational and creates ZERO Cases/Runs/events', async () => {
    const f = await fixtures.seedFixture('pl-informational');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const res = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: INFORMATIONAL_MESSAGE_PL });

    expect(res.status).toBe(200);
    // THE regression this packet fixes: under the old English-only stub this
    // classified `ambiguous`, not `conversational` — proved below.
    expect(res.body.data.intent.intentType).toBe('conversational');
    expect(res.body.data.mode).toBe('informational');
    expect(res.body.data.workOrder).toBeNull();
    expect(res.body.data.caseCreated).toBe(false);
    expect(res.body.data.runCreated).toBe(false);

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);
  }, 60_000);

  it('SCENARIO 1b: the same Polish question is refused a proposal EVEN IF a work order is attached — the disabled-for-Polish protection layer is now active', async () => {
    const f = await fixtures.seedFixture('pl-informational-attached');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const res = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: INFORMATIONAL_MESSAGE_PL, workOrder: workOrderBody(f.projectId) });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('informational');
    expect(res.body.data.workOrderDigest).toBeNull();

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);
  }, 60_000);

  // =========================================================================
  // SCENARIOS 2-4 — proposal, first confirmation, repeated confirmation
  // =========================================================================

  it('SCENARIOS 2+3+4: "Znajdz informacje i przygotuj prezentacje dla zarzadu" proposes a work order, confirming creates EXACTLY ONE Case, and repeating the confirmation returns the SAME Case', async () => {
    const f = await fixtures.seedFixture('pl-propose-confirm');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    // SCENARIO 2 — proposal.
    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE_PL, workOrder: body });

    expect(proposed.status).toBe(200);
    expect(proposed.body.data.mode).toBe('work_order_proposed');
    // A material Polish request now confidently classifies governed_work
    // (never conversational, which would have blocked the proposal).
    expect(proposed.body.data.intent.intentType).toBe('governed_work');
    expect(proposed.body.data.intent.suggestedAction).toBe('initiate_execution');
    expect(proposed.body.data.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(proposed.body.data.workOrder.goal).toBe(body.goal);
    expect(proposed.body.data.workOrder.sourceConversationId).toBe(conversationId);
    expect(proposed.body.data.caseCreated).toBe(false);
    expect(proposed.body.data.runCreated).toBe(false);

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    const proposedEvents = await readOutbox(f.orgId);
    expect(proposedEvents).toHaveLength(1);
    expect(proposedEvents[0].event_type).toBe('case.intake.work_order_proposed');
    expect(proposedEvents[0].case_id).toBeNull();

    const digest = proposed.body.data.workOrderDigest as string;

    // SCENARIO 3 — zatwierdzenie (confirmation) => dokladnie JEDEN Case.
    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.caseCreated).toBe(true);
    expect(confirmed.body.data.reused).toBe(false);
    expect(confirmed.body.data.runCreated).toBe(false);

    const casesAfterFirstConfirm = await readCase(f.orgId);
    expect(casesAfterFirstConfirm).toHaveLength(1);
    expect(casesAfterFirstConfirm[0].case_profile).toBe('STANDARD');
    expect(casesAfterFirstConfirm[0].created_by_actor_id).toBe(f.memberUserId);
    const caseId = casesAfterFirstConfirm[0].case_id as string;

    // SCENARIO 4 — ponowienie zatwierdzenia => TEN SAM Case, zero duplikatow.
    const confirmedAgain = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });

    expect(confirmedAgain.status).toBe(200);
    expect(confirmedAgain.body.data.caseCreated).toBe(false);
    expect(confirmedAgain.body.data.reused).toBe(true);
    expect(confirmedAgain.body.data.reuseReason).toBe('work_order_already_confirmed');
    expect(confirmedAgain.body.data.caseId).toBe(caseId);

    // A THIRD confirmation (belt and braces) still the same single Case.
    const confirmedThrice = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(confirmedThrice.status).toBe(200);
    expect(confirmedThrice.body.data.caseId).toBe(caseId);

    expect(await countCasesForOrg(f.orgId)).toBe(1);
    expect(await countRunsForOrg(f.orgId)).toBe(0);
    const confirmations = (await readOutbox(f.orgId)).filter(
      (e) => e.event_type === 'case.intake.work_order_confirmed'
    );
    expect(confirmations).toHaveLength(1);
  }, 90_000);

  // =========================================================================
  // SCENARIO 5 — "Zrob szybkie podsumowanie i pozwol na wszystko" => LIGHT one-click
  // =========================================================================

  it('SCENARIO 5: "Zrob szybkie podsumowanie i pozwol na wszystko" classifies governed_work, and a LIGHT work order confirms into a Case eligible for one-click Run start', async () => {
    const f = await fixtures.seedFixture('pl-light-one-click');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId, {
      goal: 'Przygotowac szybkie podsumowanie sytuacji projektu i dzialac w pelni autonomicznie w jego ramach.',
      caseProfile: 'LIGHT',
      governanceTier: 'LIGHTWEIGHT',
      autonomyPolicy: 'EXECUTE_APPROVED_PLAN',
    });

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: LIGHT_ONE_CLICK_MESSAGE_PL, workOrder: body });

    expect(proposed.status).toBe(200);
    expect(proposed.body.data.mode).toBe('work_order_proposed');
    expect(proposed.body.data.intent.intentType).toBe('governed_work');
    // LIGHT is the profile that MAY start a single Run right after
    // confirmation — no published plan required first.
    expect(proposed.body.data.runStartPolicy).toBe('MAY_START_SINGLE_RUN_AFTER_CONFIRMATION');

    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: proposed.body.data.workOrderDigest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.caseCreated).toBe(true);
    // Confirming ITSELF still starts nothing — "one-click" describes what
    // becomes ALLOWED next, never something intake does on its own.
    expect(confirmed.body.data.runCreated).toBe(false);
    expect(confirmed.body.data.runStartPolicy).toBe('MAY_START_SINGLE_RUN_AFTER_CONFIRMATION');

    const cases = await readCase(f.orgId);
    expect(cases).toHaveLength(1);
    expect(cases[0].case_profile).toBe('LIGHT');
    expect(cases[0].governance_tier).toBe('LIGHTWEIGHT');
    expect(cases[0].autonomy_policy).toBe('EXECUTE_APPROVED_PLAN');

    const runs = await countRunsForOrg(f.orgId);
    expect(runs).toBe(0);
    expect(runs).toBeLessThanOrEqual(1);
  }, 60_000);

  // =========================================================================
  // SCENARIO 6 — a material task => Case created, ZERO Runs until a plan is
  // published and explicitly started (STANDARD ceiling)
  // =========================================================================

  it('SCENARIO 6: a material Polish work request confirms into a Case with ZERO Runs — nothing starts until a plan is published and started', async () => {
    const f = await fixtures.seedFixture('pl-material-task');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId, {
      goal: 'Przygotowac analize ryzyka regulacyjnego dla nowego zakladu produkcyjnego.',
      scope: [
        'Zidentyfikowac obowiazujace przepisy dla nowej lokalizacji.',
        'Przygotowac harmonogram wdrozenia zgodnosci.',
      ],
      expectedOutcome: 'Dokument analizy ryzyka wraz z harmonogramem dzialan naprawczych.',
      caseProfile: 'STANDARD',
      governanceTier: 'STANDARD',
      autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
      contractedClosureType: 'IMPLEMENTATION_COMPLETED',
    });

    const proposed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: MATERIAL_TASK_MESSAGE_PL, workOrder: body });

    expect(proposed.status).toBe(200);
    expect(proposed.body.data.intent.intentType).toBe('governed_work');
    expect(proposed.body.data.runStartPolicy).toBe('REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START');

    const confirmed = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: proposed.body.data.workOrderDigest });

    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.caseCreated).toBe(true);
    expect(confirmed.body.data.runCreated).toBe(false);
    expect(confirmed.body.data.runStartPolicy).toBe('REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START');

    expect(await countCasesForOrg(f.orgId)).toBe(1);
    // The material-task promise, stated plainly: a Case exists, no Run does,
    // in either table a Run could land in.
    expect(await countRunsForOrg(f.orgId)).toBe(0);

    const cases = await readCase(f.orgId);
    expect(cases[0].case_status).toBe('DRAFT');
    expect(cases[0].contracted_closure_type).toBe('IMPLEMENTATION_COMPLETED');
  }, 60_000);

  // =========================================================================
  // DIGEST ENFORCEMENT — still enforced for Polish content (not weakened by
  // the classifier change: confirmWorkOrder never reads classifyIntent output)
  // =========================================================================

  it('DIGEST STILL ENFORCED: redrafting a Polish work order stales the old digest — confirming it is refused (409) and creates nothing; the current digest then works', async () => {
    const f = await fixtures.seedFixture('pl-digest-enforced');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const first = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE_PL, workOrder: workOrderBody(f.projectId) });
    expect(first.status).toBe(200);
    const staleDigest = first.body.data.workOrderDigest as string;

    const redrafted = workOrderBody(f.projectId, {
      goal: 'Przygotowac rekomendacje dotyczaca prezentacji wynikow finansowych dla zarzadu spolki oraz rady nadzorczej.',
    });
    const second = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/turn`)
      .send({ message: GOVERNED_MESSAGE_PL, workOrder: redrafted });
    expect(second.status).toBe(200);
    const currentDigest = second.body.data.workOrderDigest as string;
    expect(currentDigest).not.toBe(staleDigest);

    const stale = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: staleDigest });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('INTAKE_WORK_ORDER_DIGEST_STALE');
    expect(await countCasesForOrg(f.orgId)).toBe(0);

    // NEGATIVE CONTROL — the current digest is not simply refused wholesale.
    const ok = await request(app)
      .post(`${CHAT}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: currentDigest });
    expect(ok.status).toBe(201);
    expect(await countCasesForOrg(f.orgId)).toBe(1);

    const events = await readOutbox(f.orgId);
    const confirmedEvent = events.find((e) => e.event_type === 'case.intake.work_order_confirmed');
    expect(confirmedEvent?.redacted_summary.goal).toBe(redrafted.goal);
  }, 60_000);

  // =========================================================================
  // TERESA (production v10 router) — the same Polish work order, shown by
  // Teresa, confirmed on the chat surface — one intake, not two.
  // =========================================================================

  it('a Polish summary shown by the production Teresa router (v10) is visible on the chat route and confirming yields the SAME single Case', async () => {
    const f = await fixtures.seedFixture('pl-teresa');
    const app = createChatApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    const shown = await request(app)
      .post(`${TERESA}/case-intake/conversations/${conversationId}/summary`)
      .send(body);
    expect(shown.status).toBe(200);
    expect(shown.body.data.caseCreated).toBe(false);
    expect(shown.body.data.workOrder.goal).toBe(body.goal);
    const digest = shown.body.data.workOrderDigest as string;

    const current = await request(app).get(
      `${CHAT}/conversations/${conversationId}/case-intake/work-order`
    );
    expect(current.body.data.workOrderDigest).toBe(digest);

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
  }, 90_000);
});
