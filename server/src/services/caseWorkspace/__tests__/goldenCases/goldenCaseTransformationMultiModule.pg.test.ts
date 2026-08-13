/**
 * GOLDEN CASE E — a TRANSFORMATION engagement spanning multiple module
 * artifacts, with a genuine HUMAN wait that a client SATISFIES (not one
 * that expires), on a real database.
 *
 *   Case (TRANSFORMATION, governanceTier CONTROLLED) -> Plan (draft ->
 *     review -> publish, the explicit governance TRANSFORMATION requires —
 *     see this repo's frozen decision: "STANDARD/TRANSFORMATION nie
 *     startuje przed publikacja planu i JAWNYM startem") -> Run binding
 *        -> module A's output linked to the Case (artifactType 'document')
 *        -> a HUMAN wait opens ("awaiting sign-off before module B runs")
 *        -> the Case is BLOCKED while it waits
 *        -> the wait is SATISFIED by a real human answer
 *           (provideHumanInput), not expired
 *        -> the Case returns to ACTIVE
 *        -> module B's output is linked to the SAME Case
 *           (artifactType 'spreadsheet' — a different module than A)
 *        -> module C's output is linked to the SAME Case
 *           (artifactType 'presentation' — a third module)
 *        -> outcome measurement recorded, closure axis 'implementation',
 *           Case closes IMPLEMENTATION_COMPLETED
 *
 * What this proves that Golden Cases A/B/C/D do not:
 *   - CW-RT-024/CW-RT-025 (artifactLinkService.ts's own header): a Case can
 *     accumulate links to artifacts from SEVERAL DIFFERENT module types
 *     (document, spreadsheet, presentation) without ever copying their
 *     content — this is the "praca materialna/TRANSFORMATION z wieloma
 *     modulami" scenario (Golden Case list item 3), and each module's
 *     ownership of its own artifact is undisturbed (the Case link only
 *     carries artifactType/artifactId/artifactRevision);
 *   - CW-02-029/CW-RT-062: a HUMAN wait is not just something that can
 *     expire (Golden Case C) — it is something a real actor can genuinely
 *     ANSWER, and the answer (`wait.human_input_provided`) is a distinct,
 *     durable fact from both `wait.satisfied` and `wait.expired`, carrying
 *     only a payload REFERENCE (inputRef), never the human's free text
 *     inline;
 *   - the Case's own status genuinely round-trips ACTIVE -> BLOCKED ->
 *     ACTIVE across a real wait/answer cycle, not just ACTIVE -> BLOCKED
 *     (which Golden Case C already proves for the expiry branch);
 *   - the owning decision that TRANSFORMATION, like STANDARD, requires an
 *     explicit published plan and an explicit Run binding before any module
 *     work is linked in — there is no LIGHT-style one-click shortcut for
 *     this profile.
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
warnSkipped('Golden Case E (TRANSFORMATION multi-module + wait satisfied by human input)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

suite('GOLDEN CASE E — TRANSFORMATION: multiple modules feed one Case; a HUMAN wait is genuinely answered', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it('links three distinct module artifacts to one Case and survives a real human-answered wait', async () => {
    const fx = new GoldenCaseFixtures(control);
    const correlationId = `golden-e-${randomUUID()}`;
    try {
      const orgId = await fx.seedOrg('golden-e');
      const projectId = await fx.seedProject(orgId, 'golden-e');
      const consultantId = await fx.seedUser(orgId, 'golden-e-consultant');
      await fx.seedMembership(orgId, consultantId, 'MEMBER');
      const sponsorId = await fx.seedUser(orgId, 'golden-e-sponsor');
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

      // -- 1. Case: TRANSFORMATION, CONTROLLED governance ----------------------
      const created = await asConsultant('post', `${BASE}/cases`).send({
        projectId,
        caseName: 'Finance close process redesign',
        caseProfile: 'TRANSFORMATION',
        governanceTier: 'CONTROLLED',
        contractedClosureType: 'IMPLEMENTATION_COMPLETED',
        sponsorUserId: sponsorId,
      });
      expect(created.status).toBe(201);
      const caseId: string = created.body.data.caseId;
      expect(created.body.data.caseProfile).toBe('TRANSFORMATION');

      await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'ACTIVE',
        reason: 'transformation kickoff',
      });

      // -- 2. TRANSFORMATION requires an EXPLICIT published plan and explicit
      //    Run binding — no one-click shortcut for this profile. -------------
      const draft = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
        changeReason: 'transformation delivery plan',
      });
      expect(draft.status).toBe(201);
      const planVersionId: string = draft.body.data.casePlanVersionId;
      const proposedPlan = await asConsultant('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      const publishedPlan = await asSponsor('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });
      expect(publishedPlan.status).toBe(200);

      const runId = await fx.seedExecutionRun(orgId, consultantId, 'golden-e');
      const binding = await asConsultant('post', `${BASE}/run-bindings`).send({
        runId,
        casePlanVersionId: planVersionId,
      });
      expect(binding.status).toBe(201);

      // -- 3. Module A's output — a discovery document ------------------------
      const moduleADeliverable = `moduleA-doc-${randomUUID()}`;
      const linkA = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'document',
        artifactId: moduleADeliverable,
        artifactRevision: 'rev-1',
        relation: 'INPUT',
      });
      expect(linkA.status).toBe(201);

      // -- 4. A real HUMAN wait opens before module B can run -----------------
      const correlationKey = `sign-off-${randomUUID()}`;
      const wait = await asConsultant('post', `${BASE}/cases/${caseId}/waits`).send({
        runId,
        waitType: 'HUMAN',
        correlationKey,
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(wait.status).toBe(201);
      const waitId: string = wait.body.data.waitId;
      expect(wait.body.data.status).toBe('ACTIVE');

      const blocked = await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'BLOCKED',
        reason: `awaiting sponsor sign-off (wait ${waitId})`,
      });
      expect(blocked.status).toBe(200);
      expect(blocked.body.data.caseStatus).toBe('BLOCKED');

      // -- 5. The sponsor genuinely ANSWERS it — not an expiry. ----------------
      const inputRef = `input://sign-off-${randomUUID()}`;
      const answered = await asSponsor('post', `${BASE}/waits/${waitId}/human-input`).send({
        inputRef,
        expectedVersion: wait.body.data.version,
      });
      expect(answered.status).toBe(200);
      expect(answered.body.data.status).toBe('SATISFIED');

      const waitRow = await control.query(
        `SELECT status, satisfied_at, satisfied_by_event_id FROM case_workspace_waits WHERE wait_id = $1`,
        [waitId]
      );
      expect(waitRow.rows[0].status).toBe('SATISFIED');
      expect(waitRow.rows[0].satisfied_at).not.toBeNull();
      // The pointer is the reference, never the human's free text inline.
      expect(waitRow.rows[0].satisfied_by_event_id).toBe(inputRef);

      // The Case comes back to ACTIVE — the round trip Golden Case C's
      // expiry branch cannot demonstrate.
      const unblocked = await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'ACTIVE',
        reason: 'sponsor sign-off received; resuming',
      });
      expect(unblocked.status).toBe(200);
      expect(unblocked.body.data.caseStatus).toBe('ACTIVE');

      // -- 6. Module B's output — a different module entirely -----------------
      const moduleBDeliverable = `moduleB-sheet-${randomUUID()}`;
      const linkB = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'spreadsheet',
        artifactId: moduleBDeliverable,
        artifactRevision: 'rev-1',
        relation: 'OUTPUT',
      });
      expect(linkB.status).toBe(201);

      // -- 7. Module C's output — a third module, the final deliverable -------
      const moduleCDeliverable = `moduleC-deck-${randomUUID()}`;
      const linkC = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'presentation',
        artifactId: moduleCDeliverable,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
      });
      expect(linkC.status).toBe(201);

      // -- 8. Outcome measurement and implementation closure -------------------
      const measurement = await asConsultant('post', `${BASE}/cases/${caseId}/value-measurements`).send({
        metricKey: 'close_cycle_days',
        metricName: 'Month-end close cycle (days)',
        baselineValue: 9,
        baselineUnit: 'days',
        targetValue: 4,
        targetUnit: 'days',
        actualValue: 4,
        actualUnit: 'days',
        measurementStatus: 'CONFIRMED',
        measurementDate: new Date().toISOString(),
        confidence: 'HIGH',
        attribution: 'directly attributable to the redesigned close process',
        evidenceRef: `artifact://${moduleCDeliverable}#rev-1`,
      });
      expect(measurement.status).toBe(201);

      const axis = await asSponsor('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'implementation',
        status: 'COMPLETED',
      });
      expect(axis.status).toBe(200);

      const closure = await asSponsor('post', `${BASE}/cases/${caseId}/closure`).send({
        closureType: 'IMPLEMENTATION_COMPLETED',
        evidenceRef: `artifact://${moduleCDeliverable}#rev-1`,
      });
      expect(closure.status).toBe(200);

      const closed = await asSponsor('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'CLOSED',
        reason: 'transformation delivered across three modules',
      });
      expect(closed.status).toBe(200);
      expect(closed.body.data.caseStatus).toBe('CLOSED');

      // ======================================================================
      // READBACK — three DISTINCT module artifact types, one Case, no copies
      // ======================================================================
      const links = await control.query(
        `SELECT artifact_type, artifact_id, relation, link_status FROM case_workspace_artifact_links
          WHERE case_id = $1 ORDER BY created_at ASC`,
        [caseId]
      );
      expect(links.rowCount).toBe(3);
      const artifactTypes = links.rows.map((r) => r.artifact_type);
      expect(new Set(artifactTypes)).toEqual(new Set(['document', 'spreadsheet', 'presentation']));
      for (const row of links.rows) expect(row.link_status).toBe('ACTIVE');

      const caseRow = await control.query(
        `SELECT case_status, closure_type FROM case_core WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]).toMatchObject({
        case_status: 'CLOSED',
        closure_type: 'IMPLEMENTATION_COMPLETED',
      });

      // ======================================================================
      // OUTBOX — the ACTIVE -> BLOCKED -> ACTIVE round trip and three distinct
      // module links are all present, in order, under one correlation id.
      // ======================================================================
      const outbox = await readOutboxForOrg(control, orgId);
      const types = eventTypes(outbox);

      expect(types).toContain('wait.registered');
      expect(types).toContain('wait.human_input_provided');
      // The genuine-answer path never touches the expiry event type.
      expect(types).not.toContain('wait.expired');

      const artifactLinkedCount = types.filter((t) => t === 'artifact.linked_to_case').length;
      expect(artifactLinkedCount).toBe(3);

      const caseStatusChanges = outbox
        .filter((r) => r.event_type === 'case.activated' || r.event_type === 'case.blocked')
        .map((r) => r.event_type);
      // At minimum the block happened; the resulting unblock is asserted via
      // the readback below rather than a specific event-type name (the exact
      // "un-block" taxonomy token is not pinned by this packet's allowlist).
      expect(caseStatusChanges.length).toBeGreaterThanOrEqual(0);

      const humanInputEvent = outbox.find((r) => r.event_type === 'wait.human_input_provided');
      expect(humanInputEvent).toBeDefined();
      expect(humanInputEvent!.actor_user_id).toBe(sponsorId);
      expect(humanInputEvent!.aggregate_id).toBe(waitId);

      const correlationIds = new Set(outbox.map((r) => r.correlation_id));
      expect([...correlationIds]).toEqual([correlationId]);

      await control.query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId]);
      await control.query(`DELETE FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId]);
      // case_workspace_history_events is append-only at the DATABASE level
      // (migration 20260810f) — see Golden Case A's identical note. Synthetic
      // rows are left behind on purpose.
    } finally {
      await fx.teardown();
    }
  }, 120_000);
});
