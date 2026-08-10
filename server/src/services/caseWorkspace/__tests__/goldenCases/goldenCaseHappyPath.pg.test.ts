/**
 * GOLDEN CASE A — the happy path, end to end on a real database.
 *
 *   Case → Plan (draft → review → publish) → Run binding → node acceptance
 *        → Action proposal → review → APPROVE by a second human
 *        → executing → executed → audited
 *        → Results (deliverable artifact link + value measurement)
 *        → closure axis → contracted closure recorded
 *
 * What this proves that no single-service suite can:
 *   - every step is reachable over the HTTP surface a client actually uses;
 *   - the identifiers a client is handed (caseId, planVersionId, runId,
 *     actionProposalId, linkId, measurementId) are the identifiers in Postgres
 *     (CW-RT-064: API and real database readback expose the same state);
 *   - ONE `X-Correlation-ID` sent by the client appears on EVERY outbox row the
 *     whole chain produced, so an operator can reconstruct
 *     Case → plan → run → proposal/decision → artifact → deliverable from the
 *     event stream alone (CW-RT-066, CW-GC-E-04);
 *   - approval is a real second-person act: the approving actor is not the
 *     proposing actor, and the self-approval attempt is refused first.
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
warnSkipped('Golden Case A (happy path)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE A — Case → Plan → Run → approval → Results, on real Postgres', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('walks the full chain, and the outbox reconstructs it under one correlation id', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-a-${randomUUID()}`;
    try {
      // -- Cast ---------------------------------------------------------------
      // Two real, ACTIVE members: a consultant who proposes and a sponsor who
      // approves. GOV-022 forbids self-approval, so one actor cannot do both.
      const orgId = await fx.seedOrg('golden-a');
      const projectId = await fx.seedProject(orgId, 'golden-a');
      const consultantId = await fx.seedUser(orgId, 'golden-a-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');
      const sponsorId = await fx.seedUser(orgId, 'golden-a-sponsor');
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
      const asConsultant = (m: 'post' | 'get' | 'put', url: string) =>
        request(consultant)[m](url).set('X-Correlation-ID', correlationId);
      const asSponsor = (m: 'post' | 'get' | 'put', url: string) =>
        request(sponsor)[m](url).set('X-Correlation-ID', correlationId);

      // -- 1. Case ------------------------------------------------------------
      const created = await asConsultant('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        governanceTier: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
        sponsorUserId: sponsorId,
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;

      const activated = await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'ACTIVE',
        reason: 'engagement kickoff',
      });
      expect(activated.status).toBe(200);

      // -- 2. Plan ------------------------------------------------------------
      const draft = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
        changeReason: 'initial delivery plan',
      });
      expect(draft.status).toBe(201);
      const planVersionId: string = draft.body.data.casePlanVersionId;

      const validation = await asConsultant('get', `${BASE}/plan-versions/${planVersionId}/validate`);
      expect(validation.status).toBe(200);
      expect(validation.body.data.valid).toBe(true);

      const proposedPlan = await asConsultant('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      expect(proposedPlan.status).toBe(200);

      const publishedPlan = await asSponsor('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });
      expect(publishedPlan.status).toBe(200);
      expect(publishedPlan.body.data.status).toBe('PUBLISHED');

      // -- 3. Run -------------------------------------------------------------
      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-a');
      const binding = await asConsultant('post', `${BASE}/run-bindings`).send({
        runId,
        casePlanVersionId: planVersionId,
      });
      expect(binding.status).toBe(201);
      // The run is pinned to the exact graph that was published.
      expect(binding.body.data.graphDigest).toBe(publishedPlan.body.data.graphDigest);

      const nodeRunId = `noderun-${randomUUID()}`;
      const acceptance = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
        nodeRunId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { summary: 'margin analysis produced' },
        occurredAt: new Date().toISOString(),
      });
      expect(acceptance.status).toBe(201);
      expect(acceptance.body.data.caseId).toBe(caseId);

      // -- 4. Proposal and approval ------------------------------------------
      const proposalIdemKey = `golden-a-proposal-${randomUUID()}`;
      const payloadDigest = `sha256:${'a'.repeat(64)}`;
      const proposal = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', proposalIdemKey)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest,
          policySnapshotRef: 'policy://standard/v1',
          effectClass: 'SAFE_ADDITIVE',
          previewRef: 'preview://golden-a',
          proposerType: 'HUMAN',
        });
      expect(proposal.status).toBe(201);
      const actionProposalId: string = proposal.body.data.actionProposalId;
      expect(proposal.body.data.status).toBe('DRAFT');

      const submitted = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/submit-for-review`
      ).send({ expectedVersion: proposal.body.data.version });
      expect(submitted.status).toBe(200);
      expect(submitted.body.data.status).toBe('PENDING_REVIEW');

      const decisionBody = {
        proposalVersion: submitted.body.data.proposalVersion,
        payloadDigest,
        decision: 'APPROVE',
        source: 'BUTTON',
        authenticationAssurance: 'AAL2',
        approvalChannelPolicy: 'in-app',
        policyVersion: 'policy://standard/v1',
        expectedVersion: submitted.body.data.version,
      };

      // GOV-022: the proposer cannot approve their own proposal.
      const selfApproval = await asConsultant('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-a-self-${randomUUID()}`)
        .send(decisionBody);
      expect(selfApproval.status).toBe(403);
      expect(selfApproval.body.error.code).toBe('SELF_APPROVAL_FORBIDDEN');

      const stillPending = await control.query(
        `SELECT status FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(stillPending.rows[0].status).toBe('PENDING_REVIEW');

      const approved = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `golden-a-approve-${randomUUID()}`)
        .send(decisionBody);
      expect(approved.status).toBe(200);
      expect(approved.body.data.proposal.status).toBe('APPROVED');
      expect(approved.body.data.decision.decision).toBe('APPROVE');
      expect(approved.body.data.decision.decidedByActorId).toBe(sponsorId);

      // -- 5. Execution -------------------------------------------------------
      const executing = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/transition-to-executing`
      ).send({ expectedVersion: approved.body.data.proposal.version });
      expect(executing.status).toBe(200);
      expect(executing.body.data.status).toBe('EXECUTING');

      const executed = await asConsultant(
        'post',
        `${BASE}/proposals/${actionProposalId}/transition-to-executed`
      ).send({ expectedVersion: executing.body.data.version });
      expect(executed.status).toBe(200);

      const audited = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/audit`).send({
        expectedVersion: executed.body.data.version,
      });
      expect(audited.status).toBe(200);
      expect(audited.body.data.status).toBe('AUDITED');

      // -- 6. Results ---------------------------------------------------------
      const deliverableId = `deliverable-${randomUUID()}`;
      const link = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'document',
        artifactId: deliverableId,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
      });
      expect(link.status).toBe(201);
      expect(link.body.data.linkStatus).toBe('ACTIVE');
      const linkId: string = link.body.data.linkId;

      // The artifact is REFERENCED and pinned, never copied (CW-GC-C-02).
      const pinned = await asConsultant('post', `${BASE}/artifact-links/${linkId}/pin`).send({
        revision: 'rev-2',
        reason: 'final accepted revision',
      });
      expect(pinned.status).toBe(200);
      expect(pinned.body.data.artifactRevision).toBe('rev-2');
      expect(pinned.body.data.revisionPinHistory.length).toBeGreaterThanOrEqual(1);

      const measurement = await asConsultant('post', `${BASE}/cases/${caseId}/value-measurements`).send({
        metricKey: 'close_cycle_days',
        metricName: 'Month-end close cycle (days)',
        baselineValue: 9,
        baselineUnit: 'days',
        targetValue: 5,
        targetUnit: 'days',
        actualValue: 6,
        actualUnit: 'days',
        measurementStatus: 'PARTIAL',
        measurementDate: new Date().toISOString(),
        confidence: 'MEDIUM',
        attribution: 'partially attributable to the delivered process change',
      });
      expect(measurement.status).toBe(201);
      // CW-GC-B-11: a target is never presented as an actual.
      expect(measurement.body.data.targetValue).toBe(5);
      expect(measurement.body.data.actualValue).toBe(6);
      expect(measurement.body.data.measurementStatus).toBe('PARTIAL');

      // -- 7. Closure ---------------------------------------------------------
      const axis = await asSponsor('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'delivery',
        status: 'COMPLETED',
      });
      expect(axis.status).toBe(200);

      const closure = await asSponsor('post', `${BASE}/cases/${caseId}/closure`).send({
        closureType: 'DELIVERY_COMPLETED',
        evidenceRef: `artifact://${deliverableId}#rev-2`,
      });
      expect(closure.status).toBe(200);

      const closed = await asSponsor('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'CLOSED',
        reason: 'contracted delivery accepted',
      });
      expect(closed.status).toBe(200);
      expect(closed.body.data.caseStatus).toBe('CLOSED');

      // ======================================================================
      // READBACK — Postgres, out of band, agrees with what the API returned
      // ======================================================================
      const caseRow = await control.query(
        `SELECT case_status, closure_type, closure_evidence_ref, delivery_status, organization_id
           FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]).toMatchObject({
        case_status: 'CLOSED',
        closure_type: 'DELIVERY_COMPLETED',
        delivery_status: 'COMPLETED',
        organization_id: orgId,
      });
      expect(caseRow.rows[0].closure_evidence_ref).toBe(`artifact://${deliverableId}#rev-2`);

      const proposalRow = await control.query(
        `SELECT status, case_id, run_id, node_run_id FROM case_workspace_action_proposals
          WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      expect(proposalRow.rows[0]).toMatchObject({
        status: 'AUDITED',
        case_id: caseId,
        run_id: runId,
        node_run_id: nodeRunId,
      });

      const decisionRows = await control.query(
        `SELECT decision, decided_by_actor_id FROM case_workspace_action_proposal_decisions
          WHERE action_proposal_id = $1`,
        [actionProposalId]
      );
      // Exactly one decision: the refused self-approval wrote nothing.
      expect(decisionRows.rowCount).toBe(1);
      expect(decisionRows.rows[0].decision).toBe('APPROVE');
      expect(decisionRows.rows[0].decided_by_actor_id).toBe(sponsorId);

      const linkRow = await control.query(
        `SELECT artifact_id, artifact_revision, relation, link_status
           FROM case_workspace_artifact_links WHERE link_id = $1`,
        [linkId]
      );
      expect(linkRow.rows[0]).toMatchObject({
        artifact_id: deliverableId,
        artifact_revision: 'rev-2',
        relation: 'DELIVERABLE',
        link_status: 'ACTIVE',
      });

      // ======================================================================
      // OUTBOX — the operator trace
      // ======================================================================
      const outbox = await readOutboxForOrg(control, orgId);
      expect(outbox.length).toBeGreaterThan(0);

      // (a) ONE correlation id, sent by the client, on EVERY event of the chain.
      const correlationIds = new Set(outbox.map((r) => r.correlation_id));
      expect([...correlationIds]).toEqual([correlationId]);

      // (b) The chain is reconstructible from the event stream ALONE, in causal
      //     order, with no step silently missing (CW-RT-066: "audit
      //     reconstructs conversation → Case → plan → Run → NodeRun → command →
      //     proposal/decision → artifact → deliverable"). This is asserted as
      //     the exact sequence, not a subset: a command that stops emitting is
      //     as much a defect as one that emits the wrong thing.
      const types = eventTypes(outbox);
      expect(types).toEqual([
        'case.created',
        'case.activated',
        'case.plan.draft_created',
        'case.plan.proposed',
        'case.plan.published',
        'run.bound_to_plan_version',
        'node.result_accepted',
        'proposal.created',
        'proposal.review_requested',
        'approval.approved',
        'proposal.executing',
        'proposal.executed',
        'proposal.audited',
        'artifact.linked_to_case',
        'evidence.pinned',
        'outcome.measurement_recorded',
        'case.closure_axis_updated',
        'case.closure_recorded',
        'case.closed',
      ]);

      // The refused self-approval emitted NOTHING — a rejected command must not
      // leave a fact behind.
      expect(types.filter((t) => t === 'approval.approved').length).toBe(1);
      expect(
        containsInOrder(types, ['case.created', 'case.plan.published', 'approval.approved', 'case.closed'])
      ).toBe(true);

      // (c) Tenancy and identity are stamped on every event — no orphan facts.
      for (const row of outbox) {
        expect(row.organization_id).toBe(orgId);
        expect(row.actor_user_id).toBeTruthy();
        expect(row.correlation_id).toBeTruthy();
        expect(row.aggregate_type).toBeTruthy();
        expect(row.aggregate_id).toBeTruthy();
      }

      // (d) Case-scoped events carry the caseId, so a per-Case trace is a
      //     single indexed read rather than a join across aggregates.
      const caseScoped = outbox.filter((r) => r.aggregate_type === 'CASE');
      expect(caseScoped.length).toBeGreaterThan(0);
      for (const row of caseScoped) expect(row.case_id).toBe(caseId);

      // (e) Aggregate versions are monotonic per aggregate (SEC-025).
      const byAggregate = new Map<string, number[]>();
      for (const row of outbox) {
        if (row.aggregate_version === null) continue;
        const key = `${row.aggregate_type}:${row.aggregate_id}`;
        byAggregate.set(key, [...(byAggregate.get(key) ?? []), Number(row.aggregate_version)]);
      }
      expect(byAggregate.size).toBeGreaterThan(0);
      for (const versions of byAggregate.values()) {
        const sorted = [...versions].sort((a, b) => a - b);
        expect(versions).toEqual(sorted);
      }

      // (f) No event id is duplicated — consumers dedupe by eventId (SEC-024).
      expect(new Set(outbox.map((r) => r.event_id)).size).toBe(outbox.length);

      // (g) Facts, not payloads: the approval event carries no document blob.
      const approvalEvent = outbox.find((r) => r.event_type === 'approval.approved');
      expect(approvalEvent).toBeDefined();
      expect(JSON.stringify(approvalEvent!.redacted_summary).length).toBeLessThan(2048);

      // -- cleanup of rows the fixture teardown does not own -------------------
      await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_node_result_acceptances WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`, [
        actionProposalId,
      ]);
      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
