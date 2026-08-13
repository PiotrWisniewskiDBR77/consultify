/**
 * GOLDEN CASE B — the refusal path: a Case that ends WELL without executing.
 *
 *   Case → Plan → Run → Action proposal → review
 *        → REJECT by the sponsor
 *        → execution is refused
 *        → the Case still closes as DECISION_COMPLETED
 *
 * This is the scenario most likely to be quietly broken, because "nothing
 * happened" is easy to confuse with "it worked". It pins the three claims that
 * distinguish the two:
 *
 *   CW-GC-D-01/D-04: a Case may complete SUCCESSFULLY with no execution at all,
 *     and the recorded closure is DECISION_COMPLETED — not FAILED, not
 *     CANCELLED. A rejected recommendation is a delivered decision.
 *   CW-GC-D-02: the rationale survives. The REJECT reason and the deciding
 *     actor are durable in the decision trail, readable over the API.
 *   CW-GC-D-03: no fictitious execution result is created — the proposal never
 *     reaches EXECUTED, no `proposal.executed` event exists, and the attempt to
 *     force it is refused with a stable 409.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BASE,
  CONNECTION_STRING,
  createGoldenCaseApp,
  eventTypes,
  GoldenCaseFixtures,
  isGoldenCaseDbReachable,
  minimalGraph,
  readOutboxForOrg,
  warnSkipped,
} from './goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Golden Case B (approval refused)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE B — approval refused, Case still closes as DECISION_COMPLETED', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('a REJECT decision blocks execution, survives as rationale, and does not fail the Case', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-b-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-b');
      const projectId = await fx.seedProject(orgId, 'golden-b');
      const consultantId = await fx.seedUser(orgId, 'golden-b-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');
      const sponsorId = await fx.seedUser(orgId, 'golden-b-sponsor');
      await fx.seedMembership(orgId, sponsorId, 'ADMIN');

      const consultantApp = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const sponsorApp = createGoldenCaseApp({
        organizationId: orgId,
        userId: sponsorId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const asConsultant = (m: 'post' | 'get', url: string) =>
        request(consultantApp)[m](url).set('X-Correlation-ID', correlationId);
      const asSponsor = (m: 'post' | 'get', url: string) =>
        request(sponsorApp)[m](url).set('X-Correlation-ID', correlationId);

      // -- Case, plan, run ----------------------------------------------------
      const created = await asConsultant('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'LIGHT',
        contractedClosureType: 'DECISION_COMPLETED',
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

      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-b');
      const binding = await asConsultant('post', `${BASE}/run-bindings`).send({
        runId,
        casePlanVersionId: planVersionId,
      });
      expect(binding.status).toBe(201);

      // -- Proposal, submitted for review -------------------------------------
      const payloadDigest = `sha256:${'b'.repeat(64)}`;
      const nodeRunId = `noderun-${randomUUID()}`;
      const proposal = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `golden-b-proposal-${randomUUID()}`)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest,
          policySnapshotRef: 'policy://light/v1',
          effectClass: 'SENSITIVE_UPDATE',
          previewRef: 'preview://golden-b',
          proposerType: 'AGENT',
        });
      expect(proposal.status).toBe(201);
      const actionProposalId: string = proposal.body.data.actionProposalId;

      const submitted = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/submit-for-review`
      ).send({ expectedVersion: proposal.body.data.version });
      expect(submitted.status).toBe(200);

      // -- CW-GR-028: a STALE decision is refused with no side effect ---------
      // A reviewer whose screen is one version behind must not be able to
      // decide. Both halves of the staleness contract are exercised: a wrong
      // payloadDigest (the proposal is not what the reviewer read) and a wrong
      // proposalVersion.
      const staleDigest = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-b-stale-digest-${randomUUID()}`)
        .send({
          proposalVersion: submitted.body.data.proposalVersion,
          payloadDigest: `sha256:${'f'.repeat(64)}`,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://light/v1',
          expectedVersion: submitted.body.data.version,
        });
      expect(staleDigest.status).toBe(409);
      expect(staleDigest.body.error.code).toBe('PROPOSAL_STALE');

      const staleVersion = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-b-stale-version-${randomUUID()}`)
        .send({
          proposalVersion: submitted.body.data.proposalVersion + 99,
          payloadDigest,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://light/v1',
          expectedVersion: submitted.body.data.version,
        });
      expect(staleVersion.status).toBe(409);

      // NO side effect from either: still PENDING_REVIEW, still zero decisions.
      const afterStale = await control.query(
        `SELECT status, version FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(afterStale.rows[0].status).toBe('PENDING_REVIEW');
      expect(Number(afterStale.rows[0].version)).toBe(submitted.body.data.version);
      const noDecisionsYet = await control.query(
        `SELECT decision_id FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(noDecisionsYet.rowCount).toBe(0);

      // -- The refusal --------------------------------------------------------
      const rejectionReason = 'Payback period exceeds the mandate; recommend no action this cycle.';
      const rejected = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-b-reject-${randomUUID()}`)
        .send({
          proposalVersion: submitted.body.data.proposalVersion,
          payloadDigest,
          decision: 'REJECT',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://light/v1',
          reason: rejectionReason,
          expectedVersion: submitted.body.data.version,
        });
      expect(rejected.status).toBe(200);
      expect(rejected.body.data.proposal.status).toBe('REJECTED');
      expect(rejected.body.data.decision.decision).toBe('REJECT');
      expect(rejected.body.data.decision.reason).toBe(rejectionReason);

      // -- Execution must be impossible ---------------------------------------
      const forced = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/transition-to-executing`
      ).send({ expectedVersion: rejected.body.data.proposal.version });
      expect(forced.status).toBe(409);
      expect(forced.body.error.code).toBe('PROPOSAL_STATUS_TRANSITION_NOT_ALLOWED');

      const afterForce = await control.query(
        `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(afterForce.rows[0].status).toBe('REJECTED');

      // -- The rationale is durable and API-readable --------------------------
      const decisions = await asSponsor('get', `${BASE}/proposals/${actionProposalId}/decisions`);
      expect(decisions.status).toBe(200);
      expect(decisions.body.data.length).toBe(1);
      expect(decisions.body.data[0]).toMatchObject({
        decision: 'REJECT',
        decidedByActorId: sponsorId,
        reason: rejectionReason,
        payloadDigest,
      });

      // -- The Case completes SUCCESSFULLY, with no Initiative and no execution
      const axis = await asSponsor('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'decision',
        status: 'COMPLETED',
      });
      expect(axis.status).toBe(200);

      const closure = await asSponsor('post', `${BASE}/cases/${caseId}/closure`).send({
        closureType: 'DECISION_COMPLETED',
        evidenceRef: `proposal://${actionProposalId}#rejected`,
      });
      expect(closure.status).toBe(200);

      const closed = await asSponsor('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'CLOSED',
        reason: 'decision delivered: no action',
      });
      expect(closed.status).toBe(200);

      // ---------------------------------------------------------------------
      // READBACK — the distinction that matters
      // ---------------------------------------------------------------------
      const caseRow = await control.query(
        `SELECT case_status, closure_type, decision_status FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0].case_status).toBe('CLOSED');
      // NOT 'FAILED' and NOT 'CANCELLED' — a refused recommendation is a
      // delivered decision (CW-GC-D-04).
      expect(caseRow.rows[0].case_status).not.toBe('FAILED');
      expect(caseRow.rows[0].case_status).not.toBe('CANCELLED');
      expect(caseRow.rows[0].closure_type).toBe('DECISION_COMPLETED');
      expect(caseRow.rows[0].decision_status).toBe('COMPLETED');

      // No fictitious results were manufactured (CW-GC-D-03).
      const measurements = await control.query(
        `SELECT measurement_id FROM case_workspace_value_measurements WHERE case_id = $1`,
        [caseId]
      );
      expect(measurements.rowCount).toBe(0);
      const acceptances = await control.query(
        `SELECT node_run_id FROM case_workspace_node_result_acceptances WHERE case_id = $1`,
        [caseId]
      );
      expect(acceptances.rowCount).toBe(0);

      // ---------------------------------------------------------------------
      // OUTBOX — a rejection is recorded as a fact; execution facts are absent
      // ---------------------------------------------------------------------
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);

      expect(types).toContain('approval.rejected');
      expect(types).toContain('case.closure_recorded');
      expect(types).toContain('case.closed');

      // The negative half — the part a "does it work?" test would forget.
      expect(types).not.toContain('approval.approved');
      expect(types).not.toContain('proposal.executing');
      expect(types).not.toContain('proposal.executed');
      expect(types).not.toContain('proposal.audited');
      expect(types).not.toContain('outcome.measurement_recorded');
      // The REFUSED transition emitted nothing at all.
      expect(types.filter((t) => t.startsWith('proposal.')).sort()).toEqual([
        'proposal.created',
        'proposal.review_requested',
      ]);

      // One correlation id across the whole refusal chain.
      expect([...new Set(outbox.map((r) => r.correlation_id))]).toEqual([correlationId]);

      const rejectionEvent = outbox.find((r) => r.event_type === 'approval.rejected');
      expect(rejectionEvent).toBeDefined();
      expect(rejectionEvent!.actor_user_id).toBe(sponsorId);
      expect(rejectionEvent!.case_id).toBe(caseId);

      await control.query(`DELETE FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`, [
        actionProposalId,
      ]);
      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 120_000);

  /**
   * CW-GC-E-03 — "expired approval blocks execution".
   *
   * The dangerous variant of the refusal path: the proposal was never
   * rejected, so a naive reader of `status` sees nothing wrong. What must stop
   * execution is the review WINDOW having closed, and it must stop it at BOTH
   * gates — the approval itself, and any later attempt to execute on an
   * approval that has since aged out.
   */
  it('an expired review window blocks approval AND execution, and writes no decision', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-b-expiry-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-b-exp');
      const projectId = await fx.seedProject(orgId, 'golden-b-exp');
      const consultantId = await fx.seedUser(orgId, 'golden-b-exp-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');
      const sponsorId = await fx.seedUser(orgId, 'golden-b-exp-sponsor');
      await fx.seedMembership(orgId, sponsorId, 'ADMIN');

      const consultantApp = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const sponsorApp = createGoldenCaseApp({
        organizationId: orgId,
        userId: sponsorId,
        userRole: 'ADMIN',
        isSuperAdmin: false,
      });
      const asConsultant = (m: 'post' | 'get', url: string) =>
        request(consultantApp)[m](url).set('X-Correlation-ID', correlationId);
      const asSponsor = (m: 'post' | 'get', url: string) =>
        request(sponsorApp)[m](url).set('X-Correlation-ID', correlationId);

      const created = await asConsultant('post', `${BASE}/cases`).send({
        projectId,
        contractedClosureType: 'DECISION_COMPLETED',
      });
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
      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-b-exp');
      await asConsultant('post', `${BASE}/run-bindings`).send({ runId, casePlanVersionId: planVersionId });

      // A proposal whose review window closed an hour ago.
      const payloadDigest = `sha256:${'c'.repeat(64)}`;
      const proposal = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `golden-b-exp-${randomUUID()}`)
        .send({
          runId,
          nodeRunId: `noderun-${randomUUID()}`,
          casePlanVersionId: planVersionId,
          payloadDigest,
          policySnapshotRef: 'policy://light/v1',
          effectClass: 'SENSITIVE_UPDATE',
          previewRef: 'preview://golden-b-exp',
          proposerType: 'AGENT',
          expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        });
      expect(proposal.status).toBe(201);
      const actionProposalId: string = proposal.body.data.actionProposalId;

      const submitted = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/submit-for-review`
      ).send({ expectedVersion: proposal.body.data.version });
      expect(submitted.status).toBe(200);

      // Gate 1: APPROVE is refused because the window has closed.
      const lateApproval = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-b-exp-approve-${randomUUID()}`)
        .send({
          proposalVersion: submitted.body.data.proposalVersion,
          payloadDigest,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://light/v1',
          expectedVersion: submitted.body.data.version,
        });
      expect(lateApproval.status).toBe(409);
      expect(lateApproval.body.error.code).toBe('PROPOSAL_REVIEW_WINDOW_EXPIRED');

      // Gate 2: execution cannot be forced past the missing approval either.
      const forced = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/transition-to-executing`
      ).send({ expectedVersion: submitted.body.data.version });
      expect(forced.status).toBe(409);

      // Nothing moved and nothing was decided.
      const row = await control.query(
        `SELECT status, version FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(row.rows[0].status).toBe('PENDING_REVIEW');
      expect(Number(row.rows[0].version)).toBe(submitted.body.data.version);

      const decisions = await control.query(
        `SELECT decision_id FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(decisions.rowCount).toBe(0);

      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);
      expect(types).not.toContain('approval.approved');
      expect(types).not.toContain('proposal.executing');

      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
