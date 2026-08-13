/**
 * Case Workspace — Decision capability adapter (Strumień C, Golden Case
 * "Decision").
 *
 * A real, dispatchable INTERNAL capability wrapping
 * server/src/services/decisionService.ts's createDecision/getDecision. Before
 * this file, `decisions` had a registry ROW SCHEMA (capabilityRegistryService.ts)
 * but nothing anywhere in this codebase could actually EXECUTE one — see
 * capabilityAdapterService.ts's own header. This closes that gap for exactly
 * one operation: creating a Decision from inside a Case, with a late-bound
 * artifact link back to it.
 *
 * doc 05 §5's per-adapter checklist, each satisfied by a distinct, separately
 * tested piece:
 *   input contract    -> DECISION_TYPES / requireNonBlankInput/requireEnumInput
 *                         in the handler below (INPUT_INVALID on failure).
 *   output contract   -> validateOutput on the returned binding.
 *   timeout            -> inherited from internalCommandAdapter (every
 *                         INTERNAL adapter is raced against a timeout; this
 *                         file adds no I/O beyond in-process DB calls, so it
 *                         does not override binding.timeoutMs).
 *   idempotency        -> inherited from executeCapability's own
 *                         recordIdempotencyKeyCheck gate, which runs BEFORE
 *                         this handler is ever invoked — see
 *                         decisionAdapter.pg.test.ts's "retry" case for the
 *                         end-to-end proof specific to this module.
 *   audit/outbox        -> inherited: executeCapability publishes
 *                         capability.invoked/invocation_failed for every call
 *                         to this handler; this file adds nothing on top.
 *   error mapping       -> CapabilityHandlerError throws below map bad input
 *                         and access denial to precise taxonomy codes instead
 *                         of the generic CAPABILITY_INTERNAL_ERROR every other
 *                         throw collapses to.
 *   ARTIFACT LINK        -> attachArtifactLink() from ./_shared.ts; the
 *                         Decision row itself is the ONLY place its content
 *                         lives — this adapter never copies any of it into a
 *                         Case-owned table.
 *   safe permission check -> resolveCaseContext() from ./_shared.ts.
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
import { createDecision, getDecision, type CreateDecisionInput, type Decision } from '../../decisionService.js';
import { attachArtifactLink, requireEnumInput, requireNonBlankInput, resolveCaseContext, resultRefFor } from './_shared.js';

export const DECISION_CREATE_CAPABILITY_ID = 'case-workspace.decision.create';
export const DECISION_CREATE_CAPABILITY_VERSION = '1.0.0';

const DECISION_TYPES = ['GO_NO_GO', 'APPROVAL', 'RESOURCE_ALLOCATION', 'OTHER'] as const;

export interface DecisionAdapterDeps {
  createDecision?: (input: CreateDecisionInput) => Promise<Decision>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Builds the INTERNAL binding. Exposed as a factory (rather than a single
 * module-level constant) so tests can inject a failing `createDecision` or
 * `linkArtifactToCase` — the exact same injectable-dependency pattern
 * capabilityAdapterService.ts's own HttpApiBinding.fetchImpl already
 * establishes for testability, applied here to an INTERNAL binding's module
 * calls instead of a transport call.
 */
export function buildDecisionCreateBinding(deps: DecisionAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createDecision ?? createDecision;

  return {
    kind: 'INTERNAL',
    timeoutMs: 10_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const title = requireNonBlankInput(payload.title, 'title');
      const type = requireEnumInput(payload.type, DECISION_TYPES, 'type');
      const decisionMakerId = requireNonBlankInput(payload.decisionMakerId, 'decision_maker_id');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      let decision: Decision;
      try {
        decision = await create({
          organizationId: caseContext.organizationId,
          projectId: caseContext.projectId || undefined,
          initiativeId: readOptionalString(payload.initiativeId),
          title,
          description: readOptionalString(payload.description),
          type,
          decisionMakerId,
          options: Array.isArray(payload.options)
            ? (payload.options as CreateDecisionInput['options'])
            : undefined,
          criteria: readOptionalString(payload.criteria),
          deadline: readOptionalString(payload.deadline),
          stakeholderIds: Array.isArray(payload.stakeholderIds)
            ? (payload.stakeholderIds as string[])
            : undefined,
          createdBy: envelope.actor.actorId,
        });
      } catch (error) {
        // decisionService.createDecision throws on things like a
        // decision_maker_id that does not FK to a real users row — a caller
        // input problem from this capability's point of view, never OUR bug.
        throw new CapabilityHandlerError(
          'CAPABILITY_INPUT_INVALID',
          error instanceof Error ? error.name || 'decision_create_rejected' : 'decision_create_rejected'
        );
      }

      // Best-effort, late-binding link — see attachArtifactLink's own doc for
      // the full partial-failure contract this deliberately implements.
      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'decision',
        artifactId: decision.id,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          decisionId: decision.id,
          organizationId: decision.organizationId,
          projectId: decision.projectId ?? null,
          title: decision.title,
          type: decision.type,
          status: decision.status,
          decisionMakerId: decision.decisionMakerId,
          artifactLink,
        },
        resultRef: resultRefFor('decision', decision.id),
      };
    },
    validateOutput: (output) =>
      typeof output.decisionId === 'string' &&
      output.decisionId.length > 0 &&
      typeof output.status === 'string',
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerDecisionCreateAdapterBinding(deps: DecisionAdapterDeps = {}): void {
  registerCapabilityBinding(
    DECISION_CREATE_CAPABILITY_ID,
    DECISION_CREATE_CAPABILITY_VERSION,
    buildDecisionCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function decisionCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: DECISION_CREATE_CAPABILITY_ID,
    capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
    ownerModule: 'decisions',
    providerType: 'INTERNAL',
    operation: 'createDecision',
    owningCommandRef: 'command:decision.create',
    inputSchemaRef: 'schema:case-workspace.decision.create.input@1',
    outputSchemaRef: 'schema:case-workspace.decision.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    reversibility: 'REVERSIBLE_VIA_CANCEL',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 10_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call — see capabilityAdapterService.registerCapabilityWithAdapter's own doc for why coupling them matters. */
export async function registerDecisionCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: DecisionAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    decisionCreateRegistrationInput(params.createdByActorId),
    buildDecisionCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

/** Re-exported for adapters/index.ts and tests that want a readback without importing decisionService directly. */
export { getDecision };
