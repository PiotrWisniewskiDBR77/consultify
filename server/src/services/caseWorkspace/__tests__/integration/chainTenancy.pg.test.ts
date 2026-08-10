/**
 * INTEGRATION GATE — tenancy and standing, swept across the WHOLE chain.
 *
 * ===========================================================================
 * WHY A SWEEP AND NOT MORE PER-FUNCTION TESTS
 * ===========================================================================
 * `../security/*.security.pg.test.ts` proves individual functions fail closed.
 * A chain, though, is only as strong as the ONE step that forgot its guard: an
 * attacker does not need `createCase` to leak, they need any single reachable
 * mutation on someone else's Case. So this suite does not pick a step — it
 * drives EVERY step of the business chain with the wrong actor and asserts the
 * whole surface, then proves the tenant's state and event stream are untouched.
 *
 * Two attacks, both on the full chain:
 *
 *   ATTACK 1 — FOREIGN TENANT. An ACTIVE, legitimate member of organization B
 *   (a real user with a real session, not an anonymous caller) points every
 *   case-scoped command and query at organization A's real identifiers. Every
 *   one must fail closed, and — the part a per-function test cannot show —
 *   organization A's rows and outbox must be BYTE-IDENTICAL afterwards, and no
 *   outbox row anywhere may name the foreign actor.
 *
 *   ATTACK 2 — REVOCATION MID-CHAIN. An actor with genuine standing walks the
 *   first half of the chain, their membership is then revoked, and they
 *   continue. "Fail closed on revocation" is only meaningful if the same
 *   commands worked a moment earlier, so each denial after revocation is
 *   paired with a NEGATIVE CONTROL: a still-active colleague performs the very
 *   same step and succeeds. Without that control, a suite where everything is
 *   refused would look identical to a correct one.
 *
 * ---------------------------------------------------------------------------
 * EXPECTED DENIAL SHAPE
 * ---------------------------------------------------------------------------
 * `case_access_denied` maps to 404, never 403 (routes/caseWorkspace/_shared/
 * errors.ts) so a caseId cannot be probed for existence; `not_org_member`
 * maps to 403. Both are accepted here, and 5xx is explicitly NOT: a guard that
 * "protects" by crashing is a different defect wearing a denial's clothes.
 *
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
  GoldenCaseFixtures,
  isGoldenCaseDbReachable,
  minimalGraph,
  readOutboxForOrg,
  warnSkipped,
} from '../goldenCases/goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('INTEGRATION GATE (cross-tenant + revoked membership, full chain)', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

/** A denial: fail-closed 4xx, never a 2xx and never a 5xx. */
function expectDenied(label: string, res: { status: number; body: any }): void {
  const detail = `${label} -> ${res.status} ${JSON.stringify(res.body?.error ?? res.body ?? {}).slice(0, 200)}`;
  expect({ step: label, denied: res.status >= 400 && res.status < 500, detail }).toEqual({
    step: label,
    denied: true,
    detail,
  });
}

suite('INTEGRATION GATE — cross-tenant and revoked membership across the whole chain', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // =========================================================================
  // ATTACK 1 — a legitimate member of another tenant drives the whole chain
  // =========================================================================
  it('an ACTIVE member of another organization cannot pass ANY step of the chain', async () => {
    const fx = new GoldenCaseFixtures(control);
    let caseId = '';
    let actionProposalId = '';
    try {
      // -- Tenant A: a real, half-built engagement ----------------------------
      const orgA = await fx.seedOrg('tenancy-a');
      const projectA = await fx.seedProject(orgA, 'tenancy-a');
      const ownerA = await fx.seedUser(orgA, 'tenancy-a-owner');
      await fx.seedMembership(orgA, ownerA, 'ADMIN');
      const memberA = await fx.seedUser(orgA, 'tenancy-a-member');
      await fx.seedMembership(orgA, memberA, 'MEMBER');

      // -- Tenant B: the attacker, fully legitimate INSIDE ITS OWN ORG --------
      const orgB = await fx.seedOrg('tenancy-b');
      await fx.seedProject(orgB, 'tenancy-b');
      const intruder = await fx.seedUser(orgB, 'tenancy-b-intruder');
      await fx.seedMembership(orgB, intruder, 'OWNER'); // highest role in the WRONG org

      const asA = (userId: string, role: string) => {
        const app = createGoldenCaseApp({
          organizationId: orgA,
          userId,
          userRole: role,
          isSuperAdmin: false,
        });
        return (m: 'post' | 'get' | 'put', url: string) => request(app)[m](url);
      };
      // The intruder's session is honest: it carries THEIR org (orgB) and THEIR
      // user id. Only the ids in the URL/body point at tenant A. That is the
      // realistic attack — a forged organizationId in the session would be
      // testing the auth middleware, not this module.
      const intruderApp = createGoldenCaseApp({
        organizationId: orgB,
        userId: intruder,
        userRole: 'OWNER',
        isSuperAdmin: false,
      });
      const asIntruder = (m: 'post' | 'get' | 'put', url: string) => request(intruderApp)[m](url);

      const memberACall = asA(memberA, 'MEMBER');
      const ownerACall = asA(ownerA, 'ADMIN');

      // Build tenant A's chain up to an approved, executed proposal.
      const created = await memberACall('post', `${BASE}/cases`).send({
        projectId: projectA,
        caseProfile: 'STANDARD',
        governanceTier: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
        sponsorUserId: ownerA,
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;
      const activated = await memberACall('post', `${BASE}/cases/${caseId}/status`).send({
        targetStatus: 'ACTIVE',
      });
      expect(activated.status).toBe(200);

      const draft = await memberACall('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
        changeReason: 'plan',
      });
      expect(draft.status).toBe(201);
      const planVersionId: string = draft.body.data.casePlanVersionId;
      const proposedPlan = await memberACall('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      expect(proposedPlan.status).toBe(200);
      const publishedPlan = await ownerACall('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });
      expect(publishedPlan.status).toBe(200);

      const runId = await fx.seedExecutionRun(orgA, memberA, 'tenancy-a');
      const binding = await memberACall('post', `${BASE}/run-bindings`).send({
        runId,
        casePlanVersionId: planVersionId,
      });
      expect(binding.status).toBe(201);

      const nodeRunId = `noderun-${randomUUID()}`;
      const acceptance = await memberACall('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
        nodeRunId,
        nodeType: 'CAPABILITY',
        nodeCompletionState: 'COMPLETED',
        resultAcceptance: 'ACCEPTED',
        acceptanceInputSnapshot: { summary: 'ok' },
        occurredAt: new Date().toISOString(),
      });
      expect(acceptance.status).toBe(201);

      const payloadDigest = `sha256:${'c'.repeat(64)}`;
      const proposal = await memberACall('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `tenancy-proposal-${randomUUID()}`)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest,
          policySnapshotRef: 'policy://standard/v1',
          effectClass: 'SAFE_ADDITIVE',
          previewRef: 'preview://tenancy',
          proposerType: 'HUMAN',
        });
      expect(proposal.status).toBe(201);
      actionProposalId = proposal.body.data.actionProposalId;
      const submitted = await memberACall(
        'post',
        `${BASE}/proposals/${actionProposalId}/submit-for-review`
      ).send({ expectedVersion: proposal.body.data.version });
      expect(submitted.status).toBe(200);

      const waitRes = await memberACall('post', `${BASE}/cases/${caseId}/waits`)
        .set('Idempotency-Key', `tenancy-wait-${randomUUID()}`)
        .send({ runId, actionProposalId, waitType: 'DOMAIN_EVENT', expectedEventType: 'approval.approved' });
      expect(waitRes.status).toBe(201);
      const waitId: string = waitRes.body.data.waitId;

      const linkRes = await memberACall('post', `${BASE}/cases/${caseId}/artifact-links`).send({
        artifactType: 'document',
        artifactId: `deliverable-${randomUUID()}`,
        artifactRevision: 'rev-1',
        relation: 'DELIVERABLE',
      });
      expect(linkRes.status).toBe(201);
      const linkId: string = linkRes.body.data.linkId;

      // -- SNAPSHOT tenant A before the sweep ---------------------------------
      const snapshot = async () => ({
        caseRow: (await control.query(`SELECT * FROM case_core WHERE case_id = $1`, [caseId])).rows[0],
        planRows: (
          await control.query(
            `SELECT * FROM case_plan_versions WHERE case_id = $1 ORDER BY case_plan_version_id`,
            [caseId]
          )
        ).rows,
        proposalRows: (
          await control.query(
            `SELECT * FROM case_workspace_action_proposals WHERE case_id = $1 ORDER BY action_proposal_id`,
            [caseId]
          )
        ).rows,
        decisionRows: (
          await control.query(
            `SELECT * FROM case_workspace_action_proposal_decisions WHERE action_proposal_id = $1`,
            [actionProposalId]
          )
        ).rows,
        waitRows: (
          await control.query(`SELECT * FROM case_workspace_waits WHERE case_id = $1 ORDER BY wait_id`, [
            caseId,
          ])
        ).rows,
        linkRows: (
          await control.query(
            `SELECT * FROM case_workspace_artifact_links WHERE case_id = $1 ORDER BY link_id`,
            [caseId]
          )
        ).rows,
        measurementRows: (
          await control.query(`SELECT * FROM case_workspace_value_measurements WHERE case_id = $1`, [caseId])
        ).rows,
        outbox: await readOutboxForOrg(control, orgA),
      });
      const before = await snapshot();
      expect(before.outbox.length).toBeGreaterThan(0);

      // -- THE SWEEP: every step of the chain, wrong tenant --------------------
      const attempts: Array<[string, Promise<any>]> = [
        // reads
        ['GET /cases/:id', asIntruder('get', `${BASE}/cases/${caseId}`)],
        ['GET /cases/by-project/:projectId', asIntruder('get', `${BASE}/cases/by-project/${projectA}`)],
        ['GET /cases/:id/plan-versions', asIntruder('get', `${BASE}/cases/${caseId}/plan-versions`)],
        ['GET /plan-versions/:id', asIntruder('get', `${BASE}/plan-versions/${planVersionId}`)],
        ['GET /plan-versions/:id/graph', asIntruder('get', `${BASE}/plan-versions/${planVersionId}/graph`)],
        ['GET /run-bindings/:runId', asIntruder('get', `${BASE}/run-bindings/${runId}`)],
        ['GET /cases/:id/proposals', asIntruder('get', `${BASE}/cases/${caseId}/proposals`)],
        ['GET /proposals/:id', asIntruder('get', `${BASE}/proposals/${actionProposalId}`)],
        ['GET /waits/:id', asIntruder('get', `${BASE}/waits/${waitId}`)],
        ['GET /cases/:id/waits', asIntruder('get', `${BASE}/cases/${caseId}/waits`)],
        ['GET /cases/:id/artifact-links', asIntruder('get', `${BASE}/cases/${caseId}/artifact-links`)],
        ['GET /cases/:id/history-events', asIntruder('get', `${BASE}/cases/${caseId}/history-events`)],
        [
          'GET /cases/:id/value-measurements',
          asIntruder('get', `${BASE}/cases/${caseId}/value-measurements`),
        ],
        // Case-level mutations
        [
          'POST /cases/:id/status',
          asIntruder('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'BLOCKED' }),
        ],
        [
          'POST /cases/:id/governance-tier',
          asIntruder('post', `${BASE}/cases/${caseId}/governance-tier`).send({
            tier: 'LIGHTWEIGHT',
            reason: 'downgrade',
          }),
        ],
        [
          'POST /cases/:id/autonomy-policy',
          asIntruder('post', `${BASE}/cases/${caseId}/autonomy-policy`).send({
            policy: 'EXECUTE_APPROVED_PLAN',
          }),
        ],
        [
          'POST /cases/:id/cancel',
          asIntruder('post', `${BASE}/cases/${caseId}/cancel`).send({ reason: 'hostile cancel' }),
        ],
        [
          'POST /cases/:id/closure-axis',
          asIntruder('post', `${BASE}/cases/${caseId}/closure-axis`).send({
            axis: 'delivery',
            status: 'COMPLETED',
          }),
        ],
        [
          'POST /cases/:id/closure',
          asIntruder('post', `${BASE}/cases/${caseId}/closure`).send({
            closureType: 'DELIVERY_COMPLETED',
          }),
        ],
        // Plan mutations
        [
          'POST /cases/:id/plan-versions',
          asIntruder('post', `${BASE}/cases/${caseId}/plan-versions`).send({
            semanticGraph: minimalGraph(),
            changeReason: 'injected plan',
          }),
        ],
        [
          'PUT /plan-versions/:id',
          asIntruder('put', `${BASE}/plan-versions/${planVersionId}`).send({
            semanticGraph: minimalGraph(),
            expectedVersion: publishedPlan.body.data.version,
          }),
        ],
        [
          'PUT /plan-versions/:id/view-state',
          asIntruder('put', `${BASE}/plan-versions/${planVersionId}/view-state/SIMPLE`).send({
            viewState: { injected: true },
          }),
        ],
        [
          'POST /plan-versions/:id/withdraw',
          asIntruder('post', `${BASE}/plan-versions/${planVersionId}/withdraw`).send({
            reason: 'hostile withdraw',
            expectedVersion: publishedPlan.body.data.version,
          }),
        ],
        // Run mutations
        [
          'POST /run-bindings',
          asIntruder('post', `${BASE}/run-bindings`).send({
            runId: `injected-${randomUUID()}`,
            casePlanVersionId: planVersionId,
          }),
        ],
        [
          'POST /runs/:runId/node-result-acceptances',
          asIntruder('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
            nodeRunId: `noderun-${randomUUID()}`,
            nodeType: 'CAPABILITY',
            nodeCompletionState: 'COMPLETED',
            resultAcceptance: 'ACCEPTED',
            acceptanceInputSnapshot: {},
            occurredAt: new Date().toISOString(),
          }),
        ],
        // Proposal / approval — the highest-value target
        [
          'POST /cases/:id/proposals',
          asIntruder('post', `${BASE}/cases/${caseId}/proposals`)
            .set('Idempotency-Key', `intruder-${randomUUID()}`)
            .send({
              runId,
              nodeRunId,
              casePlanVersionId: planVersionId,
              payloadDigest: `sha256:${'d'.repeat(64)}`,
              policySnapshotRef: 'policy://standard/v1',
              effectClass: 'SAFE_ADDITIVE',
              previewRef: 'preview://intruder',
              proposerType: 'HUMAN',
            }),
        ],
        [
          'POST /proposals/:id/decision APPROVE',
          asIntruder('post', `${BASE}/proposals/${actionProposalId}/decision`)
            .set('Idempotency-Key', `intruder-approve-${randomUUID()}`)
            .send({
              proposalVersion: submitted.body.data.proposalVersion,
              payloadDigest,
              decision: 'APPROVE',
              source: 'BUTTON',
              authenticationAssurance: 'AAL2',
              approvalChannelPolicy: 'in-app',
              policyVersion: 'policy://standard/v1',
              expectedVersion: submitted.body.data.version,
            }),
        ],
        [
          'POST /proposals/:id/transition-to-executing',
          asIntruder('post', `${BASE}/proposals/${actionProposalId}/transition-to-executing`).send({
            expectedVersion: submitted.body.data.version,
          }),
        ],
        [
          'POST /proposals/:id/revoke',
          asIntruder('post', `${BASE}/proposals/${actionProposalId}/revoke`).send({
            reason: 'hostile revoke',
            expectedVersion: submitted.body.data.version,
          }),
        ],
        // Wait
        [
          'POST /cases/:id/waits',
          asIntruder('post', `${BASE}/cases/${caseId}/waits`)
            .set('Idempotency-Key', `intruder-wait-${randomUUID()}`)
            .send({ waitType: 'DOMAIN_EVENT', expectedEventType: 'x' }),
        ],
        [
          'POST /waits/:id/resolve',
          asIntruder('post', `${BASE}/waits/${waitId}/resolve`).send({
            satisfiedByEventId: `forged-${randomUUID()}`,
            expectedVersion: waitRes.body.data.version,
          }),
        ],
        [
          'POST /waits/:id/cancel',
          asIntruder('post', `${BASE}/waits/${waitId}/cancel`).send({
            reason: 'hostile cancel',
            expectedVersion: waitRes.body.data.version,
          }),
        ],
        // Results
        [
          'POST /cases/:id/artifact-links',
          asIntruder('post', `${BASE}/cases/${caseId}/artifact-links`).send({
            artifactType: 'document',
            artifactId: `injected-${randomUUID()}`,
            artifactRevision: 'rev-1',
            relation: 'DELIVERABLE',
          }),
        ],
        [
          'POST /artifact-links/:id/pin',
          asIntruder('post', `${BASE}/artifact-links/${linkId}/pin`).send({
            revision: 'rev-9',
            reason: 'hostile pin',
          }),
        ],
        [
          'POST /cases/:id/value-measurements',
          asIntruder('post', `${BASE}/cases/${caseId}/value-measurements`).send({
            metricKey: 'injected',
            metricName: 'Injected',
            measurementStatus: 'PARTIAL',
            measurementDate: new Date().toISOString(),
            confidence: 'LOW',
            attribution: 'injected',
          }),
        ],
        [
          'POST /cases/:id/history-events',
          asIntruder('post', `${BASE}/cases/${caseId}/history-events`).send({
            eventType: 'INJECTED',
            occurredAt: new Date().toISOString(),
            summary: 'injected history',
          }),
        ],
      ];

      const results = await Promise.all(attempts.map(async ([label, p]) => [label, await p] as const));
      for (const [label, res] of results) expectDenied(`cross-tenant ${label}`, res);

      // Not one of them may have been a 5xx (a crash is not a control).
      const crashed = results.filter(([, r]) => r.status >= 500).map(([l]) => l);
      expect({ crashedInsteadOfDenied: crashed }).toEqual({ crashedInsteadOfDenied: [] });

      // -- Tenant A is untouched ---------------------------------------------
      const after = await snapshot();
      expect(after.caseRow).toEqual(before.caseRow);
      expect(after.planRows).toEqual(before.planRows);
      expect(after.proposalRows).toEqual(before.proposalRows);
      expect(after.decisionRows).toEqual(before.decisionRows);
      expect(after.waitRows).toEqual(before.waitRows);
      expect(after.linkRows).toEqual(before.linkRows);
      expect(after.measurementRows).toEqual(before.measurementRows);
      expect(after.outbox.map((r) => r.event_id)).toEqual(before.outbox.map((r) => r.event_id));

      // The refused commands left no fact behind in EITHER tenant's stream.
      const intruderTrace = await control.query(
        `SELECT event_type FROM case_workspace_event_outbox WHERE actor_user_id = $1`,
        [intruder]
      );
      expect(intruderTrace.rows.map((r) => r.event_type)).toEqual([]);
      const orgBOutbox = await readOutboxForOrg(control, orgB);
      expect(orgBOutbox).toEqual([]);

      // NEGATIVE CONTROL: the same commands are not impossible — a legitimate
      // member of tenant A performs one of the refused steps successfully, so
      // the sweep above measured tenancy, not a broken endpoint.
      const legit = await ownerACall('post', `${BASE}/cases/${caseId}/closure-axis`).send({
        axis: 'delivery',
        status: 'PENDING',
      });
      expect(legit.status).toBe(200);
    } finally {
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
  }, 180_000);

  // =========================================================================
  // ATTACK 2 — membership revoked HALFWAY through the chain
  // =========================================================================
  it('revoking membership mid-chain blocks every remaining step, while an active colleague still passes', async () => {
    const fx = new GoldenCaseFixtures(control);
    let caseId = '';
    let actionProposalId = '';
    try {
      const orgId = await fx.seedOrg('revoke-mid');
      const projectId = await fx.seedProject(orgId, 'revoke-mid');
      const doomed = await fx.seedUser(orgId, 'revoke-mid-doomed');
      await fx.seedMembership(orgId, doomed, 'MEMBER');
      const colleague = await fx.seedUser(orgId, 'revoke-mid-colleague');
      await fx.seedMembership(orgId, colleague, 'ADMIN');

      const call = (userId: string, role: string) => {
        const app = createGoldenCaseApp({
          organizationId: orgId,
          userId,
          userRole: role,
          isSuperAdmin: false,
        });
        return (m: 'post' | 'get' | 'put', url: string) => request(app)[m](url);
      };
      const asDoomed = call(doomed, 'MEMBER');
      const asColleague = call(colleague, 'ADMIN');

      // -- FIRST HALF, with genuine standing ----------------------------------
      const created = await asDoomed('post', `${BASE}/cases`).send({
        projectId,
        caseProfile: 'STANDARD',
        governanceTier: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      expect((await asDoomed('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' })).status).toBe(
        200
      );

      const draft = await asDoomed('post', `${BASE}/cases/${caseId}/plan-versions`).send({
        semanticGraph: minimalGraph(),
        changeReason: 'plan',
      });
      expect(draft.status).toBe(201);
      const planVersionId: string = draft.body.data.casePlanVersionId;
      const proposedPlan = await asDoomed('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
        expectedVersion: draft.body.data.version,
      });
      expect(proposedPlan.status).toBe(200);
      const publishedPlan = await asColleague('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
        expectedVersion: proposedPlan.body.data.version,
      });
      expect(publishedPlan.status).toBe(200);

      const runId = await fx.seedExecutionRun(orgId, doomed, 'revoke-mid');
      expect(
        (await asDoomed('post', `${BASE}/run-bindings`).send({ runId, casePlanVersionId: planVersionId })).status
      ).toBe(201);

      const nodeRunId = `noderun-${randomUUID()}`;
      expect(
        (
          await asDoomed('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
            nodeRunId,
            nodeType: 'CAPABILITY',
            nodeCompletionState: 'COMPLETED',
            resultAcceptance: 'ACCEPTED',
            acceptanceInputSnapshot: {},
            occurredAt: new Date().toISOString(),
          })
        ).status
      ).toBe(201);

      const payloadDigest = `sha256:${'e'.repeat(64)}`;
      const proposal = await asDoomed('post', `${BASE}/cases/${caseId}/proposals`)
        .set('Idempotency-Key', `revoke-proposal-${randomUUID()}`)
        .send({
          runId,
          nodeRunId,
          casePlanVersionId: planVersionId,
          payloadDigest,
          policySnapshotRef: 'policy://standard/v1',
          effectClass: 'SAFE_ADDITIVE',
          previewRef: 'preview://revoke-mid',
          proposerType: 'HUMAN',
        });
      expect(proposal.status).toBe(201);
      actionProposalId = proposal.body.data.actionProposalId;
      const submitted = await asDoomed('post', `${BASE}/proposals/${actionProposalId}/submit-for-review`).send({
        expectedVersion: proposal.body.data.version,
      });
      expect(submitted.status).toBe(200);

      const approved = await asColleague('post', `${BASE}/proposals/${actionProposalId}/decision`)
        .set('Idempotency-Key', `revoke-approve-${randomUUID()}`)
        .send({
          proposalVersion: submitted.body.data.proposalVersion,
          payloadDigest,
          decision: 'APPROVE',
          source: 'BUTTON',
          authenticationAssurance: 'AAL2',
          approvalChannelPolicy: 'in-app',
          policyVersion: 'policy://standard/v1',
          expectedVersion: submitted.body.data.version,
        });
      expect(approved.status).toBe(200);
      const approvedProposalVersion: number = approved.body.data.proposal.version;

      // -- THE REVOCATION -----------------------------------------------------
      const revoked = await control.query(
        `UPDATE organization_members SET status = 'ACTIVE'
          WHERE organization_id = $1 AND user_id = $2 RETURNING id`,
        [orgId, doomed]
      );
      expect(revoked.rowCount).toBe(1);

      const outboxBefore = await readOutboxForOrg(control, orgId);
      const caseBefore = (await control.query(`SELECT * FROM case_core WHERE case_id = $1`, [caseId])).rows[0];
      const proposalBefore = (
        await control.query(
          `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
          [actionProposalId]
        )
      ).rows[0];

      // -- SECOND HALF, with standing gone ------------------------------------
      // SEC-004: authority is checked at the moment of EXECUTION, not only at
      // approval time. `transition-to-executing` is the step that matters most
      // here — the proposal is already APPROVED, so nothing but the revocation
      // can stop it.
      const afterRevocation: Array<[string, Promise<any>]> = [
        ['GET /cases/:id', asDoomed('get', `${BASE}/cases/${caseId}`)],
        [
          'POST /proposals/:id/transition-to-executing',
          asDoomed('post', `${BASE}/proposals/${actionProposalId}/transition-to-executing`).send({
            expectedVersion: approvedProposalVersion,
          }),
        ],
        [
          'POST /cases/:id/plan-versions',
          asDoomed('post', `${BASE}/cases/${caseId}/plan-versions`).send({
            semanticGraph: minimalGraph(),
            changeReason: 'post-revocation plan',
          }),
        ],
        [
          'POST /cases/:id/waits',
          asDoomed('post', `${BASE}/cases/${caseId}/waits`)
            .set('Idempotency-Key', `revoked-wait-${randomUUID()}`)
            .send({ waitType: 'DOMAIN_EVENT', expectedEventType: 'x' }),
        ],
        [
          'POST /cases/:id/artifact-links',
          asDoomed('post', `${BASE}/cases/${caseId}/artifact-links`).send({
            artifactType: 'document',
            artifactId: `post-revocation-${randomUUID()}`,
            artifactRevision: 'rev-1',
            relation: 'DELIVERABLE',
          }),
        ],
        [
          'POST /cases/:id/value-measurements',
          asDoomed('post', `${BASE}/cases/${caseId}/value-measurements`).send({
            metricKey: 'post_revocation',
            metricName: 'Post revocation',
            measurementStatus: 'PARTIAL',
            measurementDate: new Date().toISOString(),
            confidence: 'LOW',
            attribution: 'post revocation',
          }),
        ],
        [
          'POST /cases/:id/closure-axis',
          asDoomed('post', `${BASE}/cases/${caseId}/closure-axis`).send({
            axis: 'delivery',
            status: 'COMPLETED',
          }),
        ],
        [
          'POST /cases/:id/closure',
          asDoomed('post', `${BASE}/cases/${caseId}/closure`).send({ closureType: 'DELIVERY_COMPLETED' }),
        ],
        [
          'POST /cases/:id/status CLOSED',
          asDoomed('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'CLOSED' }),
        ],
        // A brand-new Case in the org they were removed from.
        [
          'POST /cases (new)',
          asDoomed('post', `${BASE}/cases`).send({
            projectId: `${projectId}-second`,
            contractedClosureType: 'DELIVERY_COMPLETED',
          }),
        ],
      ];

      const revokedResults = await Promise.all(
        afterRevocation.map(async ([label, p]) => [label, await p] as const)
      );
      for (const [label, res] of revokedResults) expectDenied(`post-revocation ${label}`, res);
      const crashed = revokedResults.filter(([, r]) => r.status >= 500).map(([l]) => l);
      expect({ crashedInsteadOfDenied: crashed }).toEqual({ crashedInsteadOfDenied: [] });

      // Nothing moved, and no event was written for the refused commands.
      const caseAfter = (await control.query(`SELECT * FROM case_core WHERE case_id = $1`, [caseId])).rows[0];
      expect(caseAfter).toEqual(caseBefore);
      const proposalAfter = (
        await control.query(
          `SELECT * FROM case_workspace_action_proposals WHERE action_proposal_id = $1`,
          [actionProposalId]
        )
      ).rows[0];
      expect(proposalAfter).toEqual(proposalBefore);
      expect(proposalAfter.status).toBe('APPROVED'); // never reached EXECUTING
      const outboxAfter = await readOutboxForOrg(control, orgId);
      expect(outboxAfter.map((r) => r.event_id)).toEqual(outboxBefore.map((r) => r.event_id));

      // -- NEGATIVE CONTROL ---------------------------------------------------
      // The very same step the revoked actor was refused succeeds for a
      // colleague whose membership is intact. Without this, "everything is
      // refused" would be indistinguishable from "the module is broken".
      const colleagueExecuting = await asColleague(
        'post',
        `${BASE}/proposals/${actionProposalId}/transition-to-executing`
      ).send({ expectedVersion: approvedProposalVersion });
      expect(colleagueExecuting.status).toBe(200);
      expect(colleagueExecuting.body.data.status).toBe('EXECUTING');

      // -- AND REINSTATEMENT RESTORES ACCESS ----------------------------------
      // Proves the denial tracked the CURRENT membership row rather than some
      // cached or one-way decision.
      await control.query(
        `UPDATE organization_members SET status = 'ACTIVE'
          WHERE organization_id = $1 AND user_id = $2`,
        [orgId, doomed]
      );
      const reinstated = await asDoomed('get', `${BASE}/cases/${caseId}`);
      expect(reinstated.status).toBe(200);
      expect(reinstated.body.data.caseId).toBe(caseId);
    } finally {
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
  }, 180_000);
});
