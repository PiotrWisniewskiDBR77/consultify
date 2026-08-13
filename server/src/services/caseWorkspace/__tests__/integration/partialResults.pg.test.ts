/**
 * INTEGRATION GATE — partial results, deliverable identity and safe return.
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS (pakiet CW-T-D)
 * ===========================================================================
 * Until now nothing in this repo exercised `GET /cases/:caseId/node-result-
 * acceptances` over HTTP with more than one recorded value — the golden cases
 * next door and `fullChainObservability.pg.test.ts` each record exactly ONE
 * node result, always `ACCEPTED`, and never read it back through the
 * case-scoped list route the UI (`src/components/CaseWorkspace/apiResults.ts`
 * -> `RezultatyView.tsx`) actually calls. That left the backend contract the
 * new "Wyniki wykonania kroków" section depends on UNPROVEN:
 *
 *   1. does the case-scoped list return EVERY resultAcceptance value
 *      (ACCEPTED/PARTIAL/REJECTED/NOT_APPLICABLE), or does something filter
 *      the ones that are not ACCEPTED?
 *   2. is `PARTIAL` carried as an explicit, named field — never inferable
 *      from a "warnings" or count field that does not exist on the row?
 *   3. does `acceptanceInputSnapshot` — the "dowód" the UI renders and mines
 *      for a deliverable reference — round-trip byte-exact, so the UI is
 *      parsing real data and not something the backend silently reshaped?
 *   4. when the UI resolves "the object this result points at" against an
 *      already-loaded `CaseArtifactLink` (`RezultatyView.tsx`'s
 *      `rozstrzygnijOtwarcieRezultatuKroku`), is that link's `linkStatus`
 *      REAL — i.e. does marking it unavailable actually flip what a second,
 *      independent read reports, so "unavailable" in the UI reflects a real
 *      backend fact rather than a guess?
 *   5. does `GET /run-bindings/:runId` (the "źródłowy Run" context the
 *      preview panel loads lazily) resolve for an authorized actor and fail
 *      closed — 4xx, never a crash — for a foreign one, exactly the split
 *      `apiResults.ts`'s `toFailure` renders as an honest blocked/not-found
 *      state instead of leaking whether the run exists?
 *   6. does a SECOND, independent read (a stand-in for "the user refreshed
 *      the page") return the identical set — proving the projection is
 *      backed by Postgres, not by anything a client could lose on reload?
 *
 * This suite answers all six directly, over the real HTTP surface, against a
 * disposable Postgres — never a mock.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *   npx vitest run src/services/caseWorkspace/__tests__/integration/partialResults.pg.test.ts \
 *   --environment node
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
  warnSkipped,
} from '../goldenCases/goldenCaseHarness.js';

const REACHABLE = await isGoldenCaseDbReachable();
warnSkipped('INTEGRATION GATE (partial results, deliverable identity, safe return)', REACHABLE);

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

suite('INTEGRATION GATE — partial results, deliverable identity, safe return', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  it(
    'the case-scoped read exposes every explicit resultAcceptance value, a real ' +
      'deliverable identity, an honest unavailable state and a run context that ' +
      'fails closed for a foreign actor — and a second read matches the first',
    async () => {
      const fx = new GoldenCaseFixtures(control);
      const correlationId = `partial-results-${randomUUID()}`;
      let caseId = '';

      try {
        // -- Cast ---------------------------------------------------------------
        const orgId = await fx.seedOrg('partial-results');
        const projectId = await fx.seedProject(orgId, 'partial-results');
        const consultantId = await fx.seedUser(orgId, 'partial-results-consultant');
        await fx.seedMembership(orgId, consultantId, 'MEMBER');
        const sponsorId = await fx.seedUser(orgId, 'partial-results-sponsor');
        await fx.seedMembership(orgId, sponsorId, 'ADMIN');

        // A second, wholly unrelated organization — the "unauthorized" probe.
        const orgB = await fx.seedOrg('partial-results-b');
        const intruderId = await fx.seedUser(orgB, 'partial-results-intruder');
        await fx.seedMembership(orgB, intruderId, 'OWNER');

        const consultant = createGoldenCaseApp({
          organizationId: orgId,
          userId: consultantId,
          userRole: 'MEMBER',
          isSuperAdmin: false,
        });
        const intruder = createGoldenCaseApp({
          organizationId: orgB,
          userId: intruderId,
          userRole: 'OWNER',
          isSuperAdmin: false,
        });
        const asConsultant = (m: 'post' | 'get' | 'put', url: string) =>
          request(consultant)[m](url).set('X-Correlation-ID', correlationId);
        const asIntruder = (m: 'post' | 'get' | 'put', url: string) => request(intruder)[m](url);

        // -- 1. Case + published plan + Run binding ------------------------------
        const created = await asConsultant('post', `${BASE}/cases`).send({
          projectId,
          caseName: 'Partial results integration gate',
          caseProfile: 'STANDARD',
          governanceTier: 'STANDARD',
          contractedClosureType: 'DELIVERY_COMPLETED',
          sponsorUserId: sponsorId,
        });
        expect(created.status).toBe(201);
        caseId = created.body.data.caseId;

        expect(
          (await asConsultant('post', `${BASE}/cases/${caseId}/status`).send({ targetStatus: 'ACTIVE' })).status
        ).toBe(200);

        const draft = await asConsultant('post', `${BASE}/cases/${caseId}/plan-versions`).send({
          semanticGraph: minimalGraph(),
          changeReason: 'partial-results delivery plan',
        });
        expect(draft.status).toBe(201);
        const planVersionId: string = draft.body.data.casePlanVersionId;
        const proposedPlan = await asConsultant('post', `${BASE}/plan-versions/${planVersionId}/propose`).send({
          expectedVersion: draft.body.data.version,
        });
        expect(proposedPlan.status).toBe(200);
        const publishedPlan = await asConsultant('post', `${BASE}/plan-versions/${planVersionId}/publish`).send({
          expectedVersion: proposedPlan.body.data.version,
        });
        expect(publishedPlan.status).toBe(200);

        const runId = await fx.seedExecutionRun(orgId, consultantId, 'partial-results');
        const binding = await asConsultant('post', `${BASE}/run-bindings`).send({
          runId,
          casePlanVersionId: planVersionId,
        });
        expect(binding.status).toBe(201);
        expect(binding.body.data.graphDigest).toBe(publishedPlan.body.data.graphDigest);

        // -- 2. A deliverable the PARTIAL step points at, created FIRST so its
        //       identity can be embedded in the acceptance snapshot below. --------
        const deliverableId = `deliverable-${randomUUID()}`;
        const link = await asConsultant('post', `${BASE}/cases/${caseId}/artifact-links`).send({
          artifactType: 'document',
          artifactId: deliverableId,
          artifactRevision: 'rev-1',
          relation: 'DELIVERABLE',
        });
        expect(link.status).toBe(201);
        const linkId: string = link.body.data.linkId;
        expect(link.body.data.linkStatus).toBe('ACTIVE');

        // -- 3. FOUR node results, one per resultAcceptance value ----------------
        // The PARTIAL row's `acceptanceInputSnapshot` embeds the deliverable's
        // identity in the SAME `{ artifactType, artifactId }` shape
        // `apiResults.ts#deliverableRefFromSnapshot` reads — this is the exact
        // wire content the UI's "Otwórz rezultat" resolves against.
        const nodeRunAccepted = `noderun-accepted-${randomUUID()}`;
        const nodeRunPartial = `noderun-partial-${randomUUID()}`;
        const nodeRunRejected = `noderun-rejected-${randomUUID()}`;
        const nodeRunSkipped = `noderun-skipped-${randomUUID()}`;

        const acceptedRes = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
          nodeRunId: nodeRunAccepted,
          nodeType: 'CAPABILITY',
          nodeCompletionState: 'COMPLETED',
          resultAcceptance: 'ACCEPTED',
          acceptanceInputSnapshot: { summary: 'baseline model produced in full' },
          occurredAt: new Date().toISOString(),
        });
        expect(acceptedRes.status).toBe(201);

        const partialRes = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
          nodeRunId: nodeRunPartial,
          nodeType: 'HUMAN_TASK',
          nodeCompletionState: 'COMPLETED',
          resultAcceptance: 'PARTIAL',
          acceptanceInputSnapshot: {
            summary: 'draft delivered, sponsor sign-off still pending',
            artifactType: 'document',
            artifactId: deliverableId,
          },
          occurredAt: new Date().toISOString(),
        });
        expect(partialRes.status).toBe(201);
        expect(partialRes.body.data.resultAcceptance).toBe('PARTIAL');
        // PRECONDITION for point 2 above: the row has no field a UI could
        // mistake for a warnings/count-derived signal.
        expect(Object.keys(partialRes.body.data).sort()).toEqual(
          [
            'acceptanceInputDigest',
            'acceptanceInputSnapshot',
            'caseId',
            'causedByGatewayNodeRunId',
            'nodeCompletionState',
            'nodeRunId',
            'nodeType',
            'occurredAt',
            'organizationId',
            'projectId',
            'recordedAt',
            'recordedByActorId',
            'resultAcceptance',
            'runId',
            'skipAuthorizedByGraphCondition',
            'skipConditionRef',
          ].sort()
        );

        const rejectedRes = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
          nodeRunId: nodeRunRejected,
          nodeType: 'APPROVAL',
          nodeCompletionState: 'COMPLETED',
          resultAcceptance: 'REJECTED',
          acceptanceInputSnapshot: { summary: 'sponsor rejected the recommendation' },
          occurredAt: new Date().toISOString(),
        });
        expect(rejectedRes.status).toBe(201);

        const skippedRes = await asConsultant('post', `${BASE}/runs/${runId}/node-result-acceptances`).send({
          nodeRunId: nodeRunSkipped,
          nodeType: 'HUMAN_TASK',
          nodeCompletionState: 'SKIPPED',
          resultAcceptance: 'NOT_APPLICABLE',
          skipAuthorizedByGraphCondition: true,
          skipConditionRef: 'edge:optional-review',
          acceptanceInputSnapshot: { summary: 'step skipped — condition on the published graph allowed it' },
          occurredAt: new Date().toISOString(),
        });
        expect(skippedRes.status).toBe(201);

        // ======================================================================
        // A. CASE-SCOPED LIST — the exact route the UI calls — carries all four,
        //    each with its EXPLICIT resultAcceptance, none dropped or coerced.
        // ======================================================================
        const listRes = await asConsultant('get', `${BASE}/cases/${caseId}/node-result-acceptances`);
        expect(listRes.status).toBe(200);
        const byNodeRun = new Map<string, any>(
          listRes.body.data.map((row: any) => [row.nodeRunId, row])
        );
        expect(byNodeRun.size).toBe(4);
        expect(byNodeRun.get(nodeRunAccepted)?.resultAcceptance).toBe('ACCEPTED');
        expect(byNodeRun.get(nodeRunPartial)?.resultAcceptance).toBe('PARTIAL');
        expect(byNodeRun.get(nodeRunRejected)?.resultAcceptance).toBe('REJECTED');
        expect(byNodeRun.get(nodeRunSkipped)?.resultAcceptance).toBe('NOT_APPLICABLE');
        // Every row carries BOTH identifiers the preview panel needs to show
        // "źródłowy Run" and "NodeRun" — never just one.
        for (const row of byNodeRun.values()) {
          expect(row.runId).toBe(runId);
          expect(row.caseId).toBe(caseId);
          expect(typeof row.nodeRunId).toBe('string');
          expect(row.nodeRunId.length).toBeGreaterThan(0);
        }

        // ======================================================================
        // B. THE DOWÓD ROUND-TRIPS BYTE-EXACT — the UI parses real data.
        // ======================================================================
        expect(byNodeRun.get(nodeRunPartial)?.acceptanceInputSnapshot).toEqual({
          summary: 'draft delivered, sponsor sign-off still pending',
          artifactType: 'document',
          artifactId: deliverableId,
        });

        // ======================================================================
        // C. DELIVERABLE IDENTITY — the SAME artifactType/artifactId the PARTIAL
        //    snapshot names resolves, through the case's OWN artifact-links list
        //    (what `rozstrzygnijOtwarcieRezultatuKroku` matches against), to a
        //    link this actor can genuinely open.
        // ======================================================================
        const linksRes = await asConsultant('get', `${BASE}/cases/${caseId}/artifact-links`);
        expect(linksRes.status).toBe(200);
        const matchingLink = linksRes.body.data.find(
          (l: any) => l.artifactType === 'document' && l.artifactId === deliverableId
        );
        expect(matchingLink).toBeDefined();
        expect(matchingLink.linkStatus).toBe('ACTIVE');
        expect(matchingLink.isStale).toBe(false);

        // ======================================================================
        // D. UNAVAILABLE IS A REAL, INDEPENDENTLY-READABLE FACT — not a guess.
        //    Marking it unavailable and reading it back a SECOND, independent
        //    way (list, not the single-link GET) proves the honest "niedostępny"
        //    state the UI renders reflects Postgres, not a stale local flag.
        // ======================================================================
        const markedUnavailable = await asConsultant(
          'post',
          `${BASE}/artifact-links/${linkId}/mark-unavailable`
        ).send({ reason: 'source document withdrawn' });
        expect(markedUnavailable.status).toBe(200);
        expect(markedUnavailable.body.data.linkStatus).toBe('UNAVAILABLE');

        const linksAfterUnavailable = await asConsultant('get', `${BASE}/cases/${caseId}/artifact-links`);
        const linkAfter = linksAfterUnavailable.body.data.find((l: any) => l.linkId === linkId);
        expect(linkAfter.linkStatus).toBe('UNAVAILABLE');
        // CW-RT-025: unlinking/marking unavailable never deletes the object —
        // the link row, and its artifactId, are still there to describe WHAT
        // became unavailable.
        expect(linkAfter.artifactId).toBe(deliverableId);

        // ======================================================================
        // E. SOURCE RUN CONTEXT — resolves for the authorized actor, fails
        //    closed (never a crash) for a foreign one.
        // ======================================================================
        const runBindingRes = await asConsultant('get', `${BASE}/run-bindings/${runId}`);
        expect(runBindingRes.status).toBe(200);
        expect(runBindingRes.body.data).toMatchObject({
          runId,
          caseId,
          casePlanVersionId: planVersionId,
          graphDigest: publishedPlan.body.data.graphDigest,
        });

        const foreignNodeResults = await asIntruder('get', `${BASE}/cases/${caseId}/node-result-acceptances`);
        expectDenied('foreign org GET node-result-acceptances', foreignNodeResults);
        const foreignRunBinding = await asIntruder('get', `${BASE}/run-bindings/${runId}`);
        expectDenied('foreign org GET run-binding', foreignRunBinding);
        // SEC-009: the foreign read must not even confirm the run EXISTS by
        // returning a different status than a truly nonexistent run.
        const foreignRunBindingOfNothing = await asIntruder(
          'get',
          `${BASE}/run-bindings/${`nonexistent-${randomUUID()}`}`
        );
        expect(foreignRunBindingOfNothing.status).toBe(foreignRunBinding.status);

        // ======================================================================
        // F. REFRESH SAFETY — a second, independent read (stand-in for the user
        //    reloading the page) returns byte-identical acceptance values. The
        //    projection lives in Postgres, not in anything a page reload drops.
        // ======================================================================
        const secondListRes = await asConsultant('get', `${BASE}/cases/${caseId}/node-result-acceptances`);
        expect(secondListRes.status).toBe(200);
        const secondByNodeRun = new Map<string, any>(
          secondListRes.body.data.map((row: any) => [row.nodeRunId, row.resultAcceptance])
        );
        expect(secondByNodeRun.get(nodeRunAccepted)).toBe('ACCEPTED');
        expect(secondByNodeRun.get(nodeRunPartial)).toBe('PARTIAL');
        expect(secondByNodeRun.get(nodeRunRejected)).toBe('REJECTED');
        expect(secondByNodeRun.get(nodeRunSkipped)).toBe('NOT_APPLICABLE');
        expect(secondListRes.body.data.map((r: any) => r.acceptanceInputDigest).sort()).toEqual(
          listRes.body.data.map((r: any) => r.acceptanceInputDigest).sort()
        );
      } finally {
        if (caseId) {
          await control
            .query(`DELETE FROM case_workspace_artifact_links WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_workspace_node_result_acceptances WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
          await control
            .query(`DELETE FROM case_workspace_history_events WHERE case_id = $1`, [caseId])
            .catch(() => undefined);
        }
        await fx.teardown();
      }
    },
    180_000
  );
});
