/**
 * INTEGRATION GATE — the whole module, one chain, one correlation id.
 *
 * ===========================================================================
 * WHAT THIS ADDS OVER THE GOLDEN CASES NEXT DOOR
 * ===========================================================================
 * `../goldenCases/goldenCaseHappyPath.pg.test.ts` already walks
 * Case -> Plan -> Run -> approval -> Results over the real HTTP surface. This
 * suite is the FINAL INTEGRATION GATE and asks three questions that one does
 * not:
 *
 *   (1) WAITS ARE IN THE CHAIN. The happy path never blocks. Doc 06's whole
 *       point is that a Run parks on a Wait and resumes when the Wait is
 *       satisfied, so a chain that never waits has not exercised the resume
 *       path at all. Here the proposal is approved, a DOMAIN_EVENT wait is
 *       registered against it, the wait is satisfied by naming a REAL outbox
 *       event id from earlier in this same chain, and only then does the
 *       proposal transition to EXECUTING.
 *
 *   (2) THE CAUSATION EDGE IS ASSERTED, NOT JUST THE CORRELATION ID. A shared
 *       `correlation_id` proves the rows belong to one request family. It does
 *       NOT prove any row explains any other. `causation_id` is the column
 *       that carries "this happened BECAUSE of that", and doc 06's
 *       reconstruction requirement is only met if that column actually
 *       resolves. This suite publishes a SECOND plan version so a real
 *       `case.plan.published` -> `case.plan.superseded` causal edge exists,
 *       and asserts every non-null `causation_id` in the whole chain resolves
 *       to an `event_id` that is itself in the chain — a dangling causation
 *       pointer is an unreconstructable audit trail, which is the defect doc
 *       06 §8 is about.
 *
 *   (3) EVERY MUTATION LEFT A TRACE — counted, not eyeballed. Each mutating
 *       HTTP call below appends its expected event type(s) to `journal`, and
 *       the outbox is asserted to equal that journal EXACTLY, in order. A
 *       command that stops emitting turns this red; so does one that emits
 *       twice; so does an extra event nobody declared. That is the literal
 *       "did every mutation leave a trace" question, decided by the database
 *       rather than by reading the services.
 *
 * ---------------------------------------------------------------------------
 * GATE — never a silent pass on a mock database
 * ---------------------------------------------------------------------------
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *   npx vitest run src/services/caseWorkspace/__tests__/integration --environment node
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
} from '../goldenCases/goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('INTEGRATION GATE (full chain + observability)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('INTEGRATION GATE — full business chain, correlation/causation, event coverage', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it(
    'Case -> Plan -> Run -> proposal -> approval -> wait -> resume -> Results, ' +
      'with an outbox that reconstructs the chain and misses no mutation',
    async () => {
      const fx = new GoldenCaseFixtures(control);
      const correlationId = `integration-gate-${randomUUID()}`;

      /** Expected outbox event types, appended by each mutating call, in order. */
      const journal: string[] = [];
      /** Human-readable label per journal entry, so a mismatch names the step. */
      const journalSteps: string[] = [];
      const record = (step: string, ...types: string[]) => {
        for (const t of types) {
          journal.push(t);
          journalSteps.push(step);
        }
      };

      let caseId = '';
      let actionProposalId = '';

      try {
        // -- Cast --------------------------------------------------------------
        const orgId = await fx.seedOrg('integ-chain');
        const projectId = await fx.seedProject(orgId, 'integ-chain');
        const consultantId = await fx.seedUser(orgId, 'integ-consultant');
        await fx.seedMembership(orgId, consultantId, 'MEMBER');
        const sponsorId = await fx.seedUser(orgId, 'integ-sponsor');
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
        const asConsultant = (m: 'post' | 'get' | 'put', url: string) =>
          request(consultantApp)[m](url).set('X-Correlation-ID', correlationId);
        const asSponsor = (m: 'post' | 'get' | 'put', url: string) =>
          request(sponsorApp)[m](url).set('X-Correlation-ID', correlationId);

        // == 1. CASE ===========================================================
        const created = await asConsultant('post', `${BASE}/cases`).send({
          projectId,
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
          contractedClosureType: 'DELIVERY_COMPLETED',
          sponsorUserId: sponsorId,
        });
        expect(created.status).toBe(201);
        caseId = created.body.data.caseId;
        record('POST /cases', 'case.created');

        const activated = await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({
          targetStatus: 'ACTIVE',
          reason: 'engagement kickoff',
        });
        expect(activated.status).toBe(200);
        record('POST /cases/:id/status ACTIVE', 'case.activated');

        const tier = await asSponsor('post', `${BASE}/cases/${caseId}/governance-tier`).send({
          tier: 'CONTROLLED',
          reason: 'regulated client, board-visible engagement',
        });
        expect(tier.status).toBe(200);
        record('POST /cases/:id/governance-tier', 'case.governance_tier_changed');

        // == 2. PLAN (draft -> update -> propose -> publish) ====================
        const draft1 = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
          semanticGraph: minimalGraph(),
          changeReason: 'initial delivery plan',
        });
        expect(draft1.status).toBe(201);
        const planV1: string = draft1.body.data.casePlanVersionId;
        record('POST /cases/:id/plan-versions #1', 'case.plan.draft_created');

        const updatedDraft = await asConsultant('put', `${BASE}/plan-versions/${planV1}`).send({
          semanticGraph: minimalGraph(),
          expectedVersion: draft1.body.data.version,
        });
        expect(updatedDraft.status).toBe(200);
        record('PUT /plan-versions/:id', 'case.plan.draft_updated');

        const viewState = await asConsultant('put', `${BASE}/plan-versions/${planV1}/view-state/SIMPLE`).send({
          viewState: { collapsed: ['end'] },
        });
        expect(viewState.status).toBe(200);
        record('PUT /plan-versions/:id/view-state/SIMPLE', 'case.plan.view_state_updated');

        const validation = await asConsultant('get', `${BASE}/plan-versions/${planV1}/validate`);
        expect(validation.status).toBe(200);
        expect(validation.body.data.valid).toBe(true);

        const proposed1 = await asConsultant('post', `${BASE}/plan-versions/${planV1}/propose`).send({
          expectedVersion: updatedDraft.body.data.version,
        });
        expect(proposed1.status).toBe(200);
        record('POST /plan-versions/:id/propose #1', 'case.plan.proposed');

        const published1 = await asSponsor('post', `${BASE}/plan-versions/${planV1}/publish`).send({
          expectedVersion: proposed1.body.data.version,
        });
        expect(published1.status).toBe(200);
        expect(published1.body.data.status).toBe('PUBLISHED');
        record('POST /plan-versions/:id/publish #1', 'case.plan.published');

        // A SECOND published plan version, so a real causal edge
        // (published -> superseded) exists to assert against.
        const draft2 = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
          semanticGraph: minimalGraph(),
          supersedesPlanVersionId: planV1,
          changeReason: 'scope change agreed with the sponsor',
        });
        expect(draft2.status).toBe(201);
        const planV2: string = draft2.body.data.casePlanVersionId;
        record('POST /cases/:id/plan-versions #2', 'case.plan.draft_created');

        const proposed2 = await asConsultant('post', `${BASE}/plan-versions/${planV2}/propose`).send({
          expectedVersion: draft2.body.data.version,
        });
        expect(proposed2.status).toBe(200);
        record('POST /plan-versions/:id/propose #2', 'case.plan.proposed');

        const published2 = await asSponsor('post', `${BASE}/plan-versions/${planV2}/publish`).send({
          expectedVersion: proposed2.body.data.version,
        });
        expect(published2.status).toBe(200);
        // Publishing v2 supersedes v1 IN THE SAME TRANSACTION — two events, one command.
        record(
          'POST /plan-versions/:id/publish #2 (supersedes #1)',
          'case.plan.published',
          'case.plan.superseded'
        );

        const v1AfterSupersede = await control.query(
          `SELECT status FROM case_plan_versions WHERE case_plan_version_id = $1`,
          [planV1]
        );
        expect(v1AfterSupersede.rows[0].status).toBe('SUPERSEDED');

        // == 3. RUN ============================================================
        const runId = await fx.seedExecutionRun(orgId, consultantId, 'integ-chain');
        const binding = await asConsultant('post', `${BASE}/run-bindings`).send({
          runId,
          casePlanVersionId: planV2,
        });
        expect(binding.status).toBe(201);
        expect(binding.body.data.graphDigest).toBe(published2.body.data.graphDigest);
        record('POST /run-bindings', 'run.bound_to_plan_version');

        const nodeRunId = `noderun-${randomUUID()}`;
        const acceptance = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
          nodeRunId,
          nodeType: 'CAPABILITY',
          nodeCompletionState: 'COMPLETED',
          resultAcceptance: 'ACCEPTED',
          acceptanceInputSnapshot: { summary: 'baseline model produced' },
          occurredAt: new Date().toISOString(),
        });
        expect(acceptance.status).toBe(201);
        expect(acceptance.body.data.caseId).toBe(caseId);
        record('POST /runs/:runId/node-result-acceptances', 'node.result_accepted');

        // == 4. PROPOSAL -> APPROVAL ===========================================
        const payloadDigest = `sha256:${'b'.repeat(64)}`;
        const proposal = await asConsultant('post', `${BASE}/cases/${caseId}/proposals`)
          .set('Idempotency-Key', `integ-proposal-${randomUUID()}`)
          .send({
            runId,
            nodeRunId,
            casePlanVersionId: planV2,
            payloadDigest,
            policySnapshotRef: 'policy://controlled/v1',
            effectClass: 'SAFE_ADDITIVE',
            previewRef: 'preview://integ-chain',
            proposerType: 'HUMAN',
          });
        expect(proposal.status).toBe(201);
        actionProposalId = proposal.body.data.actionProposalId;
        record('POST /cases/:id/proposals', 'proposal.created');

        const submitted = await asConsultant(
          'post',
          `${BASE}/proposals/${actionProposalId}/submit-for-review`
        ).send({ expectedVersion: proposal.body.data.version });
        expect(submitted.status).toBe(200);
        record('POST /proposals/:id/submit-for-review', 'proposal.review_requested');

        const approved = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/decision`)
          .set('Idempotency-Key', `integ-approve-${randomUUID()}`)
          .send({
            proposalVersion: submitted.body.data.proposalVersion,
            payloadDigest,
            decision: 'APPROVE',
            source: 'BUTTON',
            authenticationAssurance: 'AAL2',
            approvalChannelPolicy: 'in-app',
            policyVersion: 'policy://controlled/v1',
            expectedVersion: submitted.body.data.version,
          });
        expect(approved.status).toBe(200);
        expect(approved.body.data.proposal.status).toBe('APPROVED');
        expect(approved.body.data.decision.decidedByActorId).toBe(sponsorId);
        record('POST /proposals/:id/decision APPROVE', 'approval.approved');

        // The id of the approval event, read from the outbox, is what the wait
        // below is satisfied BY — a real event from this chain, not an invented
        // token. This is the point of the whole exercise: the resume is caused
        // by something the audit trail already contains.
        const approvalEventRow = await control.query<{ event_id: string }>(
          `SELECT event_id FROM case_workspace_event_outbox
            WHERE organization_id = $1 AND event_type = 'approval.approved'`,
          [orgId]
        );
        expect(approvalEventRow.rowCount).toBe(1);
        const approvalEventId = approvalEventRow.rows[0].event_id;

        // == 5. WAIT -> RESUME =================================================
        const wait = await asConsultant('post', `${BASE}/cases/${caseId}/waits`)
          .set('Idempotency-Key', `integ-wait-${randomUUID()}`)
          .send({
            runId,
            actionProposalId,
            nodeRunId,
            waitType: 'DOMAIN_EVENT',
            expectedEventType: 'approval.approved',
            timeoutAt: new Date(Date.now() + 3_600_000).toISOString(),
          });
        expect(wait.status).toBe(201);
        const waitId: string = wait.body.data.waitId;
        expect(wait.body.data.status).toBe('ACTIVE');
        record('POST /cases/:id/waits', 'wait.registered');

        // A run parked on an ACTIVE wait is readable as parked.
        const activeWaits = await asConsultant('get', `${BASE}/runs/${runId}/waits`);
        expect(activeWaits.status).toBe(200);
        expect(activeWaits.body.data.filter((w: any) => w.status === 'ACTIVE')).toHaveLength(1);

        const resolved = await asConsultant('post', `${BASE}/waits/${waitId}/resolve`).send({
          satisfiedByEventId: approvalEventId,
          expectedVersion: wait.body.data.version,
        });
        expect(resolved.status).toBe(200);
        expect(resolved.body.data.status).toBe('SATISFIED');
        expect(resolved.body.data.satisfiedByEventId).toBe(approvalEventId);
        record('POST /waits/:id/resolve', 'wait.satisfied');

        // Readback out of band: the wait really flipped, and it really recorded
        // WHICH event satisfied it.
        const waitRow = await control.query(
          `SELECT status, satisfied_by_event_id, run_id, action_proposal_id
             FROM case_workspace_waits WHERE wait_id = $1`,
          [waitId]
        );
        expect(waitRow.rows[0]).toMatchObject({
          status: 'SATISFIED',
          satisfied_by_event_id: approvalEventId,
          run_id: runId,
          action_proposal_id: actionProposalId,
        });

        // == 6. EXECUTION (only after the wait cleared) =========================
        const executing = await asConsultant(
          'post',
          `${BASE}/proposals/${actionProposalId}/transition-to-executing`
        ).send({ expectedVersion: approved.body.data.proposal.version });
        expect(executing.status).toBe(200);
        record('POST /proposals/:id/transition-to-executing', 'proposal.executing');

        const executed = await asConsultant(
          'post',
          `${BASE}/proposals/${actionProposalId}/transition-to-executed`
        ).send({ expectedVersion: executing.body.data.version });
        expect(executed.status).toBe(200);
        record('POST /proposals/:id/transition-to-executed', 'proposal.executed');

        const audited = await asSponsor('post', `${BASE}/proposals/${actionProposalId}/audit`).send({
          expectedVersion: executed.body.data.version,
        });
        expect(audited.status).toBe(200);
        record('POST /proposals/:id/audit', 'proposal.audited');

        // == 7. RESULTS ========================================================
        const deliverableId = `deliverable-${randomUUID()}`;
        const link = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
          artifactType: 'document',
          artifactId: deliverableId,
          artifactRevision: 'rev-1',
          relation: 'DELIVERABLE',
        });
        expect(link.status).toBe(201);
        const linkId: string = link.body.data.linkId;
        record('POST /cases/:id/artifact-links', 'artifact.linked_to_case');

        const pinned = await asConsultant('post', `${BASE}/artifact-links/${linkId}/pin`).send({
          revision: 'rev-3',
          reason: 'accepted revision',
        });
        expect(pinned.status).toBe(200);
        record('POST /artifact-links/:id/pin', 'evidence.pinned');

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
        // A target is never presented as an actual.
        expect(measurement.body.data.targetValue).toBe(5);
        expect(measurement.body.data.actualValue).toBe(6);
        record('POST /cases/:id/value-measurements', 'outcome.measurement_recorded');

        // == 8. CLOSURE ========================================================
        const policy = await asSponsor('post', `${BASE}/cases/${caseId}/autonomy-policy`).send({
          policy: 'ASK_EACH_ACTION',
        });
        expect(policy.status).toBe(200);
        record('POST /cases/:id/autonomy-policy', 'case.autonomy_policy_changed');

        const axis = await asSponsor('post', `${BASE}/cases/${caseId}/closure-axis`).send({
          axis: 'delivery',
          status: 'COMPLETED',
        });
        expect(axis.status).toBe(200);
        record('POST /cases/:id/closure-axis', 'case.closure_axis_updated');

        const closure = await asSponsor('post', `${BASE}/cases/${caseId}/closure`).send({
          closureType: 'DELIVERY_COMPLETED',
          evidenceRef: `artifact://${deliverableId}#rev-3`,
        });
        expect(closure.status).toBe(200);
        record('POST /cases/:id/closure', 'case.closure_recorded');

        const closed = await asSponsor('post', `${BASE}/cases/${caseId}/status`).send({
          targetStatus: 'CLOSED',
          reason: 'contracted delivery accepted',
        });
        expect(closed.status).toBe(200);
        expect(closed.body.data.caseStatus).toBe('CLOSED');
        record('POST /cases/:id/status CLOSED', 'case.closed');

        // ======================================================================
        // A. FINAL STATE, READ OUT OF BAND
        // ======================================================================
        const caseRow = await control.query(
          `SELECT case_status, closure_type, delivery_status, governance_tier, autonomy_policy,
                  current_plan_version_id, organization_id
             FROM case_core WHERE case_id = $1`,
          [caseId]
        );
        expect(caseRow.rows[0]).toMatchObject({
          case_status: 'CLOSED',
          closure_type: 'DELIVERY_COMPLETED',
          delivery_status: 'COMPLETED',
          governance_tier: 'CONTROLLED',
          autonomy_policy: 'ASK_EACH_ACTION',
          organization_id: orgId,
        });

        const proposalRow = await control.query(
          `SELECT status, case_id, run_id, node_run_id, case_plan_version_id
             FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
          [actionProposalId]
        );
        expect(proposalRow.rows[0]).toMatchObject({
          status: 'AUDITED',
          case_id: caseId,
          run_id: runId,
          node_run_id: nodeRunId,
          case_plan_version_id: planV2,
        });

        // ======================================================================
        // B. EVENT COVERAGE — every mutation left EXACTLY the trace it declared
        // ======================================================================
        const outbox = await readOutboxForOrg(control, orgId);
        const types = eventTypes(outbox);

        // Append time, read as TEXT on purpose. `SELECT *` hands `created_at`
        // back through node-postgres as a JS Date, which is MILLISECOND
        // precision — Postgres stores TIMESTAMPTZ at microsecond precision, and
        // commands in this chain land inside the same millisecond. Comparing the
        // Date objects would merge unrelated transactions into one bucket and
        // make the ordering assertions below meaningless. `::text` preserves the
        // stored value exactly.
        const appendTimes = await control.query<{ event_id: string; created_at_text: string }>(
          `SELECT event_id, created_at::text AS created_at_text
             FROM case_workspace_event_outbox WHERE organization_id = $1`,
          [orgId]
        );
        const createdAtText = new Map(appendTimes.rows.map((r) => [r.event_id, r.created_at_text]));
        expect(createdAtText.size).toBe(outbox.length);

        // Named diff first, so a failure says WHICH step lost its event rather
        // than dumping two long arrays.
        const missing: string[] = [];
        const seen = [...types];
        journal.forEach((expectedType, i) => {
          const at = seen.indexOf(expectedType);
          if (at === -1) missing.push(`${journalSteps[i]} -> ${expectedType}`);
          else seen.splice(at, 1);
        });
        expect({ missingEventsForMutations: missing }).toEqual({ missingEventsForMutations: [] });
        // `seen` now holds events NOBODY declared — an undeclared side effect is
        // as much a defect as a missing one.
        expect({ undeclaredExtraEvents: seen }).toEqual({ undeclaredExtraEvents: [] });
        expect(outbox.length).toBe(journal.length);

        // ----------------------------------------------------------------
        // ORDER — asserted per TRANSACTION GROUP, not per row, and here is why
        // ----------------------------------------------------------------
        // FINDING (documented in the assertion rather than hidden by it):
        // `case_workspace_event_outbox` has NO monotonic append-order column.
        // Both `created_at` and `occurred_at` default to `now()`, which in
        // Postgres is the TRANSACTION START timestamp — constant for every
        // statement in one transaction — and the outbox migration's own header
        // tells consumers to read with `ORDER BY created_at`. So the two events
        // one command emits inside one transaction (here `case.plan.published`
        // and the `case.plan.superseded` it CAUSES) carry byte-identical
        // created_at, and any tiebreak on the random-UUID event_id is arbitrary:
        // observed empirically, the EFFECT is read before its CAUSE in roughly
        // half of runs. `case_workspace_history_events` has `global_seq` for
        // exactly this purpose; the outbox has no equivalent.
        //
        // Asserting a strict row-by-row sequence here would therefore encode a
        // coin flip as a requirement. What the schema DOES guarantee, and what
        // an operator can rely on, is asserted instead: the transaction groups
        // are strictly ordered, and each group's contents match — as a set.
        const groups: Array<{ at: string; types: string[] }> = [];
        for (const row of outbox) {
          const at = createdAtText.get(row.event_id)!;
          const last = groups[groups.length - 1];
          if (last && last.at === at) last.types.push(row.event_type);
          else groups.push({ at, types: [row.event_type] });
        }
        // Rebuild the same grouping over the journal: every step contributed one
        // group, except the publish that also superseded, which contributed two
        // event types to ONE group.
        let cursor = 0;
        const expectedGroups: string[][] = [];
        while (cursor < journal.length) {
          const step = journalSteps[cursor];
          const same = [];
          while (cursor < journal.length && journalSteps[cursor] === step) {
            same.push(journal[cursor]);
            cursor += 1;
          }
          expectedGroups.push(same);
        }
        expect(groups.length).toBe(expectedGroups.length);
        groups.forEach((group, i) => {
          expect([...group.types].sort()).toEqual([...expectedGroups[i]].sort());
        });
        // Group boundaries are strictly increasing in time — the narrative
        // BETWEEN commands is never scrambled, only within a single command.
        const groupTimes = groups.map((g) => g.at);
        expect(groupTimes).toEqual([...groupTimes].sort());
        expect(new Set(groupTimes).size).toBe(groupTimes.length);

        // ======================================================================
        // C. CORRELATION — one id, sent by the client, on every row
        // ======================================================================
        expect([...new Set(outbox.map((r) => r.correlation_id))]).toEqual([correlationId]);

        // ======================================================================
        // D. CAUSATION — the edges resolve, and at least one real edge exists
        // ======================================================================
        const byEventId = new Map(outbox.map((r) => [r.event_id, r]));
        const causal = outbox.filter((r) => r.causation_id !== null);

        // D1. Every causation pointer resolves to an event in this same chain.
        //     A dangling pointer makes the trail unreconstructable.
        const dangling = causal
          .filter((r) => !byEventId.has(r.causation_id as string))
          .map((r) => `${r.event_type} -> causation_id=${r.causation_id}`);
        expect({ danglingCausationPointers: dangling }).toEqual({ danglingCausationPointers: [] });

        // D2. At least one genuine edge exists: publishing plan v2 caused v1 to
        //     be superseded, and the causation names the exact publish event.
        const supersededEvent = outbox.find((r) => r.event_type === 'case.plan.superseded');
        expect(supersededEvent).toBeDefined();
        const causeOfSupersede = byEventId.get(supersededEvent!.causation_id as string);
        expect(causeOfSupersede?.event_type).toBe('case.plan.published');
        expect(causeOfSupersede?.aggregate_id).toBe(planV2);
        expect(supersededEvent!.aggregate_id).toBe(planV1);

        // D3. No event causes itself, and the causal graph has no 2-cycle.
        for (const row of causal) {
          expect(row.causation_id).not.toBe(row.event_id);
          const parent = byEventId.get(row.causation_id as string);
          expect(parent?.causation_id).not.toBe(row.event_id);
        }

        // D4. A causal child never precedes its cause IN TIME — and when the two
        //     share a timestamp, that is because they were written in ONE
        //     transaction, which is the stronger guarantee: the effect cannot
        //     exist without its cause because neither commits without the other.
        //     (See the ORDER note above for why a strict stream-position
        //     assertion is not available on this schema.)
        for (const row of causal) {
          const parent = byEventId.get(row.causation_id as string)!;
          expect(createdAtText.get(parent.event_id)! <= createdAtText.get(row.event_id)!).toBe(true);
        }
        // The publish/supersede pair specifically IS one transaction.
        expect(createdAtText.get(supersededEvent!.event_id)).toBe(
          createdAtText.get(causeOfSupersede!.event_id)
        );

        // ======================================================================
        // E. THE CHAIN IS RECONSTRUCTABLE FROM THE STREAM ALONE
        // ======================================================================
        // Every event is stamped with tenancy and an actor; case-scoped events
        // carry the caseId; run-scoped events carry the runId. Without these an
        // operator cannot filter a single engagement out of the org's stream.
        for (const row of outbox) {
          expect(row.organization_id).toBe(orgId);
          expect(row.actor_user_id).toBeTruthy();
          expect(row.correlation_id).toBe(correlationId);
          expect(row.aggregate_type).toBeTruthy();
          expect(row.aggregate_id).toBeTruthy();
        }
        const withoutCaseId = outbox.filter((r) => r.case_id === null).map((r) => r.event_type);
        expect({ chainEventsMissingCaseId: withoutCaseId }).toEqual({ chainEventsMissingCaseId: [] });

        const runScoped = outbox.filter((r) =>
          ['run.bound_to_plan_version', 'node.result_accepted', 'wait.registered', 'wait.satisfied'].includes(
            r.event_type
          )
        );
        expect(runScoped.length).toBe(4);
        for (const row of runScoped) expect(row.run_id).toBe(runId);

        // Event ids are unique (consumers dedupe by eventId).
        expect(new Set(outbox.map((r) => r.event_id)).size).toBe(outbox.length);

        // Aggregate versions are monotonic per aggregate.
        const byAggregate = new Map<string, number[]>();
        for (const row of outbox) {
          if (row.aggregate_version === null) continue;
          const key = `${row.aggregate_type}:${row.aggregate_id}`;
          byAggregate.set(key, [...(byAggregate.get(key) ?? []), Number(row.aggregate_version)]);
        }
        for (const versions of byAggregate.values()) {
          expect(versions).toEqual([...versions].sort((a, b) => a - b));
        }

        // Facts, not documents: no event smuggles a payload blob.
        for (const row of outbox) {
          expect(JSON.stringify(row.redacted_summary).length).toBeLessThan(4096);
        }
      } finally {
        // Rows the fixture teardown does not own.
        if (caseId) {
          await control
            .query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_workspace_node_result_acceptances WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_plan_view_state WHERE case_plan_version_id IN
                      (SELECT case_plan_version_id FROM case_plan_versions WHERE case_id = $1)`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
        }
        if (actionProposalId) {
          await control
            .query(`DELETE FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`, [
              actionProposalId,
            ])
            .catch(() => undefined);
        }
        await fx.teardown();
      }
    },
    180_000
  );
});
