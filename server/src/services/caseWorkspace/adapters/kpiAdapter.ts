/**
 * Case Workspace — KPI capability adapter (Strumień C, Golden Case "KPI").
 *
 * A real, dispatchable INTERNAL capability wrapping
 * server/src/services/results/kpiDefinitionService.ts's createDefinition/
 * getCurrentDefinition. See decisionAdapter.ts's header for the checklist
 * this file satisfies the same way — not repeated verbatim here.
 *
 * kpiDefinitionService.ts is already the strictest tenancy story of the
 * three Golden Cases in this directory: its OWN header calls out
 * "FAIL-CLOSED TENANCY. Every read and write is scoped by `organizationId` in
 * the query itself" and a pinned single-connection transaction (not
 * DbPromise's per-statement pooling) so the `initiative_kpis` row, its v1
 * `kpi_definition_versions` row and its audit-log row commit or roll back
 * together. This adapter adds nothing to that guarantee — it only adds the
 * Case-context resolution and late-binding artifact link on top, the same
 * shape as decisionAdapter.ts/initiativeAdapter.ts.
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
  createDefinition,
  getCurrentDefinition,
  type CreateKpiDefinitionInput,
  type KpiDefinitionRecord,
} from '../../results/kpiDefinitionService.js';
import { attachArtifactLink, requireNonBlankInput, resolveCaseContext, resultRefFor } from './_shared.js';

export const KPI_CREATE_CAPABILITY_ID = 'case-workspace.kpi.create';
export const KPI_CREATE_CAPABILITY_VERSION = '1.0.0';

export interface KpiAdapterDeps {
  createDefinition?: (input: CreateKpiDefinitionInput) => Promise<KpiDefinitionRecord>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildKpiCreateBinding(deps: KpiAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createDefinition ?? createDefinition;

  return {
    kind: 'INTERNAL',
    timeoutMs: 10_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const name = requireNonBlankInput(payload.name, 'name');

      const caseContext = await resolveCaseContext(caseId, envelope);

      let definition: KpiDefinitionRecord;
      try {
        definition = await create({
          organizationId: caseContext.organizationId,
          initiativeId: readOptionalString(payload.initiativeId) ?? null,
          actorUserId: envelope.actor.actorId,
          name,
          description: readOptionalString(payload.description) ?? null,
          category: readOptionalString(payload.category) ?? null,
          unit: readOptionalString(payload.unit) ?? null,
          direction: readOptionalString(payload.direction) ?? null,
          measurementFrequency: readOptionalString(payload.measurementFrequency) ?? null,
          baselineValue: readOptionalNumber(payload.baselineValue) ?? null,
          targetValue: readOptionalNumber(payload.targetValue) ?? null,
          currentValue: readOptionalNumber(payload.currentValue) ?? null,
          ownerUserId: readOptionalString(payload.ownerUserId) ?? null,
          kpiKind: readOptionalString(payload.kpiKind) ?? null,
          source: 'case-workspace-capability-adapter',
          reason: 'case_workspace_capability_kpi_create',
        });
      } catch (error) {
        throw new CapabilityHandlerError(
          'CAPABILITY_INPUT_INVALID',
          error instanceof Error ? error.name || 'kpi_create_rejected' : 'kpi_create_rejected'
        );
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'kpi',
        artifactId: definition.id,
        relation: 'OUTCOME_MEASUREMENT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          kpiId: definition.id,
          organizationId: definition.organizationId,
          initiativeId: definition.initiativeId,
          name: definition.fields.name,
          currentDefinitionVersion: definition.currentDefinitionVersion,
          artifactLink,
        },
        resultRef: resultRefFor('kpi', definition.id),
      };
    },
    validateOutput: (output) =>
      typeof output.kpiId === 'string' &&
      output.kpiId.length > 0 &&
      typeof output.name === 'string',
  };
}

export function registerKpiCreateAdapterBinding(deps: KpiAdapterDeps = {}): void {
  registerCapabilityBinding(KPI_CREATE_CAPABILITY_ID, KPI_CREATE_CAPABILITY_VERSION, buildKpiCreateBinding(deps));
}

export function kpiCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: KPI_CREATE_CAPABILITY_ID,
    capabilityVersion: KPI_CREATE_CAPABILITY_VERSION,
    ownerModule: 'results',
    providerType: 'INTERNAL',
    operation: 'createDefinition',
    owningCommandRef: 'command:kpi.create',
    inputSchemaRef: 'schema:case-workspace.kpi.create.input@1',
    outputSchemaRef: 'schema:case-workspace.kpi.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    reversibility: 'REVERSIBLE_VIA_ARCHIVE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 10_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

export async function registerKpiCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: KpiAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    kpiCreateRegistrationInput(params.createdByActorId),
    buildKpiCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

export async function getKpiReadback(id: string, organizationId: string): Promise<KpiDefinitionRecord | null> {
  return getCurrentDefinition(id, organizationId);
}
