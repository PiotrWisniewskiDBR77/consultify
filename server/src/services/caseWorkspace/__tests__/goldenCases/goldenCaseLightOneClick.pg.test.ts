/**
 * GOLDEN CASE D — a small LIGHT engagement, from a conversational work order
 * to a delivered result, on a real database.
 *
 *   Teresa work order: propose (creates nothing) -> confirm (exactly one
 *     Case, caseProfile=LIGHT)
 *        -> "Zatwierdź i rozpocznij" (POST /cases/:caseId/light-start):
 *           DRAFT -> ACTIVE, minimal canonical Plan v1 published, one Run
 *           bound, one NodeRun created, all in ONE semantic operation
 *        -> the LIGHT node's result is accepted
 *        -> a deliverable is linked and the Case closes DELIVERY_COMPLETED
 *        -> a double-click / retried light-start is idempotent
 *           ('already_started', identical identifiers, zero extra writes)
 *
 * What this proves that Golden Cases A/B/C do not:
 *   - CW-CANON-01/CW-CANON-03 (docs 04, caseIntakeService.ts's own header):
 *     proposeWorkOrder creates NOTHING (zero Cases, zero Runs — the
 *     "informational question" shape), and confirmWorkOrder creates EXACTLY
 *     ONE Case from the SAME digested work order a human was shown between
 *     the two calls;
 *   - the LIGHT profile's own one-click contract (lightOneClickService.ts's
 *     header): no separate "publish the plan" / "bind the run" client calls
 *     — one POST takes a DRAFT LIGHT Case all the way to a bound, ready Run;
 *   - that one-click is genuinely idempotent under a real double-click: a
 *     second call for the same caseId returns 'already_started' with the
 *     IDENTICAL runId/casePlanVersionId/nodeRunIds as the first call, and
 *     creates no second Run, no second Plan, no second NodeRun;
 *   - a LIGHT Case can complete the full arc — intake, start, result,
 *     delivered closure — without a human ever separately proposing,
 *     submitting for review, or approving a plan (LIGHT's whole point).
 *
 * This is the "male LIGHT zlecenie od rozmowy do rezultatu" scenario from
 * the acceptance brief's Golden Case list (item 1).
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
  readOutboxForOrg,
  warnSkipped,
} from './goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('Golden Case D (LIGHT one-click, conversation to result)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE D — LIGHT: work order -> one-click start -> result -> delivered closure', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('walks Teresa work order -> LIGHT one-click -> result -> delivered closure, idempotently', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-d-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-d');
      const projectId = await fx.seedProject(orgId, 'golden-d');
      const consultantId = await fx.seedUser(orgId, 'golden-d-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      // -- 1. Work order: propose creates NOTHING -----------------------------
      const workOrder = {
        projectId,
        caseName: 'Quick pricing sanity check',
        goal: 'Confirm the new list price does not break the smallest customer segment',
        scope: ['pricing', 'smallest segment'],
        expectedOutcome: 'A go/no-go recommendation on the new list price',
        constraints: ['no client-facing change until sign-off'],
        successCriteria: ['recommendation delivered within one sitting'],
        contractedClosureType: 'DELIVERY_COMPLETED' as const,
        caseProfile: 'LIGHT' as const,
      };

      const proposed = await as('post', `${BASE}/case-intake/work-orders/propose`).send({ workOrder });
      expect(proposed.status).toBe(200); // 200, not 201: CW-CANON-01, nothing created.
      expect(proposed.body.data.caseCreated).toBe(false);
      expect(proposed.body.data.runCreated).toBe(false);
      const workOrderDigest: string = proposed.body.data.workOrderDigest;
      expect(workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);

      const casesBeforeConfirm = await control.query(
        `SELECT case_id FROM case_core WHERE project_id = $1`,
        [projectId]
      );
      expect(casesBeforeConfirm.rowCount).toBe(0);

      // -- 2. Confirm: EXACTLY ONE Case, from the SAME digested work order ----
      const confirmed = await as('post', `${BASE}/case-intake/work-orders/confirm`).send({
        workOrder,
        confirmedDigest: workOrderDigest,
      });
      expect(confirmed.status).toBe(201); // 201: this call created the Case.
      expect(confirmed.body.data.caseCreated).toBe(true);
      const caseId: string = confirmed.body.data.caseId;

      const afterConfirm = await control.query(
        `SELECT case_id, case_status, case_profile FROM case_core WHERE project_id = $1`,
        [projectId]
      );
      // Exactly one Case for this project — not zero, not two.
      expect(afterConfirm.rowCount).toBe(1);
      expect(afterConfirm.rows[0].case_id).toBe(caseId);
      expect(afterConfirm.rows[0].case_status).toBe('DRAFT');
      expect(afterConfirm.rows[0].case_profile).toBe('LIGHT');

      // -- 3. "Zatwierdź i rozpocznij" — ONE call, DRAFT -> ready Run ----------
      const started = await as('post', `${BASE}/cases/${caseId}/light-start`).send({});
      expect(started.status).toBe(200);
      expect(started.body.data.outcome).toBe('started');
      expect(started.body.data.alreadyStarted).toBe(false);
      expect(started.body.data.case.caseStatus).toBe('ACTIVE');
      expect(started.body.data.planVersion.status).toBe('PUBLISHED');
      const runId: string = started.body.data.runId;
      const casePlanVersionId: string = started.body.data.casePlanVersionId;
      const nodeRunIds: string[] = started.body.data.nodeRunIds;
      expect(runId).toBeTruthy();
      expect(nodeRunIds.length).toBe(1);

      const bindingRow = await control.query(
        `SELECT run_id, case_plan_version_id, case_id FROM case_workspace_run_bindings WHERE case_id = $1`,
        [caseId]
      );
      expect(bindingRow.rowCount).toBe(1);
      expect(bindingRow.rows[0].run_id).toBe(runId);
      expect(bindingRow.rows[0].case_plan_version_id).toBe(casePlanVersionId);

      const planRow = await control.query(
        `SELECT status FROM case_plan_versions WHERE case_plan_version_id = $1`,
        [casePlanVersionId]
      );
      expect(planRow.rows[0].status).toBe('PUBLISHED');

      // -- 3b. A retried / double-clicked light-start is a true no-op, while
      // the Case is still in the window (ACTIVE) where a second click is a
      // realistic client mistake to guard against. -----------------------
      const startedAgain = await as('post', `${BASE}/cases/${caseId}/light-start`).send({});
      expect(startedAgain.status).toBe(200);
      expect(startedAgain.body.data.outcome).toBe('already_started');
      expect(startedAgain.body.data.alreadyStarted).toBe(true);
      expect(startedAgain.body.data.runId).toBe(runId);
      expect(startedAgain.body.data.casePlanVersionId).toBe(casePlanVersionId);
      expect(startedAgain.body.data.nodeRunIds).toEqual(nodeRunIds);

      const bindingsAfterRetry = await control.query(
        `SELECT run_id FROM case_workspace_run_bindings WHERE case_id = $1`,
        [caseId]
      );
      // Still exactly one binding — the retry created no second Run.
      expect(bindingsAfterRetry.rowCount).toBe(1);
      const plansAfterRetry = await control.query(
        `SELECT case_plan_version_id FROM case_plan_versions WHERE case_id = $1`,
        [caseId]
      );
      expect(plansAfterRetry.rowCount).toBe(1);

      // -- 4. The LIGHT node's result -------------------------------------------
      const acceptance = await as('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
        nodeRunId: nodeRunIds[0],
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { summary: 'go/no-go recommendation delivered: GO' },
        occurredAt: new Date().toISOString(),
      });
      expect(acceptance.status).toBe(201);
      expect(acceptance.body.data.caseId).toBe(caseId);

      // -- 5. Deliverable and delivered closure --------------------------------
      const deliverableId = `deliverable-${randomUUID()}`;
      const link = await as('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'document',
        artifactId: deliverableId,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
      });
      expect(link.status).toBe(201);
      const linkId: string = link.body.data.linkId;

      const axis = await as('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'delivery',
        status: 'COMPLETED',
      });
      expect(axis.status).toBe(200);

      const closure = await as('post', `${BASE}/cases/${caseId}/closure`).send({
        closureType: 'DELIVERY_COMPLETED',
        evidenceRef: `artifact://${deliverableId}#rev-1`,
      });
      expect(closure.status).toBe(200);

      const closed = await as('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'CLOSED',
        reason: 'go/no-go recommendation delivered',
      });
      expect(closed.status).toBe(200);
      expect(closed.body.data.caseStatus).toBe('CLOSED');

      // ======================================================================
      // READBACK
      // ======================================================================
      const caseRow = await control.query(
        `SELECT case_status, closure_type, case_profile, organization_id FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]).toMatchObject({
        case_status: 'CLOSED',
        closure_type: 'DELIVERY_COMPLETED',
        case_profile: 'LIGHT',
        organization_id: orgId,
      });

      // ======================================================================
      // OUTBOX — proposeWorkOrder truly emitted no Case/Run facts; the whole
      // conversation-to-result chain is reconstructible under one correlation.
      // ======================================================================
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);

      expect(types).toContain('case.intake.work_order_proposed');
      expect(types).toContain('case.intake.work_order_confirmed');
      expect(types).toContain('case.created');
      expect(types).toContain('case.light_one_click.started');
      expect(types).toContain('node.result_accepted');
      expect(types).toContain('artifact.linked_to_case');
      expect(types).toContain('case.closed');

      // The idempotent retry of light-start emitted NO second
      // 'case.light_one_click.started' event.
      expect(types.filter((t) => t === 'case.light_one_click.started').length).toBe(1);
      // And no second Case/Run binding/plan-published fact from either
      // the intake propose (which never emits case.created at all) or the
      // retried one-click.
      expect(types.filter((t) => t === 'case.created').length).toBe(1);

      const correlationIds = new Set(outbox.map((r) => r.correlation_id));
      expect([...correlationIds]).toEqual([correlationId]);

      await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_node_result_acceptances WHERE case_id = $1`, [caseId]);
      // lightOneClickService.createNodeRun writes case_workspace_node_runs,
      // a table ContractFixtures.teardown() does not know about (it predates
      // the LIGHT one-click packet) — its FK on run_id blocks teardown's own
      // case_workspace_run_bindings delete if left in place.
      await control.query(`DELETE FROM case_workspace_node_runs WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_case_intake_confirmations WHERE case_id = $1`, [
        caseId,
      ]).catch(() => undefined);
      void linkId;
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
