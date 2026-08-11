/**
 * Case Workspace — Finance capability adapter (Strumień C / B2, Golden Case
 * "Finance model create").
 *
 * A real, dispatchable INTERNAL capability wrapping
 * server/src/services/financialModelingService.ts's createModel/getModel —
 * the ONE Finance service in this codebase this packet's investigation found
 * with a genuine, org-scoped create+read pair of the same shape as
 * decisionService.createDecision/getDecision. See decisionAdapter.ts's header
 * for the checklist this file satisfies the same way (input/output contract,
 * timeout, idempotency, audit/outbox, error mapping, artifact link,
 * permission check) — not repeated verbatim here.
 *
 * WHAT WAS INVESTIGATED AND REJECTED FOR THIS SLOT (so a future reader does
 * not re-walk the same dead ends):
 *   - finance/financeInvestmentCaseCandidateHandoff.ts (+ the Statement Pack
 *     / Valuation Recommendation siblings) — a real, tested create+read pair
 *     over `finance_candidate_handoffs`, but it PROMOTES an already-approved
 *     `financial_models` row into an `initiative_candidates` row; it cannot
 *     create anything "from scratch" the way this Golden Case shape needs
 *     (caseId + minimal fields -> a brand-new native object). A Case cannot
 *     use it without an operator having separately built and approved a
 *     model first, which is a different, two-actor workflow this packet did
 *     not have scope to redesign.
 *   - financeConclusionService.ts / financeReportConclusion.ts /
 *     financeDiagnosticsService.ts / financeStatementAnalyticsService.ts /
 *     financePostMortemService.ts — all pure calculators over
 *     caller-supplied data, no persistence, nothing to "create".
 *
 * ============================================================================
 * A CONFIRMED, PRE-EXISTING DEFECT IN THE WRAPPED SERVICE — AND HOW THIS
 * ADAPTER DEFENDS AGAINST IT (do not remove the defense without re-verifying
 * the underlying service first)
 * ============================================================================
 * `financialModelingService.createModel()` writes via `utils/DbPromise.js`'s
 * `run()`, called with NO `{ fallback: false }` override. `DbPromise.run`'s
 * documented default is `fallback = true`, which means a genuine SQL error
 * (bad FK, a malformed `start_date`, a NOT NULL violation, ...) RESOLVES
 * `{ success: false, error }` instead of rejecting — so `createModel`'s own
 * `try { await dbRun(...) } catch { ...smaller INSERT... }` fallback ladder
 * can never actually trigger on a real write failure (the promise never
 * rejects), and the function unconditionally returns the `id` it pre-generated
 * regardless of whether any row was actually persisted. Confirmed by reading
 * `server/src/utils/DbPromise.ts`'s `run()` implementation line by line, not
 * assumed. This is the SAME "DbPromise połyka błędy" class of defect already
 * documented independently elsewhere in this codebase's own history (see
 * `documentStudioService.materializeDocumentArtifact`'s own "MAT-010 fix"
 * comment for a prior, independent hit of the identical failure mode against
 * a DIFFERENT DbPromise-backed writer).
 *
 * This adapter does NOT trust `createModel`'s returned id on faith: it
 * immediately re-reads the row via `getModel(id, organizationId)` (the
 * module's OWN read, not a SELECT this file invents) and — because that read
 * is also needed to build the capability's real output anyway — treats a
 * miss as a genuine integrity failure (`CAPABILITY_INTERNAL_ERROR`, via a
 * plain `throw`) rather than returning a false `SUCCEEDED` pointing at a
 * financial_models row that was never written. See
 * `financeAdapter.pg.test.ts`'s dedicated negative-control test, which
 * intentionally feeds `createModel` a `start_date` malformed enough to make
 * the real Postgres INSERT fail, and asserts this adapter surfaces that as a
 * failure instead of a lying success — the exact scenario the guard exists
 * for.
 *
 * NAMING COLLISION WARNING: `financialModelingService.createModel`'s OWN
 * params also accept an (entirely unrelated) `caseId` field meaning "attach
 * this new scenario under an existing Investment Case root model" (FIN-04) —
 * NOT the Case Workspace `caseId` this adapter's payload uses to resolve
 * tenancy. This adapter deliberately never populates that field; conflating
 * the two would silently graft a new financial scenario onto a pre-existing,
 * unrelated Investment Case root.
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
import { createModel, getModel } from '../../financialModelingService.js';
import {
  attachArtifactLink,
  requireEnumInput,
  requireNonBlankInput,
  resolveCaseContext,
  resultRefFor,
} from './_shared.js';

export const FINANCE_MODEL_CREATE_CAPABILITY_ID = 'case-workspace.finance.model.create';
export const FINANCE_MODEL_CREATE_CAPABILITY_VERSION = '1.0.0';

const GRANULARITIES = ['monthly', 'quarterly', 'annual'] as const;

/** What this adapter reads back a created model as — the fields the output/tests care about. */
export interface FinanceModelReadback {
  id: string;
  organization_id: string;
  project_id: string | null;
  initiative_id: string | null;
  name: string;
  currency: string | null;
  scenario: string | null;
  status: string | null;
  start_date: string;
  horizon_months: number | null;
  granularity: string | null;
  created_by: string | null;
}

export interface FinanceAdapterDeps {
  createModel?: (input: Parameters<typeof createModel>[0]) => Promise<string>;
  getModel?: (modelId: string, organizationId?: string) => Promise<FinanceModelReadback | null>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildFinanceModelCreateBinding(deps: FinanceAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createModel ?? createModel;
  const read = (deps.getModel ?? getModel) as (
    modelId: string,
    organizationId?: string
  ) => Promise<FinanceModelReadback | null>;

  return {
    kind: 'INTERNAL',
    timeoutMs: 10_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const name = requireNonBlankInput(payload.name, 'name');
      const startDate = requireNonBlankInput(payload.startDate, 'start_date');
      const granularity =
        payload.granularity === undefined || payload.granularity === null
          ? undefined
          : requireEnumInput(payload.granularity, GRANULARITIES, 'granularity');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      let modelId: string;
      try {
        modelId = await create({
          organizationId: caseContext.organizationId,
          projectId: caseContext.projectId || undefined,
          initiativeId: readOptionalString(payload.initiativeId),
          name,
          description: readOptionalString(payload.description),
          currency: readOptionalString(payload.currency),
          horizonMonths: readOptionalNumber(payload.horizonMonths),
          startDate,
          granularity,
          scenario: readOptionalString(payload.scenario),
          createdBy: envelope.actor.actorId,
          // Deliberately NOT forwarding a Finance-native `caseId` — see this
          // file's header ("NAMING COLLISION WARNING").
        });
      } catch (error) {
        // createModel's own explicit, synchronous guards (cross-org
        // projectId/initiativeId FK-injection checks) throw a plain Error
        // BEFORE any dbRun call — a genuine caller-input problem from this
        // capability's point of view, never OUR bug.
        throw new CapabilityHandlerError(
          'CAPABILITY_INPUT_INVALID',
          error instanceof Error ? error.name || 'finance_model_create_rejected' : 'finance_model_create_rejected'
        );
      }

      // Re-read via the module's OWN getModel — both to build this
      // capability's real output (createModel returns only the bare id) and,
      // load-bearing, to catch the confirmed DbPromise fallback-swallow
      // defect documented in this file's header: a `createModel` call that
      // "succeeded" but wrote nothing must never be reported as SUCCEEDED.
      const model = await read(modelId, caseContext.organizationId);
      if (!model) {
        throw new Error('finance_model_create_not_persisted');
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'finance_model',
        artifactId: model.id,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          modelId: model.id,
          organizationId: model.organization_id,
          projectId: model.project_id ?? null,
          initiativeId: model.initiative_id ?? null,
          name: model.name,
          currency: model.currency,
          scenario: model.scenario,
          status: model.status,
          startDate: model.start_date,
          horizonMonths: model.horizon_months,
          granularity: model.granularity,
          artifactLink,
        },
        resultRef: resultRefFor('finance_model', model.id),
      };
    },
    validateOutput: (output) =>
      typeof output.modelId === 'string' && output.modelId.length > 0 && typeof output.status === 'string',
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerFinanceModelCreateAdapterBinding(deps: FinanceAdapterDeps = {}): void {
  registerCapabilityBinding(
    FINANCE_MODEL_CREATE_CAPABILITY_ID,
    FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
    buildFinanceModelCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function financeModelCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: FINANCE_MODEL_CREATE_CAPABILITY_ID,
    capabilityVersion: FINANCE_MODEL_CREATE_CAPABILITY_VERSION,
    ownerModule: 'finance',
    providerType: 'INTERNAL',
    operation: 'createModel',
    owningCommandRef: 'command:finance.model.create',
    inputSchemaRef: 'schema:case-workspace.finance.model.create.input@1',
    outputSchemaRef: 'schema:case-workspace.finance.model.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    // No delete/archive exists for financial_models (only draft<->review via
    // updateModel — approved is a one-way, separately-gated transition), so
    // "reversible" here means status-mutable, never hard-deletable.
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 10_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call — see capabilityAdapterService.registerCapabilityWithAdapter's own doc for why coupling them matters. */
export async function registerFinanceModelCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: FinanceAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    financeModelCreateRegistrationInput(params.createdByActorId),
    buildFinanceModelCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

/** Re-exported for adapters/index.ts and tests that want a readback without importing financialModelingService directly. */
export async function getFinanceModelReadback(
  modelId: string,
  organizationId: string
): Promise<FinanceModelReadback | null> {
  return (await getModel(modelId, organizationId)) as FinanceModelReadback | null;
}
