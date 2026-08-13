/**
 * GOLDEN CASE C — a durable wait that expires, and everything that must NOT
 * happen when it does.
 *
 *   Case → Plan → Run → HUMAN wait (overdue) → scheduler expires it
 *        → the wait is EXPIRED and stays EXPIRED
 *        → a late satisfaction is refused
 *        → the Case is BLOCKED, not silently "running"
 *
 * The claims this pins:
 *
 *   CW-00-020-INV10 / CW-DOD-C5: a wait is durable runtime state that outlives
 *     any request. Nothing in this scenario holds a timer in memory — expiry is
 *     a row transition performed by a separate actor, later.
 *   CW-RT-021 / CW-CANON-11: **timer state is not approval state.** The
 *     expiring actor is `system:case-workspace-wait-scheduler`, and no
 *     approval/decision row is created anywhere by the expiry. This is asserted
 *     against `case_workspace_action_proposal_decisions` directly, because the
 *     failure mode being guarded against is a scheduler that "auto-approves" a
 *     step it gave up waiting for.
 *   SEC-028 / CW-RT-060: wait satisfaction is unique and final — a late or
 *     duplicate callback against an already-EXPIRED wait is refused with a
 *     stable 409 and does NOT reactivate it.
 *   CW-02-029: "Running" is forbidden for a step that is actually waiting; the
 *     Case's own status reflects the block.
 *
 * `expireWait` is invoked as the SCHEDULER invokes it — directly on the
 * service. It has no HTTP route by deliberate design (see
 * waitSubscriptions.routes.ts's header: claimTimerWait /
 * renewTimerWaitClaimLease / expireWait / listDueTimerWaitsForClaim are
 * internal scheduler-only), so calling it here is fidelity to production, not
 * a shortcut around the API.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as waitSubscriptionService from '../../waitSubscriptionService.js';
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
warnSkipped('Golden Case C (wait expiry)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

/** waitSubscriptionService.ts:399 — the literal token expireWait stamps. */
const SYSTEM_ACTOR_WAIT_SCHEDULER = 'system:case-workspace-wait-scheduler';

suite('GOLDEN CASE C — a durable wait expires; timer state never becomes approval state', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('expiry is durable, attributable to the scheduler, and refuses late satisfaction', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-c-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-c');
      const projectId = await fx.seedProject(orgId, 'golden-c');
      const consultantId = await fx.seedUser(orgId, 'golden-c-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');

      const app = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const as = (m: 'post' | 'get', url: string) =>
        request(app)[m](url).set('X-Correlation-ID', correlationId);

      // -- Case, plan, run ----------------------------------------------------
      const created = await as('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;
      await as('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' });

      const draft = await as('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
      });
      const planVersionId: string = draft.body.data.casePlanVersionId;
      const proposedPlan = await as('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      await as('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });

      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-c');
      const binding = await as('post', `${BASE}/run-bindings`).send({ runId, casePlanVersionId: planVersionId });
      expect(binding.status).toBe(201);

      // -- The wait -----------------------------------------------------------
      // Deadlines already in the past: this is the "simulated multi-day
      // interval" of CW-RT-062, expressed as data rather than as a sleep.
      const dueAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const timeoutAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const correlationKey = `client-input-${randomUUID()}`;

      const wait = await as('post', `${BASE}/cases/${caseId}/waits`).send({
        runId,
        waitType: 'HUMAN',
        correlationKey,
        dueAt,
        timeoutAt,
      });
      expect(wait.status).toBe(201);
      const waitId: string = wait.body.data.waitId;
      expect(wait.body.data.status).toBe('ACTIVE');
      expect(wait.body.data.caseId).toBe(caseId);
      expect(wait.body.data.runId).toBe(runId);

      // The waiting step blocks the Case — it is not reported as "running"
      // (CW-02-029).
      const blocked = await as('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'BLOCKED',
        reason: `awaiting client input (wait ${waitId})`,
      });
      expect(blocked.status).toBe(200);
      expect(blocked.body.data.caseStatus).toBe('BLOCKED');

      // The wait survives the request that created it: read it back through a
      // FRESH app instance (a new "process"), then out of band from Postgres.
      const freshApp = createGoldenCaseApp({
        organizationId: orgId,
        userId: consultantId,
        userRole: 'MEMBER',
        isSuperAdmin: false,
      });
      const reread = await request(freshApp).get(`${BASE}/waits/${waitId}`);
      expect(reread.status).toBe(200);
      expect(reread.body.data.status).toBe('ACTIVE');
      expect(reread.body.data.timeoutAt).toBeTruthy();

      const beforeExpiry = await control.query(
        `SELECT status, wait_type, due_at, timeout_at, version FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(beforeExpiry.rows[0].status).toBe('ACTIVE');
      expect(beforeExpiry.rows[0].wait_type).toBe('HUMAN');

      // -- The scheduler expires it ------------------------------------------
      const expired = await waitSubscriptionService.expireWait(waitId, reread.body.data.version);
      expect(expired.status).toBe('EXPIRED');

      const afterExpiry = await control.query(
        `SELECT status, satisfied_at, satisfied_by_event_id, claim_owner_token
           FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(afterExpiry.rows[0].status).toBe('EXPIRED');
      // Expiry is NOT satisfaction: nothing was marked as fulfilled.
      expect(afterExpiry.rows[0].satisfied_at).toBeNull();
      expect(afterExpiry.rows[0].satisfied_by_event_id).toBeNull();

      // -- A late satisfaction must be refused (SEC-028) ----------------------
      const lateResolve = await as('post', `${BASE}/waits/${waitId}/resolve`).send({
        satisfiedByEventId: `evt-late-${randomUUID()}`,
        expectedVersion: expired.version,
      });
      expect(lateResolve.status).toBe(409);
      expect(lateResolve.body.error.code).toBe('WAIT_STATUS_TRANSITION_NOT_ALLOWED');

      const lateHumanInput = await as('post', `${BASE}/waits/${waitId}/human-input`).send({
        inputRef: `input://late-${randomUUID()}`,
        expectedVersion: expired.version,
      });
      expect(lateHumanInput.status).toBe(409);

      // Neither refusal reactivated it.
      const stillExpired = await control.query(
        `SELECT status, satisfied_at FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(stillExpired.rows[0].status).toBe('EXPIRED');
      expect(stillExpired.rows[0].satisfied_at).toBeNull();

      // -- TIMER STATE IS NOT APPROVAL STATE (CW-RT-021) ----------------------
      // The whole point: giving up on a wait must never look like an approval.
      const decisions = await control.query(
        `SELECT decision_id FROM case_workspace_action_proposal_decisions
          WHERE action_proposal_id IN (
            SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1
          )`,
        [caseId]
      );
      expect(decisions.rowCount).toBe(0);
      const proposals = await control.query(
        `SELECT action_proposal_id FROM case_workspace_action_proposals WHERE case_id = $1`,
        [caseId]
      );
      expect(proposals.rowCount).toBe(0);

      // ---------------------------------------------------------------------
      // OUTBOX
      // ---------------------------------------------------------------------
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);

      expect(types).toContain('wait.registered');
      expect(types).toContain('wait.expired');
      // Expiry is not satisfaction, in the event stream too.
      expect(types).not.toContain('wait.satisfied');
      expect(types).not.toContain('approval.approved');

      const registered = outbox.find((r) => r.event_type === 'wait.registered');
      const expiredEvent = outbox.find((r) => r.event_type === 'wait.expired');
      expect(registered).toBeDefined();
      expect(expiredEvent).toBeDefined();

      // Registration is attributed to the human; expiry to the SCHEDULER.
      expect(registered!.actor_user_id).toBe(consultantId);
      expect(expiredEvent!.actor_user_id).toBe(SYSTEM_ACTOR_WAIT_SCHEDULER);
      expect(expiredEvent!.actor_user_id.startsWith('system:')).toBe(true);

      // Both events point at the same wait, Case and run — the correlation
      // chain an operator follows.
      expect(registered!.aggregate_id).toBe(waitId);
      expect(expiredEvent!.aggregate_id).toBe(waitId);
      expect(expiredEvent!.case_id).toBe(caseId);
      expect(expiredEvent!.run_id).toBe(runId);
      // Monotonic aggregate version across the wait's own lifecycle (SEC-025).
      expect(Number(expiredEvent!.aggregate_version)).toBeGreaterThan(
        Number(registered!.aggregate_version)
      );

      // The scheduler runs OUTSIDE the request scope, so it does not inherit
      // the client's correlation id — it mints its own, and the chain is
      // followed through aggregate_id/case_id/run_id instead. Asserted rather
      // than assumed, because a test that demanded one id here would be
      // asserting something production does not do.
      expect(expiredEvent!.correlation_id).toBeTruthy();
      expect(registered!.correlation_id).toBe(correlationId);

      await control.query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId]);
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
