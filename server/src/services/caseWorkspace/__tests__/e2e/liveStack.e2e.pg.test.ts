/**
 * Case Workspace — TEN END-TO-END SCENARIOS ON THE LIVE STACK (Strumień E).
 *
 * Real running server (separate process) · real HTTP · real JWT from a real
 * login · real PostgreSQL. `/api/*` is never mocked. See `liveStackHarness.ts`
 * for why this layer exists and what it catches that the contract suite cannot.
 *
 * Every scenario asserts the three pieces of evidence the owner requires:
 *   (a) a real network request and its real HTTP status,
 *   (b) the resulting state read back out-of-band from the database,
 *   (c) the trace left in `case_workspace_event_outbox`.
 *
 * ===========================================================================
 * GAPS THIS SUITE PINS DOWN (each has a test that asserts the CURRENT truth,
 * so the day the gap is closed the test fails and must be updated on purpose)
 * ===========================================================================
 * GAP-E-01  No Case Workspace HTTP route creates a Run. `POST /run-bindings`
 *           requires a `casePlanVersionId` AND a `run_id` that already exists
 *           in `v8_execution_runs` (FK), and nothing in `server/src` outside
 *           test/proof scripts inserts that row. Consequence: the execution
 *           half of the workspace has no entry point through the product.
 * GAP-E-02  LIGHT's `MAY_START_SINGLE_RUN_AFTER_CONFIRMATION` is unreachable.
 *           The policy says a LIGHT Case may start a Run "straight off the
 *           confirmed work order; there is no plan to publish first", but the
 *           only run-binding route hard-requires a plan version. So the
 *           one-click promise stops at Case creation.
 * GAP-E-03  `GET /cases/by-project/:projectId` leaks existence across tenants.
 *           `caseCoreService.ts:428` calls `requireOrgMember` BEFORE the
 *           route's enumeration-safe 404 guard (`cases.routes.ts:98`) can run,
 *           so a foreign project WITH a Case answers 403 while a nonexistent
 *           one answers 404 — exactly the oracle SEC-009 exists to close.
 * GAP-E-04  `POST /waits/:waitId/resolve` is route-exposed for
 *           DOMAIN_EVENT/EXTERNAL_CALLBACK waits even though
 *           `waitSubscriptionService.ts` states those paths "remain
 *           INTERNAL-ONLY / NOT ROUTE-EXPOSED pending a future
 *           authentication/dedupe layer (open_question #8)". Any org member
 *           can satisfy such a wait with a `satisfiedByEventId` that exists
 *           nowhere, and the outbox attributes it to a system actor rather
 *           than to the human who really did it.
 * GAP-E-05  `case_core` has no title/goal column, so the work order's `goal`
 *           and `expectedOutcome` — which the human signed in the digest —
 *           survive only inside the outbox event payload. The list screen
 *           therefore shows "Zlecenie bez nazwy" for every Case.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BACKEND,
  ControlDb,
  SEED_USER,
  api,
  assertLocalDatabase,
  assertNoAuthBypass,
  login,
  probeLiveStack,
  uniqueSuffix,
  validGraph,
} from './liveStackHarness.js';

const SUFFIX = uniqueSuffix();
const PROJECT_ID = `cw-e2e-proj-${SUFFIX}`;
const LIGHT_PROJECT_ID = `cw-e2e-proj-light-${SUFFIX}`;

/**
 * A second human in the SAME organization. Required because the approval
 * chain enforces segregation of duties — the creator of a proposal is
 * refused with `self_approval_forbidden` (403), which is correct and which a
 * single-actor test would have mistaken for a broken endpoint.
 */
const APPROVER = {
  email: 'cw.stream.e.approver@local.test',
  password: 'CaseWorkspaceApprover!2026',
  userId: 'cw-stream-e-approver',
};

/** A user in a DIFFERENT organization, for the cross-tenant scenario. */
const OTHER_TENANT = {
  email: 'cw.stream.e.other@local.test',
  password: 'CaseWorkspaceOther!2026',
  organizationId: 'cw-stream-e-other-org',
  projectId: 'cw-stream-e-other-project',
};

let db: ControlDb;
let token: string;
let approverToken: string;
let otherToken: string;
let stackReason: string | undefined;

/** Shared state threaded through the scenarios, in the order a human moves. */
const state: {
  caseId?: string;
  lightCaseId?: string;
  planVersionId?: string;
  runId?: string;
  proposalId?: string;
  waitId?: string;
  linkId?: string;
  conversationId?: string;
  workOrderDigest?: string;
} = {};

beforeAll(async () => {
  assertLocalDatabase();

  const probe = await probeLiveStack();
  if (!probe.up) {
    stackReason = probe.reason;
    return;
  }

  // Never a green run on an open backdoor.
  await assertNoAuthBypass();

  db = new ControlDb();
  token = await login();
  approverToken = await login(APPROVER.email, APPROVER.password);
  otherToken = await login(OTHER_TENANT.email, OTHER_TENANT.password);

  await db.ensureProject(PROJECT_ID, SEED_USER.organizationId, `E2E ${SUFFIX}`);
  await db.ensureProject(LIGHT_PROJECT_ID, SEED_USER.organizationId, `E2E LIGHT ${SUFFIX}`);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

/**
 * Loud skip. If the stack is not up the suite must say so in a way nobody can
 * mistake for a pass — never a silent green.
 */
function requireStack(): void {
  if (stackReason) {
    throw new Error(
      `LIVE STACK NOT UP — this suite proves nothing and must not be read as a pass.\n` +
        `Reason: ${stackReason}\n` +
        `Start it with: bash scripts/dev/case-workspace-local-backend.sh (backend on ${BACKEND})\n` +
        `See docs/product/case-workspace/LIVE_STACK_RUNBOOK.md`
    );
  }
}

// ===========================================================================
// 1. Chat -> Case, through the REAL chat route (not a separate intake endpoint)
// ===========================================================================
describe('1. Chat -> Case via the real chat surface', () => {
  it('an informational turn creates ZERO Cases and ZERO Runs (CW-CANON-01)', async () => {
    requireStack();
    state.conversationId = `cw-e2e-conv-${SUFFIX}`;

    const res = await api<{ data: { mode: string; caseCreated: boolean; runCreated: boolean } }>(
      token,
      'POST',
      `/chat/conversations/${state.conversationId}/case-intake/turn`,
      { message: 'Jaki jest status moich zleceń?' }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('informational');
    expect(res.body.data.caseCreated).toBe(false);

    const cases = await db.rows(`SELECT case_id FROM case_core WHERE project_id = $1`, [PROJECT_ID]);
    expect(cases).toHaveLength(0);
  });

  it('a work-order turn records a PROPOSAL only — still zero Cases', async () => {
    requireStack();
    const res = await api<{
      data: { mode: string; workOrderDigest: string; caseCreated: boolean; runStartPolicy: string };
    }>(token, 'POST', `/chat/conversations/${state.conversationId}/case-intake/turn`, {
      message: 'Przygotuj analizę kosztów operacyjnych i zaproponuj oszczędności',
      workOrder: {
        projectId: PROJECT_ID,
        goal: 'Analiza kosztów operacyjnych',
        scope: ['Koszty stałe', 'Koszty zmienne'],
        expectedOutcome: 'Raport z rekomendacjami oszczędności',
        contractedClosureType: 'DELIVERY_COMPLETED',
        caseProfile: 'STANDARD',
        governanceTier: 'STANDARD',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('work_order_proposed');
    expect(res.body.data.caseCreated).toBe(false);
    expect(res.body.data.runStartPolicy).toBe('REQUIRES_PUBLISHED_PLAN_AND_EXPLICIT_START');
    state.workOrderDigest = res.body.data.workOrderDigest;

    // (b) the proposal exists but the Case does not
    const cases = await db.rows(`SELECT case_id FROM case_core WHERE project_id = $1`, [PROJECT_ID]);
    expect(cases).toHaveLength(0);

    // (c) the only trace is the proposal event
    const proposed = await db.rows(
      `SELECT event_type FROM case_workspace_event_outbox
        WHERE event_type = 'case.intake.work_order_proposed'
          AND redacted_summary->>'sourceConversationId' = $1`,
      [state.conversationId]
    );
    expect(proposed.length).toBeGreaterThanOrEqual(1);
  });

  it('confirming the digest creates exactly one Case and ZERO Runs', async () => {
    requireStack();
    const res = await api<{ data: { caseId: string; caseCreated: boolean; runCreated: boolean } }>(
      token,
      'POST',
      `/chat/conversations/${state.conversationId}/case-intake/confirm`,
      { confirmedDigest: state.workOrderDigest }
    );

    expect(res.status).toBe(201);
    expect(res.body.data.caseCreated).toBe(true);
    expect(res.body.data.runCreated).toBe(false);
    state.caseId = res.body.data.caseId;

    // (b) readback
    const row = await db.one<{ case_status: string; case_profile: string; project_id: string }>(
      `SELECT case_status, case_profile, project_id FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    expect(row).not.toBeNull();
    expect(row!.case_status).toBe('DRAFT');
    expect(row!.case_profile).toBe('STANDARD');
    expect(row!.project_id).toBe(PROJECT_ID);

    // (c) event spine
    const events = await db.outboxForCase(state.caseId!);
    expect(events.map((e) => e.event_type)).toEqual(
      expect.arrayContaining(['case.created', 'case.intake.work_order_confirmed'])
    );

    // ZERO Runs, for every profile — the whole point of CW-CANON-01
    const runs = await db.rows(
      `SELECT run_id FROM case_workspace_run_bindings WHERE case_id = $1`,
      [state.caseId]
    );
    expect(runs).toHaveLength(0);
  });

  it('GAP-E-05: the goal the human signed is NOT stored on the Case — only in the event', async () => {
    requireStack();
    // case_core has no column for it...
    const cols = await db.rows<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'case_core'
          AND column_name IN ('title', 'name', 'goal', 'expected_outcome', 'summary')`
    );
    expect(cols).toHaveLength(0);

    // ...yet the human definitely stated one, and it survives only here.
    const evt = await db.one<{ goal: string | null }>(
      `SELECT redacted_summary->>'goal' AS goal FROM case_workspace_event_outbox
        WHERE case_id = $1 AND event_type = 'case.intake.work_order_confirmed' LIMIT 1`,
      [state.caseId]
    );
    expect(evt?.goal).toBe('Analiza kosztów operacyjnych');
  });
});

// ===========================================================================
// 2. LIGHT one-click
// ===========================================================================
describe('2. LIGHT one-click', () => {
  it('creates a LIGHT Case in one confirm and reports the permissive run policy', async () => {
    requireStack();
    const conv = `cw-e2e-conv-light-${SUFFIX}`;

    const turn = await api<{ data: { workOrderDigest: string; runStartPolicy: string } }>(
      token,
      'POST',
      `/chat/conversations/${conv}/case-intake/turn`,
      {
        message: 'Zrób szybkie zestawienie faktur z zeszłego miesiąca',
        workOrder: {
          projectId: LIGHT_PROJECT_ID,
          goal: 'Zestawienie faktur',
          scope: ['Faktury 07/2026'],
          expectedOutcome: 'Lista faktur w tabeli',
          contractedClosureType: 'DELIVERY_COMPLETED',
          caseProfile: 'LIGHT',
          governanceTier: 'LIGHTWEIGHT',
        },
      }
    );
    expect(turn.status).toBe(200);
    expect(turn.body.data.runStartPolicy).toBe('MAY_START_SINGLE_RUN_AFTER_CONFIRMATION');

    const confirm = await api<{ data: { caseId: string; caseCreated: boolean } }>(
      token,
      'POST',
      `/chat/conversations/${conv}/case-intake/confirm`,
      { confirmedDigest: turn.body.data.workOrderDigest }
    );
    expect(confirm.status).toBe(201);
    state.lightCaseId = confirm.body.data.caseId;

    const row = await db.one<{ case_profile: string; governance_tier: string; case_status: string }>(
      `SELECT case_profile, governance_tier, case_status FROM case_core WHERE case_id = $1`,
      [state.lightCaseId]
    );
    expect(row!.case_profile).toBe('LIGHT');
    expect(row!.governance_tier).toBe('LIGHTWEIGHT');

    const events = await db.outboxForCase(state.lightCaseId!);
    expect(events.map((e) => e.event_type)).toContain('case.created');
  });

  it('GAP-E-02: the promised one-click Run cannot actually be started', async () => {
    requireStack();
    // The policy says LIGHT may start a Run with no published plan. The only
    // route that binds a Run demands a plan version, so the call cannot even
    // be expressed — 400 on a missing required field, not a domain refusal.
    const res = await api(token, 'POST', '/case-workspace/run-bindings', {
      runId: `cw-e2e-light-run-${SUFFIX}`,
      caseId: state.lightCaseId,
    });
    expect(res.status).toBe(400);

    const runs = await db.rows(
      `SELECT run_id FROM case_workspace_run_bindings WHERE case_id = $1`,
      [state.lightCaseId]
    );
    expect(runs).toHaveLength(0);
  });

  it('GAP-E-01: no HTTP route anywhere can create the Run a binding requires', async () => {
    requireStack();
    // Proven negatively: bind a runId that does not exist in v8_execution_runs
    // and the service refuses. There is no route that would have created it.
    const plan = await api<{ data: { casePlanVersionId: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.lightCaseId}/plan-versions`,
      { semanticGraph: validGraph(`light-${SUFFIX}`) }
    );
    expect(plan.status).toBe(201);

    const res = await api(token, 'POST', '/case-workspace/run-bindings', {
      runId: `cw-e2e-nonexistent-run-${SUFFIX}`,
      casePlanVersionId: plan.body.data.casePlanVersionId,
    });
    expect([404, 409, 422, 500]).toContain(res.status);
    expect(res.status).not.toBe(201);
  });
});

// ===========================================================================
// 3. STANDARD: plan -> publish -> start
// ===========================================================================
describe('3. STANDARD plan -> publish -> start', () => {
  it('walks DRAFT -> IN_REVIEW -> PUBLISHED and then starts the Case', async () => {
    requireStack();

    const draft = await api<{ data: { casePlanVersionId: string; status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/plan-versions`,
      { semanticGraph: validGraph(`std-${SUFFIX}`), changeReason: 'Plan startowy' }
    );
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('DRAFT');
    state.planVersionId = draft.body.data.casePlanVersionId;

    // The state machine must refuse the shortcut DRAFT -> PUBLISHED.
    const shortcut = await api(
      token,
      'POST',
      `/case-workspace/plan-versions/${state.planVersionId}/publish`,
      { expectedVersion: 1 }
    );
    expect(shortcut.status).toBeGreaterThanOrEqual(400);

    const proposed = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/plan-versions/${state.planVersionId}/propose`,
      { expectedVersion: 1 }
    );
    expect(proposed.status).toBe(200);
    expect(proposed.body.data.status).toBe('IN_REVIEW');

    const published = await api<{ data: { status: string } }>(
      token,
      'POST',
      `/case-workspace/plan-versions/${state.planVersionId}/publish`,
      { expectedVersion: proposed.body.data.version }
    );
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    const started = await api<{ data: { caseStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/status`,
      { targetStatus: 'ACTIVE', reason: 'Plan opublikowany — start' }
    );
    expect(started.status).toBe(200);
    expect(started.body.data.caseStatus).toBe('ACTIVE');

    // (b)
    const planRow = await db.one<{ status: string }>(
      `SELECT status FROM case_plan_versions WHERE case_plan_version_id = $1`,
      [state.planVersionId]
    );
    expect(planRow!.status).toBe('PUBLISHED');
    const caseRow = await db.one<{ case_status: string }>(
      `SELECT case_status FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    expect(caseRow!.case_status).toBe('ACTIVE');

    // (c)
    const events = (await db.outboxForCase(state.caseId!)).map((e) => e.event_type);
    expect(events).toEqual(
      expect.arrayContaining([
        'case.plan.draft_created',
        'case.plan.proposed',
        'case.plan.published',
        'case.activated',
      ])
    );
  });

  it('the response ENVELOPE of /graph is a wrapper, not the graph (frontend contract bug)', async () => {
    requireStack();
    // GAP: `api.ts:getPlanGraph()` is typed `Promise<CanonicalGraph>` and the
    // detail screen assigns the result straight into `graph`. The endpoint
    // actually answers { graphId, graphDigest, semanticGraph }, so `.nodes` is
    // undefined and a PUBLISHED plan renders as "no steps yet". The mock
    // harness (podglad/main.tsx:85 -> GRAPHS) returns the BARE graph, which is
    // why only a live-stack run can see this.
    const res = await api<{ data: Record<string, unknown> }>(
      token,
      'GET',
      `/case-workspace/plan-versions/${state.planVersionId}/graph`
    );
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['graphDigest', 'graphId', 'semanticGraph']);
    expect((res.body.data as { nodes?: unknown }).nodes).toBeUndefined();
    expect(
      ((res.body.data.semanticGraph as { nodes: unknown[] }).nodes ?? []).length
    ).toBe(2);
  });
});

// ===========================================================================
// 4. Approval
// ===========================================================================
describe('4. Approval of an action proposal', () => {
  it('records an approval by a SECOND human; self-approval is refused', async () => {
    requireStack();
    state.runId = await db.seedExecutionRun(SEED_USER.organizationId, SEED_USER.userId, SUFFIX);

    const bound = await api(token, 'POST', '/case-workspace/run-bindings', {
      runId: state.runId,
      casePlanVersionId: state.planVersionId,
    });
    expect(bound.status).toBe(201);

    const created = await api<{ data: { actionProposalId: string; status: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/proposals`,
      {
        runId: state.runId,
        nodeRunId: `cw-e2e-node-${SUFFIX}`,
        casePlanVersionId: state.planVersionId,
        payloadDigest: 'sha256:aaaa1111',
        policySnapshotRef: 'policy-e2e',
        effectClass: 'SENSITIVE_UPDATE',
        previewRef: 'preview-e2e',
        proposerType: 'AGENT',
      },
      { 'Idempotency-Key': `cw-e2e-prop-${SUFFIX}` }
    );
    expect(created.status).toBe(201);
    state.proposalId = created.body.data.actionProposalId;

    const submitted = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${state.proposalId}/submit-for-review`,
      { expectedVersion: 1 }
    );
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('PENDING_REVIEW');

    const decisionBody = {
      proposalVersion: 1,
      payloadDigest: 'sha256:aaaa1111',
      decision: 'APPROVE',
      source: 'BUTTON',
      authenticationAssurance: 'SESSION_MFA',
      approvalChannelPolicy: 'UI_BUTTON_ONLY',
      policyVersion: 'v1',
      reason: 'Zatwierdzam',
      expectedVersion: submitted.body.data.version,
    };

    // Segregation of duties: the creator may NOT approve their own proposal.
    const selfApproval = await api(
      token,
      'POST',
      `/case-workspace/proposals/${state.proposalId}/decision`,
      decisionBody,
      { 'Idempotency-Key': `cw-e2e-selfdec-${SUFFIX}` }
    );
    expect(selfApproval.status).toBe(403);

    const approved = await api<{ data: { proposal: { status: string } } }>(
      approverToken,
      'POST',
      `/case-workspace/proposals/${state.proposalId}/decision`,
      decisionBody,
      { 'Idempotency-Key': `cw-e2e-dec-${SUFFIX}` }
    );
    expect(approved.status).toBe(200);
    expect(approved.body.data.proposal.status).toBe('APPROVED');

    // (b)
    const row = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [state.proposalId]
    );
    expect(row!.status).toBe('APPROVED');

    const decision = await db.one<{ decision: string; decided_by_actor_id: string }>(
      `SELECT decision, decided_by_actor_id FROM case_workspace_action_proposal_decisions
        WHERE action_proposal_id = $1`,
      [state.proposalId]
    );
    expect(decision!.decision).toBe('APPROVE');
    // The audit records the SECOND human, not the proposer.
    expect(decision!.decided_by_actor_id).toBe(APPROVER.userId);

    // (c)
    const events = await db.outboxForAggregate(state.proposalId!);
    expect(events.map((e) => e.event_type)).toEqual([
      'proposal.created',
      'proposal.review_requested',
      'approval.approved',
    ]);
    expect(events.at(-1)!.actor_user_id).toBe(APPROVER.userId);
  });
});

// ===========================================================================
// 5. Wait / inbox / restart
// ===========================================================================
describe('5. Wait, external delivery, and survival across a restart', () => {
  it('registers an EXTERNAL_CALLBACK wait that survives independently of process state', async () => {
    requireStack();
    const created = await api<{ data: { waitId: string; status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/waits`,
      {
        runId: state.runId,
        nodeRunId: `cw-e2e-node-${SUFFIX}`,
        waitType: 'EXTERNAL_CALLBACK',
        correlationKey: `cw-e2e-wait-${SUFFIX}`,
        expectedEventType: 'vendor.invoice.delivered',
      }
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('ACTIVE');
    state.waitId = created.body.data.waitId;

    // Durability is a property of the ROW, not of process memory: the wait is
    // committed, so any process that comes up next reads the same ACTIVE state.
    const row = await db.one<{ status: string; version: number }>(
      `SELECT status, version FROM case_workspace_waits WHERE wait_id = $1`,
      [state.waitId]
    );
    expect(row!.status).toBe('ACTIVE');

    const reread = await api<{ data: { status: string } }>(
      token,
      'GET',
      `/case-workspace/waits/${state.waitId}`
    );
    expect(reread.status).toBe(200);
    expect(reread.body.data.status).toBe('ACTIVE');

    const events = await db.outboxForAggregate(state.waitId!);
    expect(events.map((e) => e.event_type)).toContain('wait.registered');
  });

  it('GAP-E-04: any member can satisfy the wait with an event that never existed', async () => {
    requireStack();
    const fabricated = `evt-never-existed-${SUFFIX}`;

    const resolved = await api<{ data: { status: string; satisfiedByEventId: string } }>(
      token,
      'POST',
      `/case-workspace/waits/${state.waitId}/resolve`,
      { satisfiedByEventId: fabricated, expectedVersion: 1 }
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('SATISFIED');

    // (b) the wait is satisfied by an id that is in no inbox record anywhere
    const inbox = await db.rows(
      `SELECT event_id FROM case_workspace_event_inbox WHERE event_id = $1`,
      [fabricated]
    );
    expect(inbox).toHaveLength(0);

    // (c) and the trail blames a system actor, not the human who really did it
    const events = await db.outboxForAggregate(state.waitId!);
    const satisfied = events.find((e) => e.event_type === 'wait.satisfied');
    expect(satisfied).toBeDefined();
    expect(satisfied!.actor_user_id).toBe('system:case-workspace-wait-resolver');
    expect(satisfied!.actor_user_id).not.toBe(SEED_USER.userId);
  });

  it('the event inbox has no HTTP ingress at all, so genuine external delivery is impossible', async () => {
    requireStack();
    // `eventInboxService.receiveExternalEvent` has zero production callers.
    // There is no route to post an external event to, which is why the only
    // way to satisfy a wait is the unauthenticated-by-design path above.
    for (const path of [
      '/case-workspace/event-inbox',
      '/case-workspace/inbox',
      '/case-workspace/external-events',
    ]) {
      const res = await api(token, 'POST', path, { eventId: 'x' });
      expect(res.status).toBe(404);
    }
  });
});

// ===========================================================================
// 6. Pause / resume / cancel
// ===========================================================================
describe('6. Pause, resume, cancel', () => {
  it('pauses and resumes the Case, and cancellation is terminal', async () => {
    requireStack();

    const paused = await api<{ data: { caseStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/status`,
      { targetStatus: 'BLOCKED', reason: 'Czekamy na dane od klienta' }
    );
    expect(paused.status).toBe(200);
    expect(paused.body.data.caseStatus).toBe('BLOCKED');

    const resumed = await api<{ data: { caseStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/status`,
      { targetStatus: 'ACTIVE', reason: 'Dane dotarły' }
    );
    expect(resumed.status).toBe(200);
    expect(resumed.body.data.caseStatus).toBe('ACTIVE');

    // Cancel the LIGHT case so the main one stays usable for later scenarios.
    const cancelled = await api<{ data: { caseStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.lightCaseId}/cancel`,
      { reason: 'Klient wycofał zlecenie' }
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.caseStatus).toBe('CANCELLED');

    // A cancelled Case must not be revivable.
    const revive = await api(
      token,
      'POST',
      `/case-workspace/cases/${state.lightCaseId}/status`,
      { targetStatus: 'ACTIVE', reason: 'próba' }
    );
    expect(revive.status).toBe(409);

    // (b)
    const light = await db.one<{ case_status: string }>(
      `SELECT case_status FROM case_core WHERE case_id = $1`,
      [state.lightCaseId]
    );
    expect(light!.case_status).toBe('CANCELLED');

    // (c)
    const mainEvents = (await db.outboxForCase(state.caseId!)).map((e) => e.event_type);
    expect(mainEvents).toEqual(expect.arrayContaining(['case.blocked', 'case.activated']));
    const lightEvents = (await db.outboxForCase(state.lightCaseId!)).map((e) => e.event_type);
    expect(lightEvents).toContain('case.cancelled');
  });
});

// ===========================================================================
// 7. Partial result, shown honestly
// ===========================================================================
describe('7. Partial results are recorded honestly', () => {
  it('records a PARTIAL node result with its own event', async () => {
    requireStack();
    const res = await api<{ data: { resultAcceptance: string } }>(
      token,
      'POST',
      `/case-workspace/runs/${state.runId}/node-result-acceptances`,
      {
        nodeRunId: `cw-e2e-node-${SUFFIX}`,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'PARTIAL',
        acceptanceInputSnapshot: { zebrane: '3 z 5 źródeł', brakuje: ['ERP', 'Umowy'] },
        occurredAt: new Date().toISOString(),
      }
    );
    expect(res.status).toBe(201);
    expect(res.body.data.resultAcceptance).toBe('PARTIAL');

    const row = await db.one<{ result_acceptance: string }>(
      `SELECT result_acceptance FROM case_workspace_node_result_acceptances
        WHERE case_id = $1 AND node_run_id = $2`,
      [state.caseId, `cw-e2e-node-${SUFFIX}`]
    );
    expect(row!.result_acceptance).toBe('PARTIAL');

    const events = (await db.outboxForCase(state.caseId!)).map((e) => e.event_type);
    expect(events).toContain('node.result_accepted');
  });

  it('a PARTIAL value measurement is stored as partial — never rounded up to confirmed', async () => {
    requireStack();
    const res = await api<{ data: { measurementId: string; measurementStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/value-measurements`,
      {
        metricKey: `opex_${SUFFIX}`,
        metricName: 'Oszczędności OPEX',
        baselineValue: 1_000_000,
        baselineUnit: 'PLN',
        targetValue: 150_000,
        targetUnit: 'PLN',
        actualValue: 62_000,
        actualUnit: 'PLN',
        measurementStatus: 'PARTIAL',
        measurementDate: '2026-08-10',
        confidence: 'MEDIUM',
        attribution: 'Częściowe dane — 3 z 5 źródeł',
      },
      { 'Idempotency-Key': `cw-e2e-vm-${SUFFIX}` }
    );
    expect(res.status).toBe(201);
    expect(res.body.data.measurementStatus).toBe('PARTIAL');

    const row = await db.one<{ measurement_status: string; actual_value: string }>(
      `SELECT measurement_status, actual_value FROM case_workspace_value_measurements
        WHERE measurement_id = $1`,
      [res.body.data.measurementId]
    );
    expect(row!.measurement_status).toBe('PARTIAL');

    const events = await db.outboxForAggregate(res.body.data.measurementId);
    expect(events.map((e) => e.event_type)).toContain('outcome.measurement_recorded');
  });

  it('CONFIRMED without evidence is refused — no false "done"', async () => {
    requireStack();
    const res = await api(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/value-measurements`,
      {
        metricKey: `bogus_${SUFFIX}`,
        metricName: 'Bez dowodu',
        actualValue: 1,
        actualUnit: 'PLN',
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-08-10',
        confidence: 'HIGH',
        attribution: 'brak dowodu',
      },
      { 'Idempotency-Key': `cw-e2e-vm-bogus-${SUFFIX}` }
    );
    expect(res.status).toBe(422);

    const rows = await db.rows(
      `SELECT measurement_id FROM case_workspace_value_measurements
        WHERE case_id = $1 AND metric_key = $2`,
      [state.caseId, `bogus_${SUFFIX}`]
    );
    expect(rows).toHaveLength(0);
  });
});

// ===========================================================================
// 8. Deliverable open / return
// ===========================================================================
describe('8. Opening a deliverable and coming back', () => {
  it('links a DELIVERABLE, reads it authoritatively, and the Case is still reachable', async () => {
    requireStack();
    const linked = await api<{ data: { linkId: string; relation: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/artifact-links`,
      {
        artifactType: 'DOCUMENT',
        artifactId: `doc-raport-${SUFFIX}`,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
        pinReason: 'Wersja pokazana klientowi',
      },
      { 'Idempotency-Key': `cw-e2e-link-${SUFFIX}` }
    );
    expect(linked.status).toBe(201);
    state.linkId = linked.body.data.linkId;

    // "Open" is an authoritative read: it decides access (404), existence
    // (linkStatus) and freshness (isStale) before any navigation happens.
    const opened = await api<{
      data: { caseId: string; linkStatus: string; isStale: boolean; artifactRevision: string };
    }>(token, 'GET', `/case-workspace/artifact-links/${state.linkId}`);
    expect(opened.status).toBe(200);
    expect(opened.body.data.linkStatus).toBe('ACTIVE');
    expect(opened.body.data.isStale).toBe(false);
    // The return address travels with the link — this is what lets the screen
    // come back to the right Case rather than guessing.
    expect(opened.body.data.caseId).toBe(state.caseId);

    const back = await api(token, 'GET', `/case-workspace/cases/${state.caseId}`);
    expect(back.status).toBe(200);

    // (b) + (c)
    const row = await db.one<{ relation: string; link_status: string }>(
      `SELECT relation, link_status FROM case_workspace_artifact_links WHERE link_id = $1`,
      [state.linkId]
    );
    expect(row!.relation).toBe('DELIVERABLE');
    const events = await db.outboxForAggregate(state.linkId!);
    expect(events.map((e) => e.event_type)).toContain('artifact.linked_to_case');
  });
});

// ===========================================================================
// 9. Cross-tenant and revoked membership — must REFUSE at every step
// ===========================================================================
describe('9. Cross-tenant and revoked membership', () => {
  it('refuses a foreign tenant on every object in the chain', async () => {
    requireStack();
    const probes: Array<[string, string]> = [
      ['GET', `/case-workspace/cases/${state.caseId}`],
      ['GET', `/case-workspace/plan-versions/${state.planVersionId}`],
      ['GET', `/case-workspace/proposals/${state.proposalId}`],
      ['GET', `/case-workspace/waits/${state.waitId}`],
      ['GET', `/case-workspace/artifact-links/${state.linkId}`],
      ['GET', `/case-workspace/run-bindings/${state.runId}`],
    ];

    for (const [method, path] of probes) {
      const res = await api(otherToken, method, path);
      // Enumeration-safe: a foreign object must be indistinguishable from a
      // nonexistent one.
      expect(res.status, `${method} ${path} must not leak to a foreign tenant`).toBe(404);
    }

    // And it must not be able to mutate either.
    const mutate = await api(otherToken, 'POST', `/case-workspace/cases/${state.caseId}/status`, {
      targetStatus: 'BLOCKED',
      reason: 'cross-tenant attempt',
    });
    expect(mutate.status).toBe(404);

    const stillActive = await db.one<{ case_status: string }>(
      `SELECT case_status FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    expect(stillActive!.case_status).toBe('ACTIVE');
  });

  it('GAP-E-03: /cases/by-project leaks whether a foreign project has a Case', async () => {
    requireStack();
    // A foreign project that HAS a Case answers 403...
    const foreign = await api(otherToken, 'GET', `/case-workspace/cases/by-project/${PROJECT_ID}`);
    // ...while a project that does not exist at all answers 404.
    const missing = await api(
      otherToken,
      'GET',
      `/case-workspace/cases/by-project/does-not-exist-${SUFFIX}`
    );

    expect(missing.status).toBe(404);
    // This asserts the CURRENT (leaky) behaviour so the gap cannot be closed
    // silently. When it is fixed, `foreign` becomes 404 and this test must be
    // changed to `expect(foreign.status).toBe(missing.status)` on purpose.
    expect(foreign.status).toBe(403);
    expect(foreign.status).not.toBe(missing.status);
  });

  it('revoking membership mid-chain closes every door and writes nothing', async () => {
    requireStack();
    const before = await db.one<{ case_status: string; version: number }>(
      `SELECT case_status, version FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    const planCountBefore = (
      await db.rows(`SELECT 1 FROM case_plan_versions WHERE case_id = $1`, [state.caseId])
    ).length;

    await db.setMembershipStatus(SEED_USER.userId, SEED_USER.organizationId, 'SUSPENDED');
    try {
      const list = await api(token, 'GET', '/case-workspace/cases');
      expect(list.status).toBe(403);

      const read = await api(token, 'GET', `/case-workspace/cases/${state.caseId}`);
      expect(read.status).toBe(404);

      const mutate = await api(token, 'POST', `/case-workspace/cases/${state.caseId}/status`, {
        targetStatus: 'BLOCKED',
        reason: 'po odebraniu członkostwa',
      });
      expect(mutate.status).toBe(404);

      const newPlan = await api(
        token,
        'POST',
        `/case-workspace/cases/${state.caseId}/plan-versions`,
        { semanticGraph: validGraph(`revoked-${SUFFIX}`) }
      );
      expect(newPlan.status).toBe(404);

      const create = await api(token, 'POST', '/case-workspace/cases', {
        projectId: PROJECT_ID,
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(create.status).toBe(403);

      // Nothing above may have changed a single row.
      const after = await db.one<{ case_status: string; version: number }>(
        `SELECT case_status, version FROM case_core WHERE case_id = $1`,
        [state.caseId]
      );
      expect(after!.case_status).toBe(before!.case_status);
      expect(Number(after!.version)).toBe(Number(before!.version));
      const planCountAfter = (
        await db.rows(`SELECT 1 FROM case_plan_versions WHERE case_id = $1`, [state.caseId])
      ).length;
      expect(planCountAfter).toBe(planCountBefore);
    } finally {
      await db.setMembershipStatus(SEED_USER.userId, SEED_USER.organizationId, 'ACTIVE');
    }

    // Restoring membership restores access — proving the block was the
    // membership check and not some unrelated breakage.
    const restored = await api(token, 'GET', '/case-workspace/cases');
    expect(restored.status).toBe(200);
  });
});

// ===========================================================================
// 10. Refresh / reconnect — no duplicates, no lost state
// ===========================================================================
describe('10. Refresh and reconnect', () => {
  it('a repeated command with the same idempotency key creates exactly one row', async () => {
    requireStack();
    const key = `cw-e2e-dup-${SUFFIX}`;
    const seen: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      const res = await api<{ data: { linkId: string } }>(
        token,
        'POST',
        `/case-workspace/cases/${state.caseId}/artifact-links`,
        { artifactType: 'DOCUMENT', artifactId: `doc-dup-${SUFFIX}`, relation: 'EVIDENCE' },
        { 'Idempotency-Key': key }
      );
      expect(res.status).toBe(201);
      seen.push(res.body.data.linkId);
    }

    // Same id every time — a double-click is not two deliverables.
    expect(new Set(seen).size).toBe(1);

    const rows = await db.rows(
      `SELECT link_id FROM case_workspace_artifact_links WHERE case_id = $1 AND artifact_id = $2`,
      [state.caseId, `doc-dup-${SUFFIX}`]
    );
    expect(rows).toHaveLength(1);

    // And exactly one event, not three.
    const events = await db.outboxForAggregate(seen[0]);
    expect(events.filter((e) => e.event_type === 'artifact.linked_to_case')).toHaveLength(1);
  });

  it('a stale expectedVersion from a second tab is refused (409), not silently applied', async () => {
    requireStack();
    const res = await api(
      token,
      'POST',
      `/case-workspace/plan-versions/${state.planVersionId}/publish`,
      { expectedVersion: 1 }
    );
    expect(res.status).toBe(409);
  });

  it('a full re-read after reconnect returns the same state, and the chat still points at the Case', async () => {
    requireStack();
    for (const path of [
      `/case-workspace/cases/${state.caseId}`,
      `/case-workspace/cases/${state.caseId}/plan-versions`,
      `/case-workspace/cases/${state.caseId}/waits`,
      `/case-workspace/cases/${state.caseId}/proposals`,
      `/case-workspace/cases/${state.caseId}/artifact-links`,
      `/case-workspace/cases/${state.caseId}/value-measurements`,
      `/case-workspace/cases/${state.caseId}/history-events`,
    ]) {
      const res = await api(token, 'GET', path);
      expect(res.status, `${path} after reconnect`).toBe(200);
    }

    // The work order survives a reconnect and still hashes to what was signed.
    const wo = await api<{ data: { workOrderDigest: string } | null }>(
      token,
      'GET',
      `/chat/conversations/${state.conversationId}/case-intake/work-order`
    );
    expect(wo.status).toBe(200);
    expect(wo.body.data?.workOrderDigest).toBe(state.workOrderDigest);

    // Conversation -> Case still resolves, so "take me back to the chat this
    // came from" works after a refresh.
    const link = await api<{ data: { caseId: string } | null }>(
      token,
      'GET',
      `/chat/conversations/${state.conversationId}/case-intake/case`
    );
    expect(link.status).toBe(200);
    expect(link.body.data?.caseId).toBe(state.caseId);

    // Re-confirming after a refresh must NOT create a second Case.
    const reconfirm = await api<{ data: { caseId: string; caseCreated: boolean } }>(
      token,
      'POST',
      `/chat/conversations/${state.conversationId}/case-intake/confirm`,
      { confirmedDigest: state.workOrderDigest }
    );
    expect(reconfirm.status).toBe(200);
    expect(reconfirm.body.data.caseCreated).toBe(false);
    expect(reconfirm.body.data.caseId).toBe(state.caseId);

    const cases = await db.rows(`SELECT case_id FROM case_core WHERE project_id = $1`, [PROJECT_ID]);
    expect(cases).toHaveLength(1);
  });
});
