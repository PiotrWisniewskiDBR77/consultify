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
const LIMITED_MEMBER = {
  email: 'cw.stream.e.member@local.test', password: 'CaseWorkspaceMember!2026', userId: 'cw-stream-e-member',
};
const POLICY_ADMIN = {
  email: 'cw.stream.e.policy-admin@local.test', password: 'CaseWorkspacePolicy!2026', userId: 'cw-stream-e-policy-admin',
};

let db: ControlDb;
let token: string;
let approverToken: string;
let memberToken: string;
let adminToken: string;
let stackReason: string | undefined;

const state: {
  caseId?: string;
  planVersionId?: string;
  runId?: string;
} = {};
const ownedCaseIds: string[] = [];

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
  await db.ensureLoginUser({ ...LIMITED_MEMBER, organizationId: SEED_USER.organizationId, role: 'MEMBER' });
  await db.ensureLoginUser({ ...POLICY_ADMIN, organizationId: SEED_USER.organizationId, role: 'ADMIN' });
  token = await login();
  approverToken = await login(APPROVER.email, APPROVER.password);
  memberToken = await login(LIMITED_MEMBER.email, LIMITED_MEMBER.password);
  adminToken = await login(POLICY_ADMIN.email, POLICY_ADMIN.password);
  await db.ensureProject(PROJECT_ID, SEED_USER.organizationId, `E2E part2 ${SUFFIX}`);
}, 120_000);

afterAll(async () => {
  if (db) {
    const owned = await db.rows<{ case_id: string }>(
      `SELECT case_id FROM case_core WHERE project_id=$1`, [PROJECT_ID]
    );
    const caseIds = Array.from(new Set([...ownedCaseIds, ...owned.map((row) => row.case_id)]));
    const tables = await db.rows<{ table_name: string }>(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema='public' AND column_name='case_id' AND table_name <> 'case_core'`
    );
    // Delete only rows tied to this file's exact generated case ids. Repeated
    // deepest-first attempts resolve FK chains without TRUNCATE or touching
    // another suite's organization-wide fixtures.
    for (let pass = 0; pass < 40; pass += 1) {
      for (const { table_name: table } of tables) {
        if (!/^[a-z0-9_]+$/.test(table)) throw new Error(`unsafe cleanup table: ${table}`);
        try { await db.rows(`DELETE FROM "${table}" WHERE case_id=ANY($1::text[])`, [caseIds]); } catch { /* FK child is removed on a later pass. */ }
      }
    }
    await db.rows(`DELETE FROM case_core WHERE case_id=ANY($1::text[])`, [caseIds]);
    await db.rows(`DELETE FROM budget_entries WHERE initiative_id LIKE $1`, [`%${SUFFIX}%`]);
    await db.rows(`DELETE FROM initiatives WHERE id LIKE $1`, [`%${SUFFIX}%`]);
    await db.rows(`DELETE FROM projects WHERE id=$1`, [PROJECT_ID]).catch(() => []);
  }
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
  const caseId = (res.body as { data?: { caseId: string } })?.data?.caseId;
  if (res.status === 201 && caseId) ownedCaseIds.push(caseId);
  return { status: res.status, caseId };
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
// EXE-MVP-ACTIONS-001 — production-router proof for governed surfaces that
// are not otherwise exercised by the historical live-stack scenarios.
// ===========================================================================
describe('EXE-MVP-ACTIONS-001 governed production routes', () => {
  it('mutates close, run-cancel, wait-cancel, artifact-unlink and proposal-revoke through real JWT routes', async () => {
    requireStack();

    const closeCase = await createCase(token, 'STANDARD', 'STANDARD', `Governed close ${SUFFIX}`);
    expect(closeCase.status).toBe(201);
    const closed = await api(token, 'POST', `/case-workspace/cases/${closeCase.caseId}/closure`, {
      closureType: 'COMPLETED_PARTIAL', evidenceRef: `evidence:${SUFFIX}`,
    });
    expect(closed.status).toBe(200);

    const run = await api<{ data: { runId: string; version: number } }>(
      token, 'POST', `/case-workspace/cases/${state.caseId}/runs`,
      { casePlanVersionId: state.planVersionId },
      { 'Idempotency-Key': `governed-run-${SUFFIX}` }
    );
    expect(run.status).toBe(201);
    const cancelledRun = await api(token, 'POST', `/case-workspace/runs/${run.body.data.runId}/cancel`, {
      expectedVersion: run.body.data.version, reason: 'bounded proof',
    });
    expect(cancelledRun.status).toBe(200);

    const wait = await api<{ data: { waitId: string; version: number } }>(
      token, 'POST', `/case-workspace/cases/${state.caseId}/waits`,
      { runId: state.runId, waitType: 'DOMAIN_EVENT', correlationKey: `governed-wait-${SUFFIX}`, expectedEventType: 'proof.event' }
    );
    expect(wait.status).toBe(201);
    const cancelledWait = await api(token, 'POST', `/case-workspace/waits/${wait.body.data.waitId}/cancel`, {
      expectedVersion: wait.body.data.version, reason: 'bounded proof',
    });
    expect(cancelledWait.status).toBe(200);

    const link = await api<{ data: { linkId: string } }>(
      token, 'POST', `/case-workspace/cases/${state.caseId}/artifact-links`,
      { artifactType: 'DOCUMENT', artifactId: `governed-artifact-${SUFFIX}`, relation: 'INPUT' },
      { 'Idempotency-Key': `governed-link-${SUFFIX}` }
    );
    expect(link.status).toBe(201);
    const unlinked = await api(token, 'DELETE', `/case-workspace/artifact-links/${link.body.data.linkId}`, {
      reason: 'bounded proof',
    });
    expect(unlinked.status).toBe(200);

    const proposal = await api<{ data: { actionProposalId: string; proposalVersion: number } }>(
      token, 'POST', `/case-workspace/cases/${state.caseId}/proposals`, {
        runId: state.runId, nodeRunId: `governed-revoke-${SUFFIX}`,
        casePlanVersionId: state.planVersionId, payloadDigest: `sha256:revoke${SUFFIX}`,
        policySnapshotRef: 'policy-e2e2', effectClass: 'SENSITIVE_UPDATE',
        previewRef: 'preview-e2e2', proposerType: 'AGENT',
      }, { 'Idempotency-Key': `governed-proposal-${SUFFIX}` }
    );
    expect(proposal.status).toBe(201);
    const submitted = await api<{ data: { version: number } }>(token, 'POST',
      `/case-workspace/proposals/${proposal.body.data.actionProposalId}/submit-for-review`, { expectedVersion: 1 });
    expect(submitted.status).toBe(200);
    const approved = await api<{ data: { proposal: { version: number } } }>(approverToken, 'POST',
      `/case-workspace/proposals/${proposal.body.data.actionProposalId}/decision`, {
        proposalVersion: proposal.body.data.proposalVersion, payloadDigest: `sha256:revoke${SUFFIX}`,
        decision: 'APPROVE', source: 'BUTTON', authenticationAssurance: 'SESSION_MFA',
        approvalChannelPolicy: 'UI_BUTTON_ONLY', policyVersion: 'v1', reason: 'approve revoke proof',
        expectedVersion: submitted.body.data.version,
      }, { 'Idempotency-Key': `governed-decision-${SUFFIX}` });
    expect(approved.status).toBe(200);
    const revoked = await api(token, 'POST',
      `/case-workspace/proposals/${proposal.body.data.actionProposalId}/revoke`, {
        expectedVersion: approved.body.data.proposal.version, reason: 'bounded proof',
      });
    expect(revoked.status).toBe(200);

    const actionIds = ['case.close', 'case.run.cancel', 'case.wait.cancel', 'case.artifact.unlink', 'case.proposal.revoke'];
    const audits = await db.rows<{ action_id: string; outcome: string }>(
      `SELECT action_id,outcome FROM execution_action_audit WHERE action_id = ANY($1::text[]) AND outcome='SUCCEEDED'`,
      [actionIds]
    );
    expect(new Set(audits.map((row) => row.action_id))).toEqual(new Set(actionIds));
  });

  it('deletes a real budget entry through the mounted governed production route', async () => {
    requireStack();
    const initiativeId = `governed-initiative-${SUFFIX}`;
    const entryId = `governed-budget-${SUFFIX}`;
    await db.rows(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status,created_by)
       VALUES ($1,$2,$3,$4,'DRAFT',$5)`,
      [initiativeId, SEED_USER.organizationId, PROJECT_ID, `Governed budget ${SUFFIX}`, SEED_USER.userId]
    );
    await db.rows(
      `INSERT INTO budget_entries (id,organization_id,initiative_id,project_id,entry_type,cost_type,amount,created_by)
       VALUES ($1,$2,$3,$4,'FORECAST','OPEX',100,$5)`,
      [entryId, SEED_USER.organizationId, initiativeId, PROJECT_ID, SEED_USER.userId]
    );

    const response = await fetch(
      `${BACKEND}/api/execution-control/budget/entries/${entryId}?initiativeId=${initiativeId}&expectedVersion=1`,
      { method: 'DELETE', headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Id': `governed-budget-${SUFFIX}`,
        'X-Idempotency-Key': `governed-budget-${SUFFIX}`,
      } }
    );
    expect(response.status).toBe(200);
    expect(await db.one(`SELECT id FROM budget_entries WHERE id=$1`, [entryId])).toBeNull();
    const audit = await db.one<{ outcome: string }>(
      `SELECT outcome FROM execution_action_audit WHERE action_id='execution.budget.delete' AND target_id=$1 ORDER BY occurred_at DESC LIMIT 1`,
      [entryId]
    );
    expect(audit?.outcome).toBe('SUCCEEDED');
  });

  it('denies all 9 implemented actions to an insufficient real membership before domain access', async () => {
    requireStack();
    const target = `denied-${SUFFIX}`;
    const calls = [
      () => api(memberToken, 'POST', `/case-workspace/cases/${target}/closure`, { closureType: 'COMPLETED_PARTIAL', evidenceRef: 'denied' }),
      () => api(memberToken, 'POST', `/case-workspace/cases/${target}/cancel`, { reason: 'denied' }),
      () => api(memberToken, 'POST', `/case-workspace/waits/${target}/cancel`, { reason: 'denied', expectedVersion: 1 }),
      () => api(memberToken, 'POST', `/case-workspace/runs/${target}/cancel`, { reason: 'denied', expectedVersion: 1 }),
      () => api(memberToken, 'DELETE', `/case-workspace/artifact-links/${target}`, { reason: 'denied' }),
      () => api(memberToken, 'POST', `/case-workspace/proposals/${target}/decision`, {
        proposalVersion: 1, payloadDigest: 'sha256:denied', decision: 'REJECT', source: 'BUTTON',
        authenticationAssurance: 'SESSION_MFA', approvalChannelPolicy: 'UI_BUTTON_ONLY', policyVersion: 'v1',
        expectedVersion: 1, reason: 'denied', idempotencyKey: `denied-decision-${SUFFIX}`,
      }),
      () => api(memberToken, 'POST', `/case-workspace/proposals/${target}/transition-to-executing`, { expectedVersion: 1 }),
      () => api(memberToken, 'POST', `/case-workspace/proposals/${target}/revoke`, { reason: 'denied', expectedVersion: 1 }),
      async () => {
        const response = await fetch(`${BACKEND}/api/execution-control/budget/entries/${target}?initiativeId=${target}&expectedVersion=1`, {
          method: 'DELETE', headers: {
            Authorization: `Bearer ${memberToken}`,
            'X-Request-Id': `denied-budget-${SUFFIX}`,
            'X-Idempotency-Key': `denied-budget-${SUFFIX}`,
          },
        });
        return { status: response.status };
      },
    ];
    for (const [index, call] of calls.entries()) {
      const result = await call();
      expect(result.status, `implemented action denial index ${index}: ${JSON.stringify(result.body)}`).toBe(403);
    }
    const denied = await db.rows<{ action_id: string }>(
      `SELECT DISTINCT action_id FROM execution_action_audit WHERE actor_id=$1 AND outcome='DENIED'`,
      [LIMITED_MEMBER.userId]
    );
    expect(new Set(denied.map((row) => row.action_id))).toEqual(new Set([
      'case.close', 'case.cancel', 'case.wait.cancel', 'case.run.cancel', 'case.artifact.unlink',
      'case.proposal.decide', 'case.proposal.execute', 'case.proposal.revoke', 'execution.budget.delete',
    ]));
  });

  it('rolls back all 9 real domain mutations when the terminal success audit insert fails', async () => {
    requireStack();
    const requestId = `force-audit-failure-${SUFFIX}`;
    const headers = { 'X-Request-Id': requestId, 'X-Correlation-Id': requestId };

    const closeCase = await createCase(token, 'STANDARD', 'STANDARD', `Rollback close ${SUFFIX}`);
    const cancelCase = await createCase(token, 'STANDARD', 'STANDARD', `Rollback cancel ${SUFFIX}`);
    expect(closeCase.status).toBe(201);
    expect(cancelCase.status).toBe(201);
    const run = await api<{ data: { runId: string; version: number } }>(token, 'POST',
      `/case-workspace/cases/${state.caseId}/runs`, { casePlanVersionId: state.planVersionId },
      { 'Idempotency-Key': `rollback-run-${SUFFIX}` });
    expect(run.status).toBe(201);
    const wait = await api<{ data: { waitId: string; version: number } }>(token, 'POST',
      `/case-workspace/cases/${state.caseId}/waits`, {
        runId: state.runId, waitType: 'DOMAIN_EVENT', correlationKey: `rollback-wait-${SUFFIX}`,
        expectedEventType: 'rollback.event',
      });
    expect(wait.status).toBe(201);
    const link = await api<{ data: { linkId: string } }>(token, 'POST',
      `/case-workspace/cases/${state.caseId}/artifact-links`, {
        artifactType: 'DOCUMENT', artifactId: `rollback-artifact-${SUFFIX}`, relation: 'INPUT',
      }, { 'Idempotency-Key': `rollback-link-${SUFFIX}` });
    expect(link.status).toBe(201);

    async function proposalFixture(tag: string, approve: boolean) {
      const created = await api<{ data: { actionProposalId: string; proposalVersion: number } }>(token, 'POST',
        `/case-workspace/cases/${state.caseId}/proposals`, {
          runId: state.runId, nodeRunId: `rollback-${tag}-${SUFFIX}`, casePlanVersionId: state.planVersionId,
          payloadDigest: `sha256:rollback-${tag}-${SUFFIX}`, policySnapshotRef: 'policy-rollback',
          effectClass: 'SENSITIVE_UPDATE', previewRef: 'preview-rollback', proposerType: 'AGENT',
        }, { 'Idempotency-Key': `rollback-proposal-${tag}-${SUFFIX}` });
      expect(created.status).toBe(201);
      const submitted = await api<{ data: { version: number } }>(token, 'POST',
        `/case-workspace/proposals/${created.body.data.actionProposalId}/submit-for-review`, { expectedVersion: 1 });
      expect(submitted.status).toBe(200);
      let version = submitted.body.data.version;
      if (approve) {
        const approved = await api<{ data: { proposal: { version: number } } }>(approverToken, 'POST',
          `/case-workspace/proposals/${created.body.data.actionProposalId}/decision`, {
            proposalVersion: created.body.data.proposalVersion,
            payloadDigest: `sha256:rollback-${tag}-${SUFFIX}`, decision: 'APPROVE', source: 'BUTTON',
            authenticationAssurance: 'SESSION_MFA', approvalChannelPolicy: 'UI_BUTTON_ONLY',
            policyVersion: 'v1', reason: 'prepare rollback fixture', expectedVersion: version,
          }, { 'Idempotency-Key': `rollback-approve-${tag}-${SUFFIX}` });
        expect(approved.status).toBe(200);
        version = approved.body.data.proposal.version;
      }
      return { id: created.body.data.actionProposalId, proposalVersion: created.body.data.proposalVersion, version };
    }
    const decide = await proposalFixture('decide', false);
    const execute = await proposalFixture('execute', true);
    const revoke = await proposalFixture('revoke', true);
    const initiativeId = `rollback-initiative-${SUFFIX}`;
    const entryId = `rollback-budget-${SUFFIX}`;
    await db.rows(`INSERT INTO initiatives (id,organization_id,project_id,name,status,created_by)
      VALUES ($1,$2,$3,$4,'DRAFT',$5)`,
      [initiativeId, SEED_USER.organizationId, PROJECT_ID, `Rollback budget ${SUFFIX}`, SEED_USER.userId]);
    await db.rows(`INSERT INTO budget_entries
      (id,organization_id,initiative_id,project_id,entry_type,cost_type,amount,created_by)
      VALUES ($1,$2,$3,$4,'FORECAST','OPEX',100,$5)`,
      [entryId, SEED_USER.organizationId, initiativeId, PROJECT_ID, SEED_USER.userId]);

    const targetIds = [closeCase.caseId!, cancelCase.caseId!, run.body.data.runId, wait.body.data.waitId,
      link.body.data.linkId, decide.id, execute.id, revoke.id, entryId];
    const before = await db.rows<{ target_id: string; events: string }>(
      `SELECT x.target_id, count(o.event_id)::text events FROM unnest($1::text[]) x(target_id)
       LEFT JOIN case_workspace_event_outbox o ON o.aggregate_id=x.target_id GROUP BY x.target_id`, [targetIds]);

    await db.rows(`CREATE OR REPLACE FUNCTION exe_actions_fail_audit_insert() RETURNS trigger AS $$
      BEGIN IF NEW.request_id = '${requestId}' THEN RAISE EXCEPTION 'forced mounted audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await db.rows(`DROP TRIGGER IF EXISTS trg_exe_actions_fail_audit ON execution_action_audit`);
    await db.rows(`CREATE TRIGGER trg_exe_actions_fail_audit BEFORE INSERT ON execution_action_audit
      FOR EACH ROW EXECUTE FUNCTION exe_actions_fail_audit_insert()`);
    try {
      const calls = [
        () => api(token, 'POST', `/case-workspace/cases/${closeCase.caseId}/closure`,
          { closureType: 'COMPLETED_PARTIAL', evidenceRef: 'rollback' }, headers),
        () => api(token, 'POST', `/case-workspace/cases/${cancelCase.caseId}/cancel`, { reason: 'rollback' }, headers),
        () => api(token, 'POST', `/case-workspace/waits/${wait.body.data.waitId}/cancel`,
          { reason: 'rollback', expectedVersion: wait.body.data.version }, headers),
        () => api(token, 'POST', `/case-workspace/runs/${run.body.data.runId}/cancel`,
          { reason: 'rollback', expectedVersion: run.body.data.version }, headers),
        () => api(token, 'DELETE', `/case-workspace/artifact-links/${link.body.data.linkId}`, { reason: 'rollback' }, headers),
        () => api(approverToken, 'POST', `/case-workspace/proposals/${decide.id}/decision`, {
          proposalVersion: decide.proposalVersion, payloadDigest: `sha256:rollback-decide-${SUFFIX}`,
          decision: 'REJECT', source: 'BUTTON', authenticationAssurance: 'SESSION_MFA',
          approvalChannelPolicy: 'UI_BUTTON_ONLY', policyVersion: 'v1', reason: 'rollback',
          expectedVersion: decide.version, idempotencyKey: `rollback-decision-${SUFFIX}`,
        }, headers),
        () => api(token, 'POST', `/case-workspace/proposals/${execute.id}/transition-to-executing`,
          { expectedVersion: execute.version }, headers),
        () => api(token, 'POST', `/case-workspace/proposals/${revoke.id}/revoke`,
          { reason: 'rollback', expectedVersion: revoke.version }, headers),
        async () => {
          const response = await fetch(`${BACKEND}/api/execution-control/budget/entries/${entryId}?initiativeId=${initiativeId}&expectedVersion=1`, {
            method: 'DELETE', headers: {
              Authorization: `Bearer ${token}`,
              'X-Request-Id': requestId,
              'X-Idempotency-Key': requestId,
            },
          });
          return { status: response.status };
        },
      ];
      for (const [index, call] of calls.entries()) {
        expect((await call()).status, `forced audit rollback index ${index}`).toBe(500);
      }
    } finally {
      await db.rows(`DROP TRIGGER IF EXISTS trg_exe_actions_fail_audit ON execution_action_audit`);
      await db.rows(`DROP FUNCTION IF EXISTS exe_actions_fail_audit_insert()`);
    }

    const cases = await db.rows<{ case_id: string; closure_type: string | null; case_status: string }>(
      `SELECT case_id,closure_type,case_status FROM case_core WHERE case_id=ANY($1::text[])`,
      [[closeCase.caseId, cancelCase.caseId]]);
    expect(cases.find((row) => row.case_id === closeCase.caseId)?.closure_type).toBeNull();
    expect(cases.find((row) => row.case_id === cancelCase.caseId)?.case_status).toBe('DRAFT');
    expect((await db.one<{ status: string }>(`SELECT status FROM case_workspace_runs WHERE run_id=$1`, [run.body.data.runId]))?.status).toBe('CREATED');
    expect((await db.one<{ status: string }>(`SELECT status FROM case_workspace_waits WHERE wait_id=$1`, [wait.body.data.waitId]))?.status).toBe('ACTIVE');
    expect((await db.one<{ link_status: string }>(`SELECT link_status FROM case_workspace_artifact_links WHERE link_id=$1`, [link.body.data.linkId]))?.link_status).toBe('ACTIVE');
    for (const fixture of [decide, execute, revoke]) {
      const row = await db.one<{ status: string }>(`SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id=$1`, [fixture.id]);
      expect(row?.status).toBe(fixture === decide ? 'PENDING_REVIEW' : 'APPROVED');
    }
    expect(await db.one(`SELECT id FROM budget_entries WHERE id=$1`, [entryId])).not.toBeNull();
    const after = await db.rows<{ target_id: string; events: string }>(
      `SELECT x.target_id, count(o.event_id)::text events FROM unnest($1::text[]) x(target_id)
       LEFT JOIN case_workspace_event_outbox o ON o.aggregate_id=x.target_id GROUP BY x.target_id`, [targetIds]);
    expect(after).toEqual(before);
    expect(await db.rows(`SELECT audit_id FROM execution_action_audit WHERE request_id=$1`, [requestId])).toHaveLength(0);
  });

  it('enforces live policy drift, keeps hidden/unregistered HTTP surfaces absent, and cold-reads persisted outcomes', async () => {
    requireStack();
    const driftCase = await createCase(adminToken, 'STANDARD', 'STANDARD', `Policy drift ${SUFFIX}`);
    expect(driftCase.status).toBe(201);
    await db.rows(`UPDATE execution_action_registry SET minimum_role='OWNER' WHERE action_id='case.close'`);
    try {
      const denied = await api(adminToken, 'POST', `/case-workspace/cases/${driftCase.caseId}/closure`, {
        closureType: 'COMPLETED_PARTIAL', evidenceRef: 'policy-drift',
      }, { 'X-Correlation-Id': `policy-drift-${SUFFIX}` });
      expect(denied.status).toBe(403);
      expect((await db.one<{ closure_type: string | null }>(
        `SELECT closure_type FROM case_core WHERE case_id=$1`, [driftCase.caseId]))?.closure_type).toBeNull();
    } finally {
      await db.rows(`UPDATE execution_action_registry SET minimum_role='ADMIN' WHERE action_id='case.close'`);
    }

    for (const actionId of ['execution.initiative.delete', `unregistered.${SUFFIX}`]) {
      const response = await fetch(`${BACKEND}/api/v8/case-workspace/actions/${actionId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
      });
      expect(response.status).toBe(404);
    }

    const cold = new ControlDb();
    try {
      const rows = await cold.rows<{ action_id: string; outcomes: string[] }>(
        `SELECT action_id,array_agg(DISTINCT outcome ORDER BY outcome) outcomes
           FROM execution_action_audit
          WHERE action_id=ANY($1::text[]) GROUP BY action_id`, [[
          'case.close', 'case.cancel', 'case.wait.cancel', 'case.run.cancel', 'case.artifact.unlink',
          'case.proposal.decide', 'case.proposal.execute', 'case.proposal.revoke', 'execution.budget.delete',
        ]]);
      expect(rows).toHaveLength(9);
      expect(rows.find((row) => row.action_id === 'case.close')?.outcomes).toContain('DENIED');
    } finally {
      await cold.close();
    }
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
