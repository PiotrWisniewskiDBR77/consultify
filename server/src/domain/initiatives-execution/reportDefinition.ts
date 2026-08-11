import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type ReportDefinitionState = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'SUPERSEDED';
export interface ReportDefinitionContent {
  name: string;
  purpose: string;
  audience: string[];
  cadence: string;
  scope: {
    type: string;
    refs: string[];
    projectIds: string[];
    generalBacklogAllowed: boolean;
  };
  outputSchema: Record<string, unknown>;
  sections: Array<{ sectionId: string; title: string; mandatory: boolean }>;
  sourceBindings: Array<{
    bindingId: string;
    sourceType: string;
    required: boolean;
    scope: string;
  }>;
  formulas: Array<{
    formulaId: string;
    expression: string;
    unit: string | null;
    currency: string | null;
    windowId: string | null;
  }>;
  units: string[];
  currencies: string[];
  windows: Array<{ windowId: string; duration: string; timezone: string }>;
  access: { audienceRoles: string[]; classification: string };
  redaction: { rules: string[]; defaultState: 'FULL' | 'REDACTED' | 'DENIED' };
  freshnessThresholdMinutes: number;
  confidenceThreshold: 'HIGH' | 'MEDIUM' | 'LOW';
  ownerId: string;
  approverId: string;
}
export interface ReportDefinitionVersion extends ReportDefinitionContent {
  definitionVersion: number;
  state: ReportDefinitionState;
  validationFindings: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
}
export interface ReportDefinition {
  definitionId: string;
  tenantId: string;
  currentVersion: number;
  versions: ReportDefinitionVersion[];
  createdAt: string;
  updatedAt: string;
}

function validateContent(content: ReportDefinitionContent): string[] {
  const findings: string[] = [];
  if (!content.name.trim() || !content.purpose.trim()) findings.push('NAME_AND_PURPOSE_REQUIRED');
  if (!content.audience.length || !content.cadence.trim())
    findings.push('AUDIENCE_AND_CADENCE_REQUIRED');
  if (!content.scope.projectIds.length && !content.scope.generalBacklogAllowed)
    findings.push('PROJECT_SCOPE_REQUIRED');
  if (new Set(content.scope.projectIds).size !== content.scope.projectIds.length)
    findings.push('DUPLICATE_PROJECT_SCOPE');
  if (!content.sections.length || !content.sections.some((section) => section.mandatory))
    findings.push('MANDATORY_SECTION_REQUIRED');
  if (
    !content.sourceBindings.length ||
    content.sourceBindings.some((binding) => !binding.bindingId || !binding.sourceType)
  )
    findings.push('SOURCE_BINDING_REQUIRED');
  if (!Number.isFinite(content.freshnessThresholdMinutes) || content.freshnessThresholdMinutes <= 0)
    findings.push('FRESHNESS_THRESHOLD_REQUIRED');
  if (!content.ownerId || !content.approverId || content.ownerId === content.approverId)
    findings.push('INDEPENDENT_APPROVER_REQUIRED');
  const sectionIds = content.sections.map((section) => section.sectionId);
  if (new Set(sectionIds).size !== sectionIds.length) findings.push('DUPLICATE_SECTION_ID');
  const bindingIds = content.sourceBindings.map((binding) => binding.bindingId);
  if (new Set(bindingIds).size !== bindingIds.length) findings.push('DUPLICATE_SOURCE_BINDING_ID');
  return findings;
}

export function publishedReportDefinitionVersion(
  definition: ReportDefinition,
  version: number
): ReportDefinitionVersion | null {
  return (
    definition.versions.find(
      (item) => item.definitionVersion === version && item.state === 'PUBLISHED'
    ) ?? null
  );
}

export async function createReportDefinition(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ReportDefinitionContent>
): Promise<MaterialCommandResult<ReportDefinition>> {
  if (
    envelope.aggregateType !== 'report_definition' ||
    envelope.commandType !== 'report-definition.create'
  )
    throw new MaterialCommandValidationError('Invalid Report Definition create');
  if (envelope.actorId !== envelope.payload.ownerId)
    throw new MaterialCommandValidationError('Named owner creates Report Definition');
  return executeMaterialCommand(uow, envelope, async () => {
    const now = new Date().toISOString();
    const definition: ReportDefinition = {
      definitionId: envelope.aggregateId,
      tenantId: envelope.organizationId,
      currentVersion: 1,
      versions: [
        {
          ...envelope.payload,
          definitionVersion: 1,
          state: 'DRAFT',
          validationFindings: [],
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          publishedBy: null,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    return {
      mutation: definition,
      response: definition,
      eventType: 'report-definition.created',
      eventPayload: definition,
      auditPayload: definition,
    };
  });
}

type DefinitionAction =
  | { action: 'UPDATE_DRAFT'; patch: Partial<ReportDefinitionContent> }
  | { action: 'VALIDATE' }
  | { action: 'PUBLISH'; rationale: string }
  | { action: 'CREATE_VERSION'; patch: Partial<ReportDefinitionContent> };

export async function transitionReportDefinition(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<DefinitionAction>
): Promise<MaterialCommandResult<ReportDefinition>> {
  if (
    envelope.aggregateType !== 'report_definition' ||
    envelope.commandType !== 'report-definition.transition'
  )
    throw new MaterialCommandValidationError('Invalid Report Definition transition');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const definition = await tx.getAggregatePayload<ReportDefinition>(
      envelope.organizationId,
      'report_definition',
      envelope.aggregateId
    );
    if (!definition?.versions?.length)
      throw new MaterialCommandValidationError('Canonical Report Definition not found');
    const current = definition.versions.find(
      (item) => item.definitionVersion === definition.currentVersion
    );
    if (!current)
      throw new MaterialCommandValidationError('Current Report Definition version not found');
    const now = new Date().toISOString();
    let versions = definition.versions;
    let currentVersion = definition.currentVersion;
    if (envelope.payload.action === 'CREATE_VERSION') {
      if (current.state !== 'PUBLISHED' || envelope.actorId !== current.ownerId)
        throw new MaterialCommandValidationError(
          'Owner creates a new version from PUBLISHED truth'
        );
      currentVersion += 1;
      const next: ReportDefinitionVersion = {
        ...current,
        ...envelope.payload.patch,
        definitionVersion: currentVersion,
        state: 'DRAFT',
        validationFindings: [],
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        publishedBy: null,
      };
      versions = [...versions, next];
    } else if (envelope.payload.action === 'UPDATE_DRAFT') {
      if (current.state !== 'DRAFT' || envelope.actorId !== current.ownerId)
        throw new MaterialCommandValidationError('Owner updates current DRAFT only');
      versions = versions.map((item) =>
        item.definitionVersion === currentVersion
          ? { ...item, ...envelope.payload.patch, validationFindings: [], updatedAt: now }
          : item
      );
    } else if (envelope.payload.action === 'VALIDATE') {
      if (current.state !== 'DRAFT' || envelope.actorId !== current.ownerId)
        throw new MaterialCommandValidationError('Owner validates current DRAFT only');
      const findings = validateContent(current);
      if (findings.length)
        throw new MaterialCommandValidationError(
          `Report Definition validation failed: ${findings.join(',')}`
        );
      versions = versions.map((item) =>
        item.definitionVersion === currentVersion
          ? { ...item, state: 'VALIDATED' as const, validationFindings: [], updatedAt: now }
          : item
      );
    } else {
      if (
        current.state !== 'VALIDATED' ||
        envelope.actorId !== current.approverId ||
        current.ownerId === envelope.actorId ||
        !envelope.payload.rationale.trim()
      )
        throw new MaterialCommandValidationError(
          'Independent approver publishes VALIDATED definition with rationale'
        );
      versions = versions.map((item) =>
        item.definitionVersion === currentVersion
          ? {
              ...item,
              state: 'PUBLISHED' as const,
              publishedAt: now,
              publishedBy: envelope.actorId,
              updatedAt: now,
            }
          : item.state === 'PUBLISHED'
            ? { ...item, state: 'SUPERSEDED' as const, updatedAt: now }
            : item
      );
    }
    const next = { ...definition, currentVersion, versions, updatedAt: now };
    return {
      mutation: next,
      response: next,
      eventType: `report-definition.${envelope.payload.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: {
        definitionId: next.definitionId,
        currentVersion,
        action: envelope.payload.action,
      },
    };
  });
}
