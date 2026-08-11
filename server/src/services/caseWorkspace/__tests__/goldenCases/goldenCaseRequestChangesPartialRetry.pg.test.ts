/**
 * GOLDEN CASE H — REQUEST_CHANGES on a proposal, a PARTIAL result, and a
 * genuine EXECUTING -> FAILED -> retry -> APPROVED restart, on a real
 * database.
 *
 *   Case -> Plan -> Run -> Proposal 1: submitted, REQUEST_CHANGES
 *        (terminal for THAT proposal — proven via the ALLOWED_TRANSITIONS
 *        map, not assumed)
 *        -> Proposal 2 (revised): submitted, APPROVED by a second human
 *        -> EXECUTING -> FAILED (a real failure, `reason` required)
 *        -> retry (FAILED -> APPROVED, "controlled idempotent retry")
 *        -> EXECUTING -> EXECUTED -> AUDITED
 *        -> the node's own result is recorded PARTIAL, not ACCEPTED
 *        -> Case closes COMPLETED_PARTIAL
 *
 * What this proves that no prior Golden Case does:
 *   - CW-RT-041's REQUEST_CHANGES edge (proposalApprovalService.ts:450,456):
 *     PENDING_REVIEW -> REQUESTED_CHANGES is a REAL, reachable transition
 *     (not merely declared in the enum), and REQUESTED_CHANGES has NO
 *     outgoing transitions of its own — asserted by attempting a decision
 *     against the changes-requested proposal and getting refused, exactly
 *     the way Golden Case B proves REJECTED has none. The "request changes,
 *     then revise" arc a real reviewer performs is modelled honestly as a
 *     SECOND, separate proposal (the schema — ALLOWED_TRANSITIONS,
 *     ledger row CW-RT-041 — has no "amend and resubmit the same proposal"
 *     edge; inventing one here would test something the system does not do
 *     — the Golden Case list's item 7, "request changes", asks for the
 *     REFUSAL-then-revision pattern, which this delivers honestly);
 *   - CW-RT-041's FAILED -> APPROVED edge, the literal "controlled
 *     idempotent retry": a proposal that failed in EXECUTING can be sent
 *     back to APPROVED by `retryProposalFromFailed`, which re-validates the
 *     plan version and capability are still live (`proposal_target_stale`
 *     guard) and emits `proposal.retry_requested` with `causationId`
 *     pointing at the EXACT `proposal.failed` event it is retrying — a real
 *     causal edge, not merely two events that happen to share a proposal id.
 *     This is the Golden Case list's item 9 ("retry/restart");
 *   - PARTIAL as a first-class `resultAcceptance` value distinct from
 *     ACCEPTED and REJECTED (executionGraphService.ts's own
 *     RESULT_ACCEPTANCE_VALUES) reaching a real Postgres row — Golden Case
 *     list item 8 ("partial result");
 *   - `COMPLETED_PARTIAL` as a closure type distinct from
 *     DELIVERY_COMPLETED (Golden Case A) and DECISION_COMPLETED (Golden Case
 *     B) — a Case that delivered SOMETHING, honestly recorded as partial,
 *     not silently rounded up to "done".
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE,
  CONNECTION_STRING,
  containsInOrder,
  createGoldenCaseApp,
  eventTypes,
  GoldenCaseFixtures,
  isGoldenCaseDbReachable,
  minimalGraph,
  readOutboxForOrg,
  warnSkipped,
} from './goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Golden Case H (request changes, partial result, retry/restart)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE H — REQUEST_CHANGES, a revised proposal, a FAILED->retry restart, a PARTIAL result', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('walks request-changes -> revised proposal -> failed -> retry -> executed, with a PARTIAL result', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-h-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-h');
      const projectId = await fx.seedProject(orgId, 'golden-h');
      const consultantId = await fx.seedUser(orgId, 'golden-h-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');
      const sponsorId = await fx.seedUser(orgId, 'golden-h-sponsor');
      await fx.seedMembership(orgId, sponsorId, 'ADMIN');

      const consultant = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const sponsor = createGoldenCaseApp({
        organizationId: orgId,
        userId: sponsorId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const asConsultant = (m: 'post' | 'get', url: string) =>
        request(consultant)[m](url).set('X-Correlation-ID', correlationId);
      const asSponsor = (m: 'post' | 'get', url: string) =>
        request(sponsor)[m](url).set('X-Correlation-ID', correlationId);

      // -- Case, plan, run ------------------------------------------------------
      const created = await asConsultant('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'COMPLETED_PARTIAL',
        sponsorUserId: sponsorId,
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;
      await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });

      const draft = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
      });
      const planVersionId: string = draft.body.data.casePlanVersionId;
      const proposedPlan = await asConsultant('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      await asSponsor('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });
      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-h');
      await asConsultant('post', `${BASE}/run-bindings`).send({ runId, casePlanVersionId: planVersionId });

      // -- Proposal 1: submitted, REQUEST_CHANGES ------------------------------
      const nodeRunId = `noderun-${randomUUID()}`;
      const digest1 = `sha256:${'1'.repeat(64)}`;
      const proposal1 = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `golden-h-p1-${randomUUID()}`)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest: digest1,
          policySnapshotRef: 'policy://standard/v1',
          effectClass: 'SENSITIVE_UPDATE',
          previewRef: 'preview://golden-h-1',
          proposerType: 'AGENT',
        });
      expect(proposal1.status).toBe(201);
      const proposal1Id: string = proposal1.body.data.actionProposalId;

      const submitted1 = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal1Id}/submit-for-review`
      ).send({ expectedVersion: proposal1.body.data.version });
      expect(submitted1.status).toBe(200);

      const changesRequested = await asSponsor('post', `${BASE}/proposals/${proposal1Id}/decision`)
        .set('Idempotency-Key', `golden-h-changes-${randomUUID()}`)
        .send({
          proposalVersion: submitted1.body.data.proposalVersion,
          payloadDigest: digest1,
          decision: 'REQUEST_CHANGES',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://standard/v1',
          reason: 'The projected savings assume a discount rate we have not agreed on.',
          expectedVersion: submitted1.body.data.version,
        });
      expect(changesRequested.status).toBe(200);
      expect(changesRequested.body.data.proposal.status).toBe('REQUESTED_CHANGES');
      expect(changesRequested.body.data.decision.decision).toBe('REQUEST_CHANGES');
      expect(changesRequested.body.data.decision.reason).toContain('discount rate');

      // REQUESTED_CHANGES is TERMINAL for proposal 1 — no further decision or
      // execution transition is possible on it (ALLOWED_TRANSITIONS has it
      // mapping to []).
      const decisionAfterChanges = await asSponsor('post', `${BASE}/proposals/${proposal1Id}/decision`)
        .set('Idempotency-Key', `golden-h-p1-second-${randomUUID()}`)
        .send({
          proposalVersion: changesRequested.body.data.proposal.version,
          payloadDigest: digest1,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://standard/v1',
          expectedVersion: changesRequested.body.data.proposal.version,
        });
      expect(decisionAfterChanges.status).toBe(409);
      expect(decisionAfterChanges.body.error.code).toBe('PROPOSAL_STATUS_TRANSITION_NOT_ALLOWED');

      const forceExecOnChangesRequested = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal1Id}/transition-to-executing`
      ).send({ expectedVersion: changesRequested.body.data.proposal.version });
      expect(forceExecOnChangesRequested.status).toBe(409);

      const proposal1Row = await control.query(
        `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [proposal1Id]
      );
      expect(proposal1Row.rows[0].status).toBe('REQUESTED_CHANGES');

      // -- Proposal 2: the revision, submitted and approved --------------------
      const digest2 = `sha256:${'2'.repeat(64)}`;
      const proposal2 = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `golden-h-p2-${randomUUID()}`)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest: digest2,
          policySnapshotRef: 'policy://standard/v1',
          effectClass: 'SENSITIVE_UPDATE',
          previewRef: 'preview://golden-h-2-revised',
          proposerType: 'AGENT',
        });
      expect(proposal2.status).toBe(201);
      const proposal2Id: string = proposal2.body.data.actionProposalId;
      expect(proposal2Id).not.toBe(proposal1Id);

      const submitted2 = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal2Id}/submit-for-review`
      ).send({ expectedVersion: proposal2.body.data.version });
      expect(submitted2.status).toBe(200);

      const approved2 = await asSponsor('post', `${BASE}/proposals/${proposal2Id}/decision`)
        .set('Idempotency-Key', `golden-h-approve2-${randomUUID()}`)
        .send({
          proposalVersion: submitted2.body.data.proposalVersion,
          payloadDigest: digest2,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://standard/v1',
          expectedVersion: submitted2.body.data.version,
        });
      expect(approved2.status).toBe(200);
      expect(approved2.body.data.proposal.status).toBe('APPROVED');

      // -- EXECUTING -> FAILED --------------------------------------------------
      const executing2 = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal2Id}/transition-to-executing`
      ).send({ expectedVersion: approved2.body.data.proposal.version });
      expect(executing2.status).toBe(200);
      expect(executing2.body.data.status).toBe('EXECUTING');

      const failed = await asConsultant('post', `${BASE}/proposals/${proposal2Id}/transition-to-failed`).send({
        reason: 'downstream capability timed out mid-write',
        expectedVersion: executing2.body.data.version,
      });
      expect(failed.status).toBe(200);
      expect(failed.body.data.status).toBe('FAILED');

      // Execution cannot be forced on a FAILED proposal — only retry can move it.
      const forceExecOnFailed = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal2Id}/transition-to-executing`
      ).send({ expectedVersion: failed.body.data.version });
      expect(forceExecOnFailed.status).toBe(409);

      // -- The controlled idempotent retry: FAILED -> APPROVED -----------------
      const retried = await asConsultant('post', `${BASE}/proposals/${proposal2Id}/retry`).send({
        expectedVersion: failed.body.data.version,
      });
      expect(retried.status).toBe(200);
      expect(retried.body.data.status).toBe('APPROVED');

      // -- EXECUTING -> EXECUTED -> AUDITED, this time to completion -----------
      const executing3 = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal2Id}/transition-to-executing`
      ).send({ expectedVersion: retried.body.data.version });
      expect(executing3.status).toBe(200);

      const executed = await asConsultant(
        'post',
        `${BASE}/proposals/${proposal2Id}/transition-to-executed`
      ).send({ expectedVersion: executing3.body.data.version });
      expect(executed.status).toBe(200);

      const audited = await asSponsor('post', `${BASE}/proposals/${proposal2Id}/audit`).send({
        expectedVersion: executed.body.data.version,
      });
      expect(audited.status).toBe(200);
      expect(audited.body.data.status).toBe('AUDITED');

      // -- The node's own result: PARTIAL, not ACCEPTED -------------------------
      const acceptance = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
        nodeRunId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'PARTIAL',
        acceptanceInputSnapshot: { summary: 'two of three required data sources reconciled' },
        occurredAt: new Date().toISOString(),
      });
      expect(acceptance.status).toBe(201);
      expect(acceptance.body.data.resultAcceptance).toBe('PARTIAL');

      // -- Closure: honestly partial, not rounded up to complete ----------------
      const axis = await asSponsor('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'delivery',
        status: 'PENDING',
      });
      expect(axis.status).toBe(200);

      const closure = await asSponsor('post', `${BASE}/cases/${caseId}/closure`).send({
        closureType: 'COMPLETED_PARTIAL',
        evidenceRef: `proposal://${proposal2Id}#audited-partial`,
      });
      expect(closure.status).toBe(200);

      const closed = await asSponsor('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'CLOSED',
        reason: 'partial delivery accepted; remainder rescoped separately',
      });
      expect(closed.status).toBe(200);

      // ======================================================================
      // READBACK
      // ======================================================================
      const caseRow = await control.query(
        `SELECT case_status, closure_type FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]).toMatchObject({ case_status: 'CLOSED', closure_type: 'COMPLETED_PARTIAL' });

      const proposalsRow = await control.query(
        `SELECT action_proposal_id, status FROM case_workspace_action_proposals WHERE case_id = $1
          ORDER BY created_at ASC`,
        [caseId]
      );
      expect(proposalsRow.rowCount).toBe(2);
      expect(proposalsRow.rows[0]).toMatchObject({ action_proposal_id: proposal1Id, status: 'REQUESTED_CHANGES' });
      expect(proposalsRow.rows[1]).toMatchObject({ action_proposal_id: proposal2Id, status: 'AUDITED' });

      const decisionsRow = await control.query(
        `SELECT action_proposal_id, decision FROM case_workspace_action_proposal_decisions
          WHERE action_proposal_id = ANY($1::text[]) ORDER BY created_at ASC`,
        [[proposal1Id, proposal2Id]]
      );
      // Exactly two decisions were recorded: REQUEST_CHANGES on proposal 1,
      // APPROVE on proposal 2. The refused decision-after-terminal and the
      // refused force-executions wrote nothing.
      expect(decisionsRow.rowCount).toBe(2);
      expect(decisionsRow.rows.map((r) => r.decision)).toEqual(['REQUEST_CHANGES', 'APPROVE']);

      // ======================================================================
      // OUTBOX — the retry's causal edge is real, not coincidental
      // ======================================================================
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);

      expect(types).toContain('approval.changes_requested');
      expect(types).toContain('approval.approved');
      expect(types).toContain('proposal.failed');
      expect(types).toContain('proposal.retry_requested');
      expect(types).toContain('proposal.executed');
      expect(types).toContain('proposal.audited');
      expect(types).toContain('node.result_accepted');

      expect(
        containsInOrder(types, [
          'approval.changes_requested',
          'proposal.created',
          'approval.approved',
          'proposal.executing',
          'proposal.failed',
          'proposal.retry_requested',
          'proposal.executing',
          'proposal.executed',
          'proposal.audited',
        ])
      ).toBe(true);

      const failedEvent = outbox.find((r) => r.event_type === 'proposal.failed');
      const retryEvent = outbox.find((r) => r.event_type === 'proposal.retry_requested');
      expect(failedEvent).toBeDefined();
      expect(retryEvent).toBeDefined();
      // The retry's causationId points at the EXACT failure event it retried
      // — a real causal edge, not two events that merely share a proposal id.
      expect(retryEvent!.causation_id).toBeTruthy();
      expect(retryEvent!.causation_id).toBe(failedEvent!.event_id);
      expect(retryEvent!.aggregate_id).toBe(proposal2Id);
      expect(failedEvent!.aggregate_id).toBe(proposal2Id);

      const acceptanceEvent = outbox.find((r) => r.event_type === 'node.result_accepted');
      expect(acceptanceEvent).toBeDefined();
      expect(acceptanceEvent!.redacted_summary).toMatchObject({ resultAcceptance: 'PARTIAL' });

      const correlationIds = new Set(outbox.map((r) => r.correlation_id));
      expect([...correlationIds]).toEqual([correlationId]);

      await control.query(`DELETE FROM case_workspace_node_result_acceptances WHERE case_id = $1`, [caseId]);
      await control.query(
        `DELETE FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = ANY($1::text[])`,
        [[proposal1Id, proposal2Id]]
      );
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
