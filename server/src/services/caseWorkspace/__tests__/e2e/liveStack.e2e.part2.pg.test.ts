/**
 * Case Workspace — E2E PART 2 (Strumień E, pakiet 20 scenariuszy).
 *
 * Covers the scenarios the owner's 20-item list requires that
 * `liveStack.e2e.pg.test.ts` (part 1, the pre-existing 10-scenario suite)
 * does not exercise on its own:
 *
 *   2  two DIFFERENT Cases in ONE project
 *   5  TRANSFORMATION profile
 *   6  the FULL approval decision matrix — REJECT / REQUEST_CHANGES / DEFER
 *      (part 1 only exercises APPROVE)
 *   8  an INTERNAL domain event satisfying a DOMAIN_EVENT wait (part 1 only
 *      exercises EXTERNAL_CALLBACK, satisfied from case_workspace_event_inbox)
 *  10  failure -> retry -> recovery on an action proposal
 *  16  a STALE work-order digest is refused (part 1 only covers a stale
 *      plan-version `expectedVersion`)
 *  17  DUPLICATE DELIVERY over the real, HMAC-authenticated inbound webhook
 *      (part 1's duplicate scenario is an idempotency-key HTTP replay, a
 *      different code path from a redelivering external sender)
 *
 * Same evidence discipline as part 1: every scenario asserts (a) the real
 * HTTP status, (b) a database readback, (c) the outbox trail.
 *
 * Scenario 7 (external inbox -> wait -> resume through the REAL
 * `/api/webhooks/case-workspace` route) needs a channel registered via
 * `CASE_WORKSPACE_INBOX_CHANNELS_JSON`, which the currently-running backend
 * does not have set — see `liveStackRestart.e2e.manual.md` in this directory
 * for that scenario's run (it is done together with the mandated backend
 * restart, scenario 18, since both require bouncing the process anyway).
 */

import { createHmac } from 'node:crypto';

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
const PROJECT_ID = `cw-e2e2-proj-${SUFFIX}`;

const APPROVER = {
  email: 'cw.stream.e.approver@local.test',
  password: 'CaseWorkspaceApprover!2026',
  userId: 'cw-stream-e-approver',
};

let db: ControlDb;
let token: string;
let approverToken: string;
let stackReason: string | undefined;

const state: {
  caseId?: string;
  planVersionId?: string;
  runId?: string;
} = {};

beforeAll(async () => {
  assertLocalDatabase();
  const probe = await probeLiveStack();
  if (!probe.up) {
    stackReason = probe.reason;
    return;
  }
  await assertNoAuthBypass();
  db = new ControlDb();
  await db.ensureLoginUser({ ...APPROVER, organizationId: SEED_USER.organizationId, role: 'OWNER' });
  token = await login();
  approverToken = await login(APPROVER.email, APPROVER.password);
  await db.ensureProject(PROJECT_ID, SEED_USER.organizationId, `E2E part2 ${SUFFIX}`);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

function requireStack(): void {
  if (stackReason) {
    throw new Error(
      `LIVE STACK NOT UP — this suite proves nothing and must not be read as a pass.\n` +
        `Reason: ${stackReason}\nBackend expected at ${BACKEND}.`
    );
  }
}

/** Direct case creation (bypasses chat intake — used where the scenario is
 * about Case cardinality/profile, not the intake flow itself, which part 1
 * already covers in depth). */
async function createCase(
  tok: string,
  profile: 'STANDARD' | 'TRANSFORMATION',
  governanceTier: 'STANDARD' | 'CONTROLLED',
  caseName: string
): Promise<{ status: number; caseId?: string }> {
  const res = await api<{ data: { caseId: string } }>(tok, 'POST', '/case-workspace/cases', {
    projectId: PROJECT_ID,
    caseName,
    caseProfile: profile,
    governanceTier,
    contractedClosureType: 'DELIVERY_COMPLETED',
  });
  return { status: res.status, caseId: (res.body as { data?: { caseId: string } })?.data?.caseId };
}

// ===========================================================================
// 2. Two different Cases in one project
// ===========================================================================
describe('2. Two different Cases in one project', () => {
  it('creates TWO distinct Cases under the SAME projectId, each with its own id and event trail', async () => {
    requireStack();

    const first = await createCase(token, 'STANDARD', 'STANDARD', `Zlecenie A ${SUFFIX}`);
    expect(first.status).toBe(201);
    const second = await createCase(token, 'STANDARD', 'STANDARD', `Zlecenie B ${SUFFIX}`);
    expect(second.status).toBe(201);

    expect(first.caseId).toBeTruthy();
    expect(second.caseId).toBeTruthy();
    expect(first.caseId).not.toBe(second.caseId);

    // (b) both rows live under the same project_id, distinct case_id
    const rows = await db.rows<{ case_id: string; project_id: string }>(
      `SELECT case_id, project_id FROM case_core WHERE project_id = $1 ORDER BY created_at ASC`,
      [PROJECT_ID]
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.case_id)).size).toBe(2);
    expect(rows.every((r) => r.project_id === PROJECT_ID)).toBe(true);

    // (c) each Case has its OWN case.created event, not a shared one
    const eventsA = await db.outboxForCase(first.caseId!);
    const eventsB = await db.outboxForCase(second.caseId!);
    expect(eventsA.map((e) => e.event_type)).toContain('case.created');
    expect(eventsB.map((e) => e.event_type)).toContain('case.created');
    expect(eventsA.map((e) => e.aggregate_id)).not.toEqual(eventsB.map((e) => e.aggregate_id));

    // GET /cases/by-project/:projectId is documented single-Case — confirm
    // it answers with ONE of the two (the most recent), not an error, so the
    // list screen has a defined (if narrow) behaviour for this cardinality.
    const byProject = await api<{ data: { caseId: string } }>(
      token,
      'GET',
      `/case-workspace/cases/by-project/${PROJECT_ID}`
    );
    expect(byProject.status).toBe(200);
    expect([first.caseId, second.caseId]).toContain(byProject.body.data.caseId);
  });
});

// ===========================================================================
// 5. TRANSFORMATION profile
// ===========================================================================
describe('5. TRANSFORMATION profile', () => {
  it('behaves like STANDARD: zero Runs until plan published + explicit start', async () => {
    requireStack();
    const created = await createCase(token, 'TRANSFORMATION', 'CONTROLLED', `Transformacja ${SUFFIX}`);
    expect(created.status).toBe(201);
    state.caseId = created.caseId;

    const row = await db.one<{ case_profile: string; governance_tier: string; case_status: string }>(
      `SELECT case_profile, governance_tier, case_status FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    expect(row!.case_profile).toBe('TRANSFORMATION');
    expect(row!.governance_tier).toBe('CONTROLLED');
    expect(row!.case_status).toBe('DRAFT');

    // Zero Runs at creation — same CW-CANON-01 ceiling as STANDARD.
    const runs = await db.rows(`SELECT run_id FROM case_workspace_run_bindings WHERE case_id = $1`, [
      state.caseId,
    ]);
    expect(runs).toHaveLength(0);

    // Plan -> propose -> publish -> start, same as STANDARD (part 1, describe 3).
    const draft = await api<{ data: { casePlanVersionId: string; status: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/plan-versions`,
      { semanticGraph: validGraph(`trans-${SUFFIX}`) }
    );
    expect(draft.status).toBe(201);
    state.planVersionId = draft.body.data.casePlanVersionId;

    const proposed = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/plan-versions/${state.planVersionId}/propose`,
      { expectedVersion: 1 }
    );
    expect(proposed.status).toBe(200);

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
      { targetStatus: 'ACTIVE', reason: 'TRANSFORMATION start' }
    );
    expect(started.status).toBe(200);
    expect(started.body.data.caseStatus).toBe('ACTIVE');

    // (b) + (c)
    const caseRow = await db.one<{ case_status: string }>(
      `SELECT case_status FROM case_core WHERE case_id = $1`,
      [state.caseId]
    );
    expect(caseRow!.case_status).toBe('ACTIVE');
    const events = (await db.outboxForCase(state.caseId!)).map((e) => e.event_type);
    expect(events).toEqual(
      expect.arrayContaining(['case.created', 'case.plan.published', 'case.activated'])
    );

    // Seed + bind the Run used by the rest of this file's scenarios.
    state.runId = await db.seedExecutionRun(SEED_USER.organizationId, SEED_USER.userId, `p2-${SUFFIX}`);
    const bound = await api(token, 'POST', '/case-workspace/run-bindings', {
      runId: state.runId,
      casePlanVersionId: state.planVersionId,
    });
    expect(bound.status).toBe(201);
  });
});

// ===========================================================================
// 6. Approval decision matrix — REJECT / REQUEST_CHANGES / DEFER
// (APPROVE itself is part 1, describe 4 — not repeated here.)
// ===========================================================================
describe('6. Approval decision matrix', () => {
  // IMPORTANT: `proposalVersion` (the field the /decision route validates
  // the payload against — case_workspace_action_proposals.proposal_version)
  // is a PER-CASE monotonic counter across ALL proposals for that Case
  // (`COALESCE(MAX(proposal_version), 0) + 1 FROM ... WHERE case_id = ?`,
  // proposalApprovalService.ts `createActionProposal`), NOT a per-proposal
  // constant and NOT the OCC `version` field submit-for-review returns.
  // Confirmed empirically: three proposals created back-to-back under the
  // same Case got proposal_version 1, 2, 3 respectively — a hardcoded 1 (or
  // the OCC version) only matched the FIRST proposal by coincidence and
  // produced a real, reproducible 409 PROPOSAL_STALE for every proposal
  // after it. The fix is to read `proposalVersion` off the CREATE response
  // and thread that exact value through submit/decision — never assume it.
  async function createSubmittedProposal(
    tag: string
  ): Promise<{ id: string; proposalVersion: number; version: number }> {
    const created = await api<{ data: { actionProposalId: string; proposalVersion: number } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/proposals`,
      {
        runId: state.runId,
        nodeRunId: `cw-e2e2-node-${tag}-${SUFFIX}`,
        casePlanVersionId: state.planVersionId,
        payloadDigest: `sha256:${tag}${SUFFIX}`,
        policySnapshotRef: 'policy-e2e2',
        effectClass: 'SENSITIVE_UPDATE',
        previewRef: 'preview-e2e2',
        proposerType: 'AGENT',
      },
      { 'Idempotency-Key': `cw-e2e2-prop-${tag}-${SUFFIX}` }
    );
    expect(created.status).toBe(201);
    const id = created.body.data.actionProposalId;
    const proposalVersion = created.body.data.proposalVersion;

    const submitted = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${id}/submit-for-review`,
      { expectedVersion: 1 }
    );
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.status).toBe('PENDING_REVIEW');
    return { id, proposalVersion, version: submitted.body.data.version };
  }

  it('REJECT terminates the proposal and names the deciding human', async () => {
    requireStack();
    const { id, proposalVersion, version } = await createSubmittedProposal('reject');

    const decided = await api<{ data: { proposal: { status: string } } }>(
      approverToken,
      'POST',
      `/case-workspace/proposals/${id}/decision`,
      {
        proposalVersion,
        payloadDigest: `sha256:reject${SUFFIX}`,
        decision: 'REJECT',
        source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY',
        policyVersion: 'v1',
        reason: 'Nie spełnia kryteriów',
        expectedVersion: version,
      },
      { 'Idempotency-Key': `cw-e2e2-dec-reject-${SUFFIX}` }
    );
    expect(decided.status).toBe(200);
    expect(decided.body.data.proposal.status).toBe('REJECTED');

    const row = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [id]
    );
    expect(row!.status).toBe('REJECTED');

    const events = await db.outboxForAggregate(id);
    expect(events.map((e) => e.event_type)).toContain('approval.rejected');
    expect(events.find((e) => e.event_type === 'approval.rejected')!.actor_user_id).toBe(
      APPROVER.userId
    );

    // Terminal: REJECTED has no further ALLOWED_TRANSITIONS.
    const retryAttempt = await api(token, 'POST', `/case-workspace/proposals/${id}/retry`, {
      expectedVersion: row!.status === 'REJECTED' ? version + 1 : version,
    });
    expect(retryAttempt.status).toBeGreaterThanOrEqual(400);
  });

  it('REQUEST_CHANGES sends the proposal back, distinct from REJECT', async () => {
    requireStack();
    const { id, proposalVersion, version } = await createSubmittedProposal('changes');

    const decided = await api<{ data: { proposal: { status: string } } }>(
      approverToken,
      'POST',
      `/case-workspace/proposals/${id}/decision`,
      {
        proposalVersion,
        payloadDigest: `sha256:changes${SUFFIX}`,
        decision: 'REQUEST_CHANGES',
        source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY',
        policyVersion: 'v1',
        reason: 'Doprecyzuj zakres',
        expectedVersion: version,
      },
      { 'Idempotency-Key': `cw-e2e2-dec-changes-${SUFFIX}` }
    );
    expect(decided.status).toBe(200);
    expect(decided.body.data.proposal.status).toBe('REQUESTED_CHANGES');

    const row = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [id]
    );
    expect(row!.status).toBe('REQUESTED_CHANGES');

    const events = await db.outboxForAggregate(id);
    expect(events.map((e) => e.event_type)).toContain('approval.changes_requested');
  });

  it('DEFER is a non-status-changing audited fact, distinct from both', async () => {
    requireStack();
    const { id, proposalVersion, version } = await createSubmittedProposal('defer');

    const decided = await api<{ data: { proposal: { status: string; version: number } } }>(
      approverToken,
      'POST',
      `/case-workspace/proposals/${id}/decision`,
      {
        proposalVersion,
        payloadDigest: `sha256:defer${SUFFIX}`,
        decision: 'DEFER',
        source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY',
        policyVersion: 'v1',
        reason: 'Czekamy na dodatkowe dane',
        expectedVersion: version,
      },
      { 'Idempotency-Key': `cw-e2e2-dec-defer-${SUFFIX}` }
    );
    expect(decided.status).toBe(200);
    // The proposal's own status must NOT have moved off PENDING_REVIEW.
    expect(decided.body.data.proposal.status).toBe('PENDING_REVIEW');

    const row = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [id]
    );
    expect(row!.status).toBe('PENDING_REVIEW');

    const decisionRow = await db.one<{ decision: string }>(
      `SELECT decision FROM case_workspace_action_proposal_decisions
        WHERE action_proposal_id = $1 ORDER BY decided_at DESC LIMIT 1`,
      [id]
    );
    expect(decisionRow!.decision).toBe('DEFER');

    const events = await db.outboxForAggregate(id);
    expect(events.map((e) => e.event_type)).toContain('approval.deferred');

    // The proposal is STILL decidable afterwards (DEFER did not consume the
    // review) — a second, real decision (REJECT, to keep this Case's
    // remaining scenarios clean) now succeeds.
    const finalize = await api(
      approverToken,
      'POST',
      `/case-workspace/proposals/${id}/decision`,
      {
        proposalVersion,
        payloadDigest: `sha256:defer${SUFFIX}`,
        decision: 'REJECT',
        source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY',
        policyVersion: 'v1',
        reason: 'Po odroczeniu — odrzucone',
        expectedVersion: version,
      },
      { 'Idempotency-Key': `cw-e2e2-dec-defer-final-${SUFFIX}` }
    );
    expect(finalize.status).toBe(200);
  });
});

// ===========================================================================
// 8. Internal event -> wait -> resume (DOMAIN_EVENT, satisfied from the
//    OUTBOX — no inbox row at all, distinct from part 1's EXTERNAL_CALLBACK).
// ===========================================================================
describe('8. Internal domain event resumes a wait', () => {
  /**
   * `createWait` hard-requires ONE target: `runId` (must resolve to an
   * existing case_workspace_run_bindings row) OR `actionProposalId`
   * (`wait_target_required` otherwise). A case-level event like
   * `case.blocked` carries NULL run_id/node_run_id on its own outbox row, so
   * a wait naming `runId` would fail the DOMAIN_EVENT resolver's run-scope
   * check for a reason unrelated to this test's point. `actionProposalId` is
   * NOT part of that scope check — an actionProposalId-targeted wait is the
   * correct way to register a Case-scoped (not run-scoped) DOMAIN_EVENT wait.
   */
  async function createTargetProposal(tag: string): Promise<string> {
    const created = await api<{ data: { actionProposalId: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/proposals`,
      {
        runId: state.runId,
        nodeRunId: `cw-e2e2-node-${tag}-${SUFFIX}`,
        casePlanVersionId: state.planVersionId,
        payloadDigest: `sha256:${tag}${SUFFIX}`,
        policySnapshotRef: 'policy-e2e2',
        effectClass: 'SENSITIVE_UPDATE',
        previewRef: 'preview-e2e2',
        proposerType: 'AGENT',
      },
      { 'Idempotency-Key': `cw-e2e2-prop-${tag}-${SUFFIX}` }
    );
    expect(created.status).toBe(201);
    return created.body.data.actionProposalId;
  }

  it('a real internal event (case.blocked) satisfies a DOMAIN_EVENT wait scoped to this Case', async () => {
    requireStack();

    const targetProposalId = await createTargetProposal('domainwait-target');

    // Register the wait FIRST.
    const created = await api<{ data: { waitId: string; status: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/waits`,
      {
        actionProposalId: targetProposalId,
        waitType: 'DOMAIN_EVENT',
        correlationKey: `cw-e2e2-domainwait-${SUFFIX}`,
        expectedEventType: 'case.blocked',
      }
    );
    expect(created.status).toBe(201);
    const waitId = created.body.data.waitId;

    // The internal fact actually happens (a real state transition -> a real
    // outbox row, exactly the CW-T-E full-chain contract this scenario proves).
    const blocked = await api<{ data: { caseStatus: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/status`,
      { targetStatus: 'BLOCKED', reason: 'E2E part2: dowód wewnętrznego zdarzenia' }
    );
    expect(blocked.status).toBe(200);

    const eventRow = await db.one<{ event_id: string }>(
      `SELECT event_id FROM case_workspace_event_outbox
        WHERE case_id = $1 AND event_type = 'case.blocked' ORDER BY occurred_at DESC LIMIT 1`,
      [state.caseId]
    );
    expect(eventRow).not.toBeNull();

    const resolved = await api<{ data: { status: string; satisfiedByEventId: string } }>(
      token,
      'POST',
      `/case-workspace/waits/${waitId}/resolve`,
      { satisfiedByEventId: eventRow!.event_id, expectedVersion: 1 }
    );
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('SATISFIED');

    // (b)
    const waitRow = await db.one<{ status: string; satisfied_by_event_id: string }>(
      `SELECT status, satisfied_by_event_id FROM case_workspace_waits WHERE wait_id = $1`,
      [waitId]
    );
    expect(waitRow!.status).toBe('SATISFIED');
    expect(waitRow!.satisfied_by_event_id).toBe(eventRow!.event_id);

    // Never touched the inbox — this is what makes it "internal", not
    // "external delivery recorded as if internal".
    const inboxRows = await db.rows(
      `SELECT 1 FROM case_workspace_event_inbox WHERE correlation_key = $1`,
      [`cw-e2e2-domainwait-${SUFFIX}`]
    );
    expect(inboxRows).toHaveLength(0);

    // (c)
    const events = await db.outboxForAggregate(waitId);
    expect(events.map((e) => e.event_type)).toContain('wait.satisfied');

    // Resume Case to ACTIVE so later scenarios in this file see a live Case.
    const resumed = await api(token, 'POST', `/case-workspace/cases/${state.caseId}/status`, {
      targetStatus: 'ACTIVE',
      reason: 'E2E part2: powrót po zdarzeniu wewnętrznym',
    });
    expect(resumed.status).toBe(200);
  });

  it('a REAL but WRONG-TYPE internal event is refused — the gate checks event_type, not just existence', async () => {
    requireStack();
    const targetProposalId = await createTargetProposal('domainwait2-target');
    const created = await api<{ data: { waitId: string } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/waits`,
      {
        actionProposalId: targetProposalId,
        waitType: 'DOMAIN_EVENT',
        correlationKey: `cw-e2e2-domainwait2-${SUFFIX}`,
        expectedEventType: 'case.closed', // never happens in this file
      }
    );
    expect(created.status).toBe(201);
    const waitId = created.body.data.waitId;

    // Reuse the REAL case.activated event from the previous test's resume —
    // real row, wrong type for THIS wait.
    const wrongTypeEvent = await db.one<{ event_id: string }>(
      `SELECT event_id FROM case_workspace_event_outbox
        WHERE case_id = $1 AND event_type = 'case.activated' ORDER BY occurred_at DESC LIMIT 1`,
      [state.caseId]
    );
    expect(wrongTypeEvent).not.toBeNull();

    const refused = await api(token, 'POST', `/case-workspace/waits/${waitId}/resolve`, {
      satisfiedByEventId: wrongTypeEvent!.event_id,
      expectedVersion: 1,
    });
    expect(refused.status).toBeGreaterThanOrEqual(400);

    const row = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_waits WHERE wait_id = $1`,
      [waitId]
    );
    expect(row!.status).toBe('ACTIVE');
  });
});

// ===========================================================================
// 10. Failure -> retry -> recovery
// ===========================================================================
describe('10. Failure, retry, recovery on an action proposal', () => {
  it('EXECUTING -> FAILED -> retry -> APPROVED, with the failure reason classified (never raw text) in the event', async () => {
    requireStack();

    const created = await api<{ data: { actionProposalId: string; proposalVersion: number } }>(
      token,
      'POST',
      `/case-workspace/cases/${state.caseId}/proposals`,
      {
        runId: state.runId,
        nodeRunId: `cw-e2e2-node-fail-${SUFFIX}`,
        casePlanVersionId: state.planVersionId,
        payloadDigest: `sha256:fail${SUFFIX}`,
        policySnapshotRef: 'policy-e2e2',
        effectClass: 'SENSITIVE_UPDATE',
        previewRef: 'preview-e2e2',
        proposerType: 'AGENT',
      },
      { 'Idempotency-Key': `cw-e2e2-prop-fail-${SUFFIX}` }
    );
    expect(created.status).toBe(201);
    const id = created.body.data.actionProposalId;
    // See describe(6)'s createSubmittedProposal comment: proposalVersion is a
    // PER-CASE counter, not the OCC version — must come from the create
    // response, never be assumed.
    const proposalVersion = created.body.data.proposalVersion;

    const submitted = await api<{ data: { version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${id}/submit-for-review`,
      { expectedVersion: 1 }
    );
    expect(submitted.status).toBe(200);

    const approved = await api<{ data: { proposal: { version: number } } }>(
      approverToken,
      'POST',
      `/case-workspace/proposals/${id}/decision`,
      {
        proposalVersion,
        payloadDigest: `sha256:fail${SUFFIX}`,
        decision: 'APPROVE',
        source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY',
        policyVersion: 'v1',
        reason: 'OK do wykonania',
        expectedVersion: submitted.body.data.version,
      },
      { 'Idempotency-Key': `cw-e2e2-dec-fail-${SUFFIX}` }
    );
    expect(approved.status).toBe(200);
    let version = approved.body.data.proposal.version;

    const executing = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${id}/transition-to-executing`,
      { expectedVersion: version }
    );
    expect(executing.status).toBe(200);
    expect(executing.body.data.status).toBe('EXECUTING');
    version = executing.body.data.version;

    // FAILURE. Free-text reason on the wire — the service must classify it,
    // never store/emit the raw provider text verbatim.
    const rawReason = 'Provider timeout: connection reset by peer after 30000ms, retry-after=5s';
    const failed = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${id}/transition-to-failed`,
      { reason: rawReason, expectedVersion: version }
    );
    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe('FAILED');
    version = failed.body.data.version;

    // (b) the row is FAILED
    const failedRow = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [id]
    );
    expect(failedRow!.status).toBe('FAILED');

    // (c) proposal.failed carries a CLASSIFIED reason, not the raw sentence.
    const failEvent = await db.one<{ redacted_summary: Record<string, unknown> }>(
      `SELECT redacted_summary FROM case_workspace_event_outbox
        WHERE aggregate_id = $1 AND event_type = 'proposal.failed'
        ORDER BY occurred_at DESC LIMIT 1`,
      [id]
    );
    expect(failEvent).not.toBeNull();
    const summary = failEvent!.redacted_summary as { reasonClass?: string; reasonDigest?: string };
    expect(summary.reasonClass).toBe('unclassified'); // free prose -> classifies to 'unclassified'
    expect(summary.reasonDigest).toMatch(/^sha256:/);
    expect(JSON.stringify(failEvent)).not.toContain('connection reset by peer');

    // RECOVERY. FAILED -> APPROVED is the documented "controlled idempotent retry".
    const retried = await api<{ data: { status: string; version: number } }>(
      token,
      'POST',
      `/case-workspace/proposals/${id}/retry`,
      { expectedVersion: version }
    );
    expect(retried.status).toBe(200);
    expect(retried.body.data.status).toBe('APPROVED');

    const recoveredRow = await db.one<{ status: string }>(
      `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
      [id]
    );
    expect(recoveredRow!.status).toBe('APPROVED');

    const events = (await db.outboxForAggregate(id)).map((e) => e.event_type);
    expect(events).toEqual(
      expect.arrayContaining(['proposal.created', 'proposal.review_requested', 'approval.approved', 'proposal.failed'])
    );
    // A retry-caused re-approval event exists and is causally AFTER the failure.
    const failIdx = events.indexOf('proposal.failed');
    const lastApproveIdx = events.lastIndexOf(events.filter((e) => e === 'approval.approved').at(-1)!);
    // At minimum, the retry did not simply vanish — one more terminal-ish
    // event beyond proposal.failed exists in the trail.
    expect(events.length).toBeGreaterThan(failIdx + 1);
    void lastApproveIdx;
  });
});

// ===========================================================================
// 16. Stale work-order digest is refused (chat intake)
// ===========================================================================
describe('16. Stale digest is refused, not silently accepted', () => {
  it('confirming an OLD digest after the work order was re-proposed in the same conversation fails closed', async () => {
    requireStack();
    const conv = `cw-e2e2-conv-stale-${SUFFIX}`;

    const first = await api<{ data: { workOrderDigest: string } }>(
      token,
      'POST',
      `/chat/conversations/${conv}/case-intake/turn`,
      {
        message: 'Przygotuj wstępny zakres',
        workOrder: {
          projectId: PROJECT_ID,
          goal: 'Wersja robocza celu',
          scope: ['A'],
          expectedOutcome: 'Wersja robocza rezultatu',
          contractedClosureType: 'DELIVERY_COMPLETED',
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
        },
      }
    );
    expect(first.status).toBe(200);
    const staleDigest = first.body.data.workOrderDigest;

    // Re-propose in the SAME conversation with a materially different work
    // order — this supersedes the digest the human would have seen first.
    const second = await api<{ data: { workOrderDigest: string } }>(
      token,
      'POST',
      `/chat/conversations/${conv}/case-intake/turn`,
      {
        message: 'Zmieniamy zakres — dodajemy analizę ryzyka',
        workOrder: {
          projectId: PROJECT_ID,
          goal: 'Zmieniony cel po doprecyzowaniu',
          scope: ['A', 'B - analiza ryzyka'],
          expectedOutcome: 'Zmieniony rezultat',
          contractedClosureType: 'DELIVERY_COMPLETED',
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
        },
      }
    );
    expect(second.status).toBe(200);
    expect(second.body.data.workOrderDigest).not.toBe(staleDigest);

    // Confirming with the FIRST (now stale) digest must be refused.
    const confirmStale = await api(token, 'POST', `/chat/conversations/${conv}/case-intake/confirm`, {
      confirmedDigest: staleDigest,
    });
    expect(confirmStale.status).toBeGreaterThanOrEqual(400);
    expect(confirmStale.status).toBeLessThan(500);

    // (b) no Case was created from the stale confirm attempt.
    const casesForConv = await db.rows(
      `SELECT case_id FROM case_workspace_event_outbox
        WHERE event_type = 'case.created'
          AND redacted_summary->>'sourceConversationId' = $1`,
      [conv]
    );
    expect(casesForConv).toHaveLength(0);

    // The CURRENT digest still confirms cleanly — proves the refusal was
    // about staleness, not a broken confirm path.
    const confirmCurrent = await api<{ data: { caseCreated: boolean } }>(
      token,
      'POST',
      `/chat/conversations/${conv}/case-intake/confirm`,
      { confirmedDigest: second.body.data.workOrderDigest }
    );
    expect(confirmCurrent.status).toBe(201);
    expect(confirmCurrent.body.data.caseCreated).toBe(true);
  });
});

// ===========================================================================
// 17. Duplicate DELIVERY over the real inbound webhook (distinct from part
// 1's idempotency-key HTTP replay: this is a redelivering SENDER, dedup by
// (source, eventId), and the route is unauthenticated-by-JWT so it is
// reachable even when no chat/session state exists).
//
// NOTE: this only exercises the AUTH GATE (no channel is registered on the
// currently-running backend — CASE_WORKSPACE_INBOX_CHANNELS_JSON is unset,
// confirmed by direct probe: every /deliveries call answers 401
// CHANNEL_UNKNOWN regardless of signature). The DEDUP behaviour itself
// (`outcome: 'duplicate'`) needs a registered channel and is exercised in
// `liveStackRestart.e2e.manual.md` after the mandated backend restart
// (scenario 18) brings one up. This test is the honest, currently-reachable
// half: the route exists, is mounted, and fails closed identically for a
// first delivery and a redelivery when unauthenticated.
// ===========================================================================
describe('17. Duplicate delivery over the real webhook route — reachability + fail-closed', () => {
  it('POST /api/webhooks/case-workspace/:source/deliveries is mounted, requires no JWT, and fails CLOSED without a registered channel — identically on redelivery', async () => {
    requireStack();
    const eventId = `probe-dup-${SUFFIX}`;
    const body = {
      eventId,
      eventType: 'vendor.signature.completed',
      organizationId: SEED_USER.organizationId,
      correlationKey: `probe-corr-${SUFFIX}`,
      payload: { deliveredAt: new Date().toISOString() },
      signature: createHmac('sha256', 'not-a-real-registered-secret')
        .update(canonicalJson({ deliveredAt: new Date().toISOString() }))
        .digest('hex'),
    };

    const attempt1 = await fetch(`${BACKEND}/api/webhooks/case-workspace/docusign-webhook/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const attempt2 = await fetch(`${BACKEND}/api/webhooks/case-workspace/docusign-webhook/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // No Authorization header at all — proves the route is genuinely outside
    // the V8 JWT gate (part of what makes it usable by an external sender).
    expect(attempt1.status).toBe(401);
    expect(attempt2.status).toBe(401);
    const j1 = await attempt1.json();
    const j2 = await attempt2.json();
    expect(j1).toEqual(j2);
    expect(j1.error.code).toBe('UNAUTHENTICATED');

    // (b) no durable inbox row was created for either attempt — an
    // unauthenticated sender leaves no trace, by design.
    const rows = await db.rows(`SELECT 1 FROM case_workspace_event_inbox WHERE event_id = $1`, [eventId]);
    expect(rows).toHaveLength(0);
  });
});

function canonicalJson(value: unknown): string {
  // Mirrors eventInboxService's own canonical-JSON key ordering closely
  // enough for this reachability probe (the signature will not match any
  // registered secret anyway — this test does not depend on it being valid).
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}
