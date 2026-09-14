import { createHash } from 'node:crypto';

import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  MaterialCommandRuleError,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type PortfolioAnalysisItemKind = 'OBSERVATION' | 'RECOMMENDATION' | 'DECISION';
export type PortfolioAnalysisCriterion =
  | 'COVERAGE_GAP'
  | 'OVERLAP'
  | 'PRIORITY'
  | 'NEW_VS_EXTENSION'
  | 'DECISION_HISTORY';

export interface PortfolioAnalysisEvidenceRef {
  initiativeId: string;
  field: string;
  source: 'initiativeUnifiedReader';
  sourceRef: string;
}

export interface PortfolioAnalysisSnapshot {
  snapshotVersion: number;
  organizationId: string;
  asOf: string;
  source: { system: 'initiativeUnifiedReader'; version: string; capturedAt: string };
  portfolio: {
    scenarioId: string;
    aggregateVersion: number;
    scenarioVersion: number;
    facts: Record<string, unknown>;
  };
  initiatives: Array<{
    initiativeId: string;
    initiativeVersion: number;
    projectId: string | null;
    source: 'CANONICAL';
    facts: Record<string, unknown>;
    evidenceRefs: [string];
  }>;
  decisionHistory: Array<{
    decisionId: string;
    version: number;
    initiativeId: string;
    sourceRef: string;
    facts: Record<string, unknown>;
  }>;
  runningWork: Array<{
    aggregateType: 'execution_case' | 'execution_task' | 'task';
    aggregateId: string;
    version: number;
    sourceRef: string;
    facts: Record<string, unknown>;
  }>;
  organizationContext: {
    snapshotId: string;
    version: number;
    contentHash: string;
    facts: Record<string, unknown>;
  };
}

export interface PortfolioAnalysisItem {
  itemId: string;
  position: number;
  kind: PortfolioAnalysisItemKind;
  criterion: PortfolioAnalysisCriterion;
  initiativeIds: string[];
  rationale: string;
  evidence: PortfolioAnalysisEvidenceRef[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  alternatives: string[];
  missingData: string[];
  proposedDisposition: null | {
    kind: 'IN' | 'PARKING' | 'ARCHIVE';
    reason: string;
    returnCondition: string | null;
  };
}

export interface PortfolioConsultingModelProvenance {
  runId: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  generatedAt: string;
}

export interface CapturedPortfolioConsultingAnalysis {
  analysisId: string;
  aggregateVersion: 1;
  status: 'CAPTURED';
  rubricVersion: string;
  requestDigest: string;
  snapshot: PortfolioAnalysisSnapshot;
  requestedBy: string;
}

export interface PortfolioConsultingAnalysis {
  analysisId: string;
  aggregateVersion: 2;
  status: 'PENDING_REVIEW';
  rubricVersion: string;
  requestDigest: string;
  snapshot: PortfolioAnalysisSnapshot;
  model: PortfolioConsultingModelProvenance;
  items: PortfolioAnalysisItem[];
  requestedBy: string;
}

export interface PortfolioConsultingModelGateway {
  analyze(input: {
    rubricVersion: string;
    requestDigest: string;
    snapshot: PortfolioAnalysisSnapshot;
  }): Promise<{ provenance: PortfolioConsultingModelProvenance; output: unknown }>;
}

export interface PortfolioConsultingAnalysisReader {
  find(
    organizationId: string,
    analysisId: string
  ): Promise<{
    version: number;
    analysis: CapturedPortfolioConsultingAnalysis | PortfolioConsultingAnalysis;
  } | null>;
}

export interface PortfolioConsultingAnalysisContextReader {
  findGovernedSnapshot(input: {
    organizationId: string;
    snapshotId: string;
    version: number;
  }): Promise<{ contentHash: string; snapshot: Record<string, unknown> } | null>;
}

const kinds: PortfolioAnalysisItemKind[] = ['OBSERVATION', 'RECOMMENDATION', 'DECISION'];
const criteria = new Set<PortfolioAnalysisCriterion>([
  'COVERAGE_GAP',
  'OVERLAP',
  'PRIORITY',
  'NEW_VS_EXTENSION',
  'DECISION_HISTORY',
]);
const confidences = new Set(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(source[key])}`)
    .join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function portfolioAnalysisRequestDigest(
  rubricVersion: string,
  snapshot: PortfolioAnalysisSnapshot
): string {
  return digest({ rubricVersion, snapshot });
}

export function validatePortfolioAnalysisSnapshot(snapshot: PortfolioAnalysisSnapshot): void {
  if (
    !record(snapshot) ||
    !record(snapshot.source) ||
    !record(snapshot.portfolio) ||
    !record(snapshot.organizationContext) ||
    !Array.isArray(snapshot.initiatives) ||
    !Array.isArray(snapshot.decisionHistory) ||
    !Array.isArray(snapshot.runningWork) ||
    !Number.isInteger(snapshot.snapshotVersion) ||
    snapshot.snapshotVersion < 1 ||
    !nonEmpty(snapshot.organizationId) ||
    !Number.isFinite(Date.parse(snapshot.asOf)) ||
    snapshot.source.system !== 'initiativeUnifiedReader' ||
    snapshot.source.version !== 'runtime-v1' ||
    !Number.isFinite(Date.parse(snapshot.source.capturedAt)) ||
    snapshot.source.capturedAt !== snapshot.asOf ||
    !nonEmpty(snapshot.portfolio.scenarioId) ||
    !Number.isInteger(snapshot.portfolio.aggregateVersion) ||
    snapshot.portfolio.aggregateVersion < 1 ||
    !Number.isInteger(snapshot.portfolio.scenarioVersion) ||
    snapshot.portfolio.scenarioVersion < 1 ||
    !record(snapshot.portfolio.facts) ||
    !nonEmpty(snapshot.organizationContext.snapshotId) ||
    !Number.isInteger(snapshot.organizationContext.version) ||
    snapshot.organizationContext.version < 1 ||
    !nonEmpty(snapshot.organizationContext.contentHash) ||
    !record(snapshot.organizationContext.facts) ||
    snapshot.organizationContext.facts.organizationId !== snapshot.organizationId ||
    snapshot.initiatives.length === 0
  )
    throw new MaterialCommandValidationError('Complete Portfolio analysis snapshot is required');
  if (
    snapshot.initiatives.some(
      (item) =>
        !record(item) ||
        !nonEmpty(item.initiativeId) ||
        !Number.isInteger(item.initiativeVersion) ||
        item.initiativeVersion < 1 ||
        item.source !== 'CANONICAL' ||
        !record(item.facts) ||
        Object.keys(item.facts).length === 0 ||
        !Array.isArray(item.evidenceRefs) ||
        item.evidenceRefs.length !== 1 ||
        item.evidenceRefs[0] !== `initiative:${item.initiativeId}:v${item.initiativeVersion}`
    )
  )
    throw new MaterialCommandValidationError('Exact Initiative versions and facts are required');
  const ids = snapshot.initiatives.map((item) => item.initiativeId);
  if (new Set(ids).size !== ids.length)
    throw new MaterialCommandValidationError(
      'Portfolio analysis Initiative identity must be unique'
    );
  if (
    snapshot.decisionHistory.some(
      (item) =>
        !record(item) ||
        !nonEmpty(item.decisionId) ||
        !Number.isInteger(item.version) ||
        item.version < 1 ||
        !ids.includes(item.initiativeId) ||
        item.sourceRef !== `decision:${item.decisionId}:v${item.version}` ||
        !record(item.facts)
    ) ||
    snapshot.runningWork.some(
      (item) =>
        !record(item) ||
        !['execution_case', 'execution_task', 'task'].includes(item.aggregateType) ||
        !nonEmpty(item.aggregateId) ||
        !Number.isInteger(item.version) ||
        item.version < 1 ||
        item.sourceRef !== `${item.aggregateType}:${item.aggregateId}:v${item.version}` ||
        !record(item.facts)
    )
  )
    throw new MaterialCommandValidationError(
      'Exact Portfolio decision history and running work references are required'
    );
  if (
    new Set(snapshot.decisionHistory.map((item) => item.decisionId)).size !==
      snapshot.decisionHistory.length ||
    new Set(snapshot.runningWork.map((item) => `${item.aggregateType}:${item.aggregateId}`))
      .size !== snapshot.runningWork.length
  )
    throw new MaterialCommandValidationError('Portfolio snapshot references must be unique');
}

function hasSnapshotField(
  source: PortfolioAnalysisSnapshot['initiatives'][number],
  field: string
): boolean {
  if (['initiativeId', 'initiativeVersion', 'projectId', 'source'].includes(field)) return true;
  if (!field.startsWith('facts.')) return false;
  const segments = field.slice('facts.'.length).split('.').filter(Boolean);
  let value: unknown = source.facts;
  for (const segment of segments) {
    const parent = record(value);
    if (!parent || !Object.prototype.hasOwnProperty.call(parent, segment)) return false;
    value = parent[segment];
  }
  return true;
}

export function parsePortfolioAnalysisItems(
  output: unknown,
  snapshot: PortfolioAnalysisSnapshot
): PortfolioAnalysisItem[] {
  const value = record(output);
  const rawItems = value?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    throw new MaterialCommandValidationError('Consulting analysis must return ordered items');
  const initiativeIds = new Set(snapshot.initiatives.map((item) => item.initiativeId));
  const parsed = rawItems.map((raw, index): PortfolioAnalysisItem => {
    const item = record(raw);
    const kind = item?.kind as PortfolioAnalysisItemKind;
    const criterion = item?.criterion as PortfolioAnalysisCriterion;
    const evidence = Array.isArray(item?.evidence) ? item.evidence : [];
    const affected = Array.isArray(item?.initiativeIds) ? item.initiativeIds : [];
    if (
      !item ||
      !nonEmpty(item.itemId) ||
      item.position !== index + 1 ||
      !kinds.includes(kind) ||
      !criteria.has(criterion) ||
      !nonEmpty(item.rationale) ||
      !confidences.has(String(item.confidence)) ||
      !Array.isArray(item.alternatives) ||
      !Array.isArray(item.missingData) ||
      affected.length === 0 ||
      affected.some((id) => !nonEmpty(id) || !initiativeIds.has(id)) ||
      new Set(affected).size !== affected.length ||
      evidence.length === 0
    )
      throw new MaterialCommandValidationError('Malformed Portfolio analysis item');
    const parsedEvidence = evidence.map((rawEvidence) => {
      const ref = record(rawEvidence);
      const source = snapshot.initiatives.find(
        (candidate) => candidate.initiativeId === ref?.initiativeId
      );
      if (
        !ref ||
        !nonEmpty(ref.initiativeId) ||
        !source ||
        !affected.includes(ref.initiativeId) ||
        !nonEmpty(ref.field) ||
        !hasSnapshotField(source, ref.field) ||
        ref.source !== 'initiativeUnifiedReader' ||
        ref.sourceRef !== source.evidenceRefs[0]
      )
        throw new MaterialCommandValidationError('Analysis evidence must name an Initiative field');
      return {
        initiativeId: ref.initiativeId,
        field: ref.field,
        source: 'initiativeUnifiedReader' as const,
        sourceRef: ref.sourceRef,
      };
    });
    const proposal = item.proposedDisposition;
    const parsedProposal = proposal === null ? null : record(proposal);
    if (proposal !== null && !parsedProposal)
      throw new MaterialCommandValidationError('Malformed proposed disposition');
    if (kind === 'DECISION' && !parsedProposal)
      throw new MaterialCommandValidationError('Decision item requires a proposed disposition');
    if (kind !== 'DECISION' && proposal !== null)
      throw new MaterialCommandValidationError('Only Decision items may propose a disposition');
    if (
      parsedProposal &&
      (!['IN', 'PARKING', 'ARCHIVE'].includes(String(parsedProposal.kind)) ||
        !nonEmpty(parsedProposal.reason) ||
        ((parsedProposal.kind === 'PARKING' || parsedProposal.kind === 'ARCHIVE') &&
          !nonEmpty(parsedProposal.returnCondition)))
    )
      throw new MaterialCommandValidationError('Complete proposed disposition is required');
    if (
      (item.alternatives as unknown[]).some((entry) => !nonEmpty(entry)) ||
      (item.missingData as unknown[]).some((entry) => !nonEmpty(entry))
    )
      throw new MaterialCommandValidationError(
        'Analysis alternatives and missing data must be explicit text'
      );
    return {
      itemId: item.itemId.trim(),
      position: index + 1,
      kind,
      criterion,
      initiativeIds: affected as string[],
      rationale: item.rationale.trim(),
      evidence: parsedEvidence,
      confidence: item.confidence as PortfolioAnalysisItem['confidence'],
      alternatives: (item.alternatives as string[]).map((entry) => entry.trim()),
      missingData: (item.missingData as string[]).map((entry) => entry.trim()),
      proposedDisposition: parsedProposal
        ? {
            kind: parsedProposal.kind as 'IN' | 'PARKING' | 'ARCHIVE',
            reason: String(parsedProposal.reason).trim(),
            returnCondition: nonEmpty(parsedProposal.returnCondition)
              ? parsedProposal.returnCondition.trim()
              : null,
          }
        : null,
    };
  });
  if (new Set(parsed.map((item) => item.itemId)).size !== parsed.length)
    throw new MaterialCommandValidationError('Portfolio analysis item identity must be unique');
  const order = parsed.map((item) => kinds.indexOf(item.kind));
  if (order.some((value, index) => index > 0 && value < order[index - 1]))
    throw new MaterialCommandValidationError(
      'Portfolio analysis order must be Observations, Recommendations, Decisions'
    );
  if (!kinds.every((kind) => parsed.some((item) => item.kind === kind)))
    throw new MaterialCommandValidationError(
      'Portfolio analysis must include Observations, Recommendations and Decisions'
    );
  return parsed;
}

async function assertExactSnapshot(
  tx: MaterialCommandTransaction,
  organizationId: string,
  snapshot: PortfolioAnalysisSnapshot,
  conflictOnDrift = false
): Promise<void> {
  const stale = (message: string): Error =>
    conflictOnDrift
      ? new MaterialCommandRuleError('PORTFOLIO_ANALYSIS_SOURCE_CONFLICT', 409, message)
      : new MaterialCommandValidationError(message);
  const portfolio = await tx.getRelatedAggregateForUpdate<{
    scenarioId?: unknown;
    scenarioVersion?: unknown;
  }>(organizationId, 'portfolio_scenario', snapshot.portfolio.scenarioId);
  if (
    !portfolio ||
    portfolio.version !== snapshot.portfolio.aggregateVersion ||
    portfolio.payload.scenarioId !== snapshot.portfolio.scenarioId ||
    portfolio.payload.scenarioVersion !== snapshot.portfolio.scenarioVersion ||
    canonical(portfolio.payload) !== canonical(snapshot.portfolio.facts)
  )
    throw stale('Exact Portfolio Scenario snapshot is stale');

  for (const source of snapshot.initiatives) {
    const current = await tx.getRelatedAggregateForUpdate<Record<string, unknown>>(
      organizationId,
      'initiative',
      source.initiativeId
    );
    if (
      !current ||
      current.version !== source.initiativeVersion ||
      current.payload.projectId !== source.projectId ||
      canonical(current.payload) !== canonical(source.facts)
    )
      throw stale('Exact Portfolio Initiative snapshot is stale');
  }
  for (const source of snapshot.decisionHistory) {
    const current = await tx.getRelatedAggregateForUpdate<{ initiativeId?: unknown }>(
      organizationId,
      'decision',
      source.decisionId
    );
    if (
      !current ||
      current.version !== source.version ||
      current.payload.initiativeId !== source.initiativeId ||
      canonical(current.payload) !== canonical(source.facts)
    )
      throw stale('Exact Portfolio Decision history is stale');
  }
  for (const source of snapshot.runningWork) {
    const current = await tx.getRelatedAggregateForUpdate<{ initiativeId?: unknown }>(
      organizationId,
      source.aggregateType,
      source.aggregateId
    );
    if (
      !current ||
      current.version !== source.version ||
      canonical(current.payload) !== canonical(source.facts) ||
      !snapshot.initiatives.some(
        (initiative) => initiative.initiativeId === current.payload.initiativeId
      )
    )
      throw stale('Exact Portfolio running work snapshot is stale');
  }
}

async function assertExactGovernedContext(
  reader: PortfolioConsultingAnalysisContextReader,
  organizationId: string,
  snapshot: PortfolioAnalysisSnapshot,
  conflictOnDrift = false
): Promise<void> {
  const context = await reader.findGovernedSnapshot({
    organizationId,
    snapshotId: snapshot.organizationContext.snapshotId,
    version: snapshot.organizationContext.version,
  });
  if (
    !context ||
    context.contentHash !== snapshot.organizationContext.contentHash ||
    canonical(context.snapshot) !== canonical(snapshot.organizationContext.facts)
  )
    throw conflictOnDrift
      ? new MaterialCommandRuleError(
          'PORTFOLIO_ANALYSIS_SOURCE_CONFLICT',
          409,
          'Exact governed organization snapshot is stale'
        )
      : new MaterialCommandValidationError('Exact governed organization snapshot is stale');
}

function validateModelProvenance(
  provenance: PortfolioConsultingModelProvenance,
  rubricVersion: string
): void {
  if (
    !record(provenance) ||
    !nonEmpty(provenance.runId) ||
    !nonEmpty(provenance.provider) ||
    !nonEmpty(provenance.modelId) ||
    !nonEmpty(provenance.modelVersion) ||
    provenance.promptVersion !== rubricVersion ||
    !Number.isFinite(Date.parse(provenance.generatedAt))
  )
    throw new MaterialCommandValidationError(
      'Complete bound Portfolio model provenance is required'
    );
}

export async function capturePortfolioConsultingAnalysis(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    rubricVersion: string;
    snapshot: PortfolioAnalysisSnapshot;
  }>,
  contextReader: PortfolioConsultingAnalysisContextReader
): Promise<MaterialCommandResult<CapturedPortfolioConsultingAnalysis>> {
  if (
    envelope.aggregateType !== 'portfolio_analysis' ||
    envelope.commandType !== 'portfolio.analysis.capture' ||
    envelope.expectedVersion !== 0 ||
    envelope.createIfMissing !== true
  )
    throw new MaterialCommandValidationError('Invalid Portfolio analysis capture command');
  validatePortfolioAnalysisSnapshot(envelope.payload.snapshot);
  if (envelope.payload.snapshot.organizationId !== envelope.organizationId)
    throw new MaterialCommandValidationError('Portfolio analysis tenant snapshot mismatch');
  if (!nonEmpty(envelope.payload.rubricVersion))
    throw new MaterialCommandValidationError('Portfolio analysis rubric version is required');
  const requestDigest = portfolioAnalysisRequestDigest(
    envelope.payload.rubricVersion,
    envelope.payload.snapshot
  );
  return executeMaterialCommand(uow, envelope, async (tx) => {
    await assertExactGovernedContext(
      contextReader,
      envelope.organizationId,
      envelope.payload.snapshot
    );
    await assertExactSnapshot(tx, envelope.organizationId, envelope.payload.snapshot);
    const capture: CapturedPortfolioConsultingAnalysis = {
      analysisId: envelope.aggregateId,
      aggregateVersion: 1,
      status: 'CAPTURED',
      rubricVersion: envelope.payload.rubricVersion.trim(),
      requestDigest,
      snapshot: envelope.payload.snapshot,
      requestedBy: envelope.actorId,
    };
    return {
      mutation: capture,
      response: capture,
      eventType: 'portfolio.analysis.captured',
      eventPayload: { analysisId: capture.analysisId, requestDigest, asOf: capture.snapshot.asOf },
      auditPayload: capture,
    };
  });
}

async function finalizePortfolioConsultingAnalysis(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    requestDigest: string;
    provenance: PortfolioConsultingModelProvenance;
    output: unknown;
  }>,
  contextReader: PortfolioConsultingAnalysisContextReader
): Promise<MaterialCommandResult<PortfolioConsultingAnalysis>> {
  if (
    envelope.aggregateType !== 'portfolio_analysis' ||
    envelope.commandType !== 'portfolio.analysis.finalize' ||
    envelope.expectedVersion !== 1 ||
    envelope.createIfMissing
  )
    throw new MaterialCommandValidationError('Invalid Portfolio analysis finalize command');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const current = await tx.getAggregatePayload<CapturedPortfolioConsultingAnalysis>(
      envelope.organizationId,
      'portfolio_analysis',
      envelope.aggregateId
    );
    if (
      !current ||
      current.status !== 'CAPTURED' ||
      current.aggregateVersion !== 1 ||
      current.requestDigest !== envelope.payload.requestDigest ||
      portfolioAnalysisRequestDigest(current.rubricVersion, current.snapshot) !==
        current.requestDigest
    )
      throw new MaterialCommandConflictError(
        'Portfolio analysis capture changed before finalize',
        1,
        1
      );
    await assertExactGovernedContext(
      contextReader,
      envelope.organizationId,
      current.snapshot,
      true
    );
    await assertExactSnapshot(tx, envelope.organizationId, current.snapshot, true);
    validateModelProvenance(envelope.payload.provenance, current.rubricVersion);
    const items = parsePortfolioAnalysisItems(envelope.payload.output, current.snapshot);
    const analysis: PortfolioConsultingAnalysis = {
      ...current,
      aggregateVersion: 2,
      status: 'PENDING_REVIEW',
      model: envelope.payload.provenance,
      items,
    };
    return {
      mutation: analysis,
      response: analysis,
      eventType: 'portfolio.analysis.created',
      eventPayload: {
        analysisId: analysis.analysisId,
        requestDigest: analysis.requestDigest,
        asOf: analysis.snapshot.asOf,
        modelRunId: analysis.model.runId,
        itemIds: analysis.items.map((item) => item.itemId),
      },
      auditPayload: analysis,
    };
  });
}

export async function runCapturedPortfolioConsultingAnalysis(input: {
  organizationId: string;
  actorId: string;
  analysisId: string;
  clientRequestId: string;
  correlationId: string;
  policyId: string;
  policyVersion: number;
  reader: PortfolioConsultingAnalysisReader;
  contextReader: PortfolioConsultingAnalysisContextReader;
  gateway: PortfolioConsultingModelGateway;
  uow: MaterialCommandUnitOfWork;
}): Promise<PortfolioConsultingAnalysis> {
  const persisted = await input.reader.find(input.organizationId, input.analysisId);
  if (!persisted) throw new MaterialCommandValidationError('Captured Portfolio analysis not found');
  if (persisted.analysis.status === 'PENDING_REVIEW') return persisted.analysis;
  if (persisted.version !== 1 || persisted.analysis.aggregateVersion !== 1)
    throw new MaterialCommandConflictError(
      'Captured Portfolio analysis version is stale',
      1,
      persisted.version
    );
  const generated = await input.gateway.analyze({
    rubricVersion: persisted.analysis.rubricVersion,
    requestDigest: persisted.analysis.requestDigest,
    snapshot: persisted.analysis.snapshot,
  });
  const result = await finalizePortfolioConsultingAnalysis(
    input.uow,
    {
      organizationId: input.organizationId,
      actorId: input.actorId,
      aggregateType: 'portfolio_analysis',
      aggregateId: input.analysisId,
      expectedVersion: 1,
      clientRequestId: input.clientRequestId,
      correlationId: input.correlationId,
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      commandType: 'portfolio.analysis.finalize',
      payload: {
        requestDigest: persisted.analysis.requestDigest,
        provenance: generated.provenance,
        output: generated.output,
      },
    },
    input.contextReader
  );
  return result.response;
}
