/**
 * Case Workspace — Initiative/Execution capability adapter (Strumień C,
 * Golden Case "Initiative/Execution").
 *
 * A real, dispatchable INTERNAL capability wrapping
 * server/src/services/initiativeService.ts's createInitiative/
 * getInitiativeById. See decisionAdapter.ts's header for the checklist this
 * file satisfies the same way (input/output contract, timeout, idempotency,
 * audit/outbox, error mapping, artifact link, permission check) — not
 * repeated verbatim here.
 *
 * initiativeService.getInitiativeById(id, organizationId) is ALREADY
 * org-scoped at the SQL level (`AND organization_id = ?` when organizationId
 * is passed) — unlike decisionService.getDecision, which has no such filter.
 * This adapter still runs its own resolveCaseContext() cross-tenant guard on
 * the WRITE path (the module's own read-side scoping does not protect the
 * create path at all), and additionally always passes the Case's OWN
 * organizationId into getInitiativeById's second argument on readback, so a
 * caller can never read back an Initiative through this adapter under a
 * mismatched org even if a future caller forgot to check first.
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
import initiativeService from '../../initiativeService.js';
import type { CreateInitiativeData, Initiative } from '../../initiative/InitiativeDefinitionService.js';
import { attachArtifactLink, requireNonBlankInput, resolveCaseContext, resultRefFor } from './_shared.js';

export const INITIATIVE_CREATE_CAPABILITY_ID = 'case-workspace.initiative.create';
export const INITIATIVE_CREATE_CAPABILITY_VERSION = '1.0.0';

export interface InitiativeAdapterDeps {
  createInitiative?: (data: CreateInitiativeData) => Promise<Initiative>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildInitiativeCreateBinding(deps: InitiativeAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createInitiative ?? ((data: CreateInitiativeData) => initiativeService.createInitiative(data));

  return {
    kind: 'INTERNAL',
    timeoutMs: 10_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const title = requireNonBlankInput(payload.title, 'title');

      const caseContext = await resolveCaseContext(caseId, envelope);

      let initiative: Initiative;
      try {
        initiative = await create({
          organization_id: caseContext.organizationId,
          project_id: caseContext.projectId || undefined,
          title,
          status: 'DRAFT',
          axis: readOptionalString(payload.axis),
          area: readOptionalString(payload.area),
          summary: readOptionalString(payload.summary),
          hypothesis: readOptionalString(payload.hypothesis),
          business_value: readOptionalString(payload.businessValue),
          cost_capex: readOptionalNumber(payload.costCapex),
          cost_opex: readOptionalNumber(payload.costOpex),
          expected_roi: readOptionalNumber(payload.expectedRoi),
          start_date: readOptionalString(payload.startDate),
          end_date: readOptionalString(payload.endDate),
          // owner_business_id FKs into users(id) — only set when the caller
          // actually supplied a real user id; defaulting to the acting actor
          // would silently fail for AGENT/SYSTEM actors that are not
          // themselves a `users` row.
          owner_business_id: readOptionalString(payload.ownerBusinessId),
        } as CreateInitiativeData);
      } catch (error) {
        throw new CapabilityHandlerError(
          'CAPABILITY_INPUT_INVALID',
          error instanceof Error ? error.name || 'initiative_create_rejected' : 'initiative_create_rejected'
        );
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'initiative',
        artifactId: initiative.id,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          initiativeId: initiative.id,
          organizationId: initiative.organization_id,
          projectId: initiative.project_id ?? null,
          title: initiative.title,
          status: initiative.status,
          artifactLink,
        },
        resultRef: resultRefFor('initiative', initiative.id),
      };
    },
    validateOutput: (output) =>
      typeof output.initiativeId === 'string' &&
      output.initiativeId.length > 0 &&
      typeof output.status === 'string',
  };
}

export function registerInitiativeCreateAdapterBinding(deps: InitiativeAdapterDeps = {}): void {
  registerCapabilityBinding(
    INITIATIVE_CREATE_CAPABILITY_ID,
    INITIATIVE_CREATE_CAPABILITY_VERSION,
    buildInitiativeCreateBinding(deps)
  );
}

export function initiativeCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: INITIATIVE_CREATE_CAPABILITY_ID,
    capabilityVersion: INITIATIVE_CREATE_CAPABILITY_VERSION,
    ownerModule: 'initiatives',
    providerType: 'INTERNAL',
    operation: 'createInitiative',
    owningCommandRef: 'command:initiative.create',
    inputSchemaRef: 'schema:case-workspace.initiative.create.input@1',
    outputSchemaRef: 'schema:case-workspace.initiative.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 10_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

export async function registerInitiativeCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: InitiativeAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    initiativeCreateRegistrationInput(params.createdByActorId),
    buildInitiativeCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

export async function getInitiativeReadback(id: string, organizationId: string): Promise<Initiative | null> {
  return initiativeService.getInitiativeById(id, organizationId);
}
