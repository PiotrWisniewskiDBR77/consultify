/**
 * Case Workspace — Results capability adapter (Strumień C / D1b, Golden Case
 * "Results scorecard create").
 *
 * A real, dispatchable INTERNAL capability wrapping
 * server/src/services/results/kpiScorecardService.ts's createScorecard/
 * getScorecard — the ONE Results service this packet's investigation found
 * with a genuine, org-scoped create+read pair of the same shape as
 * decisionService.createDecision/getDecision. See decisionAdapter.ts's header
 * for the checklist this file satisfies the same way (input/output contract,
 * timeout, idempotency, audit/outbox, error mapping, artifact link,
 * permission check) — not repeated verbatim here.
 *
 * ============================================================================
 * WHAT "RESULTS" MEANS HERE, AND WHY A SCORECARD (NOT A KPI, NOT A NODE
 * RESULT ACCEPTANCE)
 * ============================================================================
 * `server/src/routes/v8/results.routes.ts` is a ~4300-line router covering a
 * large surface (dashboards, ROI, scorecards, benefits, value intelligence,
 * strategic view, ...). Of that surface this packet investigated three
 * candidates for a "Golden Case" create+read pair and rejected two:
 *
 *   - `case_workspace_node_result_acceptances`
 *     (`server/src/services/caseWorkspace/executionGraphService.ts:311-328`,
 *     read via `src/components/CaseWorkspace/apiResults.ts`) — this is what
 *     the Case Workspace's OWN "Rezultaty" tab (`RezultatyView.tsx`) shows,
 *     but it is a RUNTIME record of how an execution-graph node's own step
 *     was accepted (ACCEPTED/PARTIAL/REJECTED/NOT_APPLICABLE), not a Results
 *     MODULE object a capability could "create". There is no
 *     `createNodeResultAcceptance`-style entry point a capability could call
 *     — the row is written by the execution runtime itself as a side effect
 *     of running a graph, never as a standalone create.
 *   - `initiative_kpis` create/read (`server/src/services/results/
 *     kpiDefinitionService.ts`'s `createDefinition`/`getCurrentDefinition`)
 *     — a real, tested create+read pair, but it is ALREADY the wrapped
 *     service behind `case-workspace.kpi.create`
 *     (`server/src/services/caseWorkspace/adapters/kpiAdapter.ts`). Wrapping
 *     it again under a "results" capability id would be the same native
 *     object reachable through two different capability ids — this packet's
 *     brief was a NEW adapter, not a duplicate of an already-built one.
 *
 * `kpiScorecardService.ts` (RES-10) is the genuinely uncovered one: an
 * organization has MANY "kpi_scorecards" rows (department x period cards,
 * e.g. "Finance — Q3 2026"), each with its own id, name, and lifecycle
 * (`kpi_scorecards.status`), created via `createScorecard(organizationId,
 * data)` and read back via `getScorecard(organizationId, scorecardId)` — the
 * exact same "org-scoped create, then org-scoped read by id" shape as
 * `financialModelingService.createModel`/`getModel`. It is REAL and already
 * has a production frontend caller: `src/services/api/v8/results.ts`'s
 * `resultsApi.createScorecard`/`getScorecards`, consumed by
 * `src/components/Results/ResultsKpiScorecardsView.tsx`.
 *
 * ============================================================================
 * TENANCY — ALREADY THE STRICTEST OF THE FOUR EXISTING ADAPTERS' WRAPPED
 * SERVICES, AND WHY THIS ADAPTER STILL RUNS resolveCaseContext()
 * ============================================================================
 * `kpiScorecardService.ts`'s own header states: "FAIL-CLOSED TENANCY: every
 * read and write is scoped by organizationId in the query itself, never
 * filtered in JS after an unscoped read" — verified by reading `createScorecard`
 * (INSERT includes `organization_id` as a column, never inferred) and
 * `getScorecard` (`WHERE id = ? AND organization_id = ?`). That protects the
 * MODULE's own tables. It does NOT protect the Case-to-module boundary this
 * adapter sits on: nothing in `kpiScorecardService.ts` knows what a "Case" is
 * or checks that the caller may act on one, so `resolveCaseContext()` (Case
 * existence, actor standing, AND envelope-org/Case-org agreement) still runs
 * first, exactly as in every sibling adapter in this directory — the Case's
 * OWN resolved `organizationId` is what gets passed into `createScorecard`,
 * never the envelope's unchecked claim.
 *
 * ============================================================================
 * THE DbPromise FALLBACK-SWALLOW TRAP — CONFIRMED NOT TO APPLY HERE, WITH THE
 * EVIDENCE, AND WHY THIS ADAPTER STILL DEFENDS AGAINST IT ANYWAY
 * ============================================================================
 * The finance/decision/initiative slots in this directory each had to guard
 * against `DbPromise.run()`'s documented `fallback` DEFAULT of `true` (a
 * genuine SQL error resolves `{ success: false }` instead of rejecting, so a
 * naive caller can report SUCCEEDED over a write that never landed).
 * `kpiScorecardService.createScorecard` does NOT have this defect: every
 * single DbPromise call in that file — `listScorecards`, `getScorecard`,
 * `getScorecardKpis`, `createScorecard`, `updateScorecard`,
 * `addKpiToScorecard`, `removeKpiFromScorecard` — passes `{ fallback: false }`
 * explicitly (verified by reading `kpiScorecardService.ts` line by line: this
 * is the ONLY DbPromise-backed writer among the four Golden Case services
 * wrapped in this directory that does so consistently on every call). Per
 * `server/src/utils/DbPromise.ts`'s `all()`/`get()`/`run()` implementations,
 * `{ fallback: false }` makes a genuine driver error (or a timeout) REJECT the
 * promise instead of resolving `{ success: false }` — so `createScorecard`'s
 * `INSERT ... RETURNING` either truly lands a row and returns it, or the
 * `await dbAll(...)` call itself throws, which this adapter's own `try/catch`
 * below already turns into `CAPABILITY_INPUT_INVALID` (matching every other
 * adapter's "the wrapped service's own throw is a caller-input problem, never
 * OUR bug" posture) or, if the throw is NOT explicitly caught (e.g. driver
 * connectivity failure), propagates and is mapped by `executeCapability`'s
 * generic handler to `CAPABILITY_INTERNAL_ERROR` — there is no path here
 * where a failed write is misreported as a successful one via the
 * fallback-swallow mechanism the other three adapters had to specifically
 * defend against.
 *
 * This adapter STILL performs the same re-read-after-create defense as
 * financeAdapter/decisionAdapter/initiativeAdapter, as belt-and-suspenders
 * against a DIFFERENT class of risk this file cannot prove absent by reading
 * the current source alone: `createScorecard`'s `INSERT ... RETURNING` could
 * in principle return zero rows without the underlying driver call itself
 * throwing (e.g. a future refactor that adds a `WHERE`/`ON CONFLICT DO
 * NOTHING` clause, or a currently-unknown Postgres/driver edge case). Rather
 * than trust `rows[0]` on faith, the handler re-reads via `getScorecard`
 * (the module's OWN read, not a SELECT this file invents) and treats a miss
 * as `CAPABILITY_INTERNAL_ERROR` instead of a false SUCCEEDED — see
 * `resultsAdapter.pg.test.ts`'s negative-control test, which feeds
 * `createScorecard` a `periodStart` malformed enough to make the real
 * Postgres INSERT fail, and asserts this surfaces as a failure, never a lying
 * success pointing at a `kpi_scorecards` row that was never written.
 *
 * `getScorecard`'s OWN return shape is intentionally thin (`{ id, name }` —
 * an "ownership lookup", per its own doc comment) — this adapter's output
 * therefore builds the fuller record from `createScorecard`'s own return
 * value (which already carries `department`/`periodLabel`/`periodStart`/
 * `periodEnd`/`status`) and uses the `getScorecard` re-read purely as the
 * persistence proof, matching `id`/`name` against what was just created.
 */

import {
  CapabilityHandlerError,
  registerCapabilityBinding,
  registerCapabilityWithAdapter,
  type CapabilityExecutionEnvelope,
  type InternalCommandBinding,
} from '../capabilityAdapterService.js';
import type { RegisterCapabilityInput } from '../capabilityRegistryService.js';
import * as artifactLinkService from '../artifactLinkService.js';
import {
  createScorecard,
  getScorecard,
  type CreateScorecardInput,
  type KpiScorecardRow,
} from '../../results/kpiScorecardService.js';
import { attachArtifactLink, requireNonBlankInput, resolveCaseContext, resultRefFor } from './_shared.js';

export const RESULTS_SCORECARD_CREATE_CAPABILITY_ID = 'case-workspace.results.scorecard.create';
export const RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION = '1.0.0';

export interface ResultsAdapterDeps {
  createScorecard?: (organizationId: string, data: CreateScorecardInput) => Promise<KpiScorecardRow>;
  getScorecard?: (
    organizationId: string,
    scorecardId: string
  ) => Promise<{ id: string; name: string } | null>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function buildResultsScorecardCreateBinding(deps: ResultsAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createScorecard ?? createScorecard;
  const read = deps.getScorecard ?? getScorecard;

  return {
    kind: 'INTERNAL',
    timeoutMs: 10_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const name = requireNonBlankInput(payload.name, 'name');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      let scorecard: KpiScorecardRow;
      try {
        scorecard = await create(caseContext.organizationId, {
          name,
          department: readOptionalString(payload.department) ?? null,
          periodLabel: readOptionalString(payload.periodLabel) ?? null,
          periodStart: readOptionalString(payload.periodStart) ?? null,
          periodEnd: readOptionalString(payload.periodEnd) ?? null,
          createdBy: envelope.actor.actorId,
        });
      } catch (error) {
        // createScorecard's own DbPromise calls all pass { fallback: false }
        // (see this file's header) — a genuine SQL error here REJECTS rather
        // than resolving a false success, so this catch is a caller-input
        // problem from this capability's point of view (e.g. a malformed
        // periodStart/periodEnd the `date` column rejects), never OUR bug.
        throw new CapabilityHandlerError(
          'CAPABILITY_INPUT_INVALID',
          error instanceof Error ? error.name || 'results_scorecard_create_rejected' : 'results_scorecard_create_rejected'
        );
      }

      // Re-read via the module's OWN getScorecard — belt-and-suspenders
      // persistence proof (see this file's header for exactly what class of
      // risk this defends against, now that the fallback-swallow trap itself
      // has been confirmed not to apply to createScorecard). A miss here
      // must never be reported as SUCCEEDED.
      const persisted = await read(caseContext.organizationId, scorecard.id);
      if (!persisted || persisted.id !== scorecard.id) {
        throw new Error('results_scorecard_create_not_persisted');
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'kpi_scorecard',
        artifactId: scorecard.id,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          scorecardId: scorecard.id,
          organizationId: scorecard.organizationId,
          name: scorecard.name,
          department: scorecard.department,
          periodLabel: scorecard.periodLabel,
          periodStart: scorecard.periodStart,
          periodEnd: scorecard.periodEnd,
          status: scorecard.status,
          artifactLink,
        },
        resultRef: resultRefFor('kpi_scorecard', scorecard.id),
      };
    },
    validateOutput: (output) =>
      typeof output.scorecardId === 'string' && output.scorecardId.length > 0 && typeof output.status === 'string',
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerResultsScorecardCreateAdapterBinding(deps: ResultsAdapterDeps = {}): void {
  registerCapabilityBinding(
    RESULTS_SCORECARD_CREATE_CAPABILITY_ID,
    RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
    buildResultsScorecardCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function resultsScorecardCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: RESULTS_SCORECARD_CREATE_CAPABILITY_ID,
    capabilityVersion: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
    ownerModule: 'results',
    providerType: 'INTERNAL',
    operation: 'createScorecard',
    owningCommandRef: 'command:results.scorecard.create',
    inputSchemaRef: 'schema:case-workspace.results.scorecard.create.input@1',
    outputSchemaRef: 'schema:case-workspace.results.scorecard.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    // No delete exists for kpi_scorecards (only status mutation via
    // updateScorecard) — same "reversible = status-mutable, never
    // hard-deletable" posture as financeAdapter's registration.
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 10_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call — see capabilityAdapterService.registerCapabilityWithAdapter's own doc for why coupling them matters. */
export async function registerResultsScorecardCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: ResultsAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    resultsScorecardCreateRegistrationInput(params.createdByActorId),
    buildResultsScorecardCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

/** Re-exported for adapters/index.ts and tests that want a readback without importing kpiScorecardService directly. */
export async function getResultsScorecardReadback(
  scorecardId: string,
  organizationId: string
): Promise<{ id: string; name: string } | null> {
  return getScorecard(organizationId, scorecardId);
}
