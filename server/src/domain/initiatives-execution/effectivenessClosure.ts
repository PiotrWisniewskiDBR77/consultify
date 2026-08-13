import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { ResultsKpiObservation } from './resultsMeasurement.js';
export interface BenefitMeasurement {
  measurementId: string;
  contractRef: { ref: string; version: number };
  sourceRef: { ref: string; version: number };
  baseline: number | null;
  current: number | null;
  target: number | null;
  formula: string;
  unit: string;
  currency: string | null;
  window: { start: string; end: string };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  knowledgeState: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
  asOf: string;
  evidenceRefs: string[];
}
export interface EffectivenessCase {
  effectivenessCaseId: string;
  initiativeId: string;
  executionCaseId: string;
  benefitsHandoffPackRef: { packId: string; version: number };
  resultsAcceptanceRef: { resultsCaseId: string; version: number };
  observationRefs: Array<{ observationId: string; version: number }>;
  benefitOwnerId: string;
  reviewerId: string;
  closureAuthorityId: string;
  status:
    | 'TRACKING'
    | 'PENDING_REVIEW'
    | 'EFFECTIVE'
    | 'PARTIAL'
    | 'INEFFECTIVE'
    | 'NOT_VERIFIED'
    | 'REVIEWED'
    | 'CLOSED';
  measurements: BenefitMeasurement[];
  rationale: string | null;
  reviewOutcome?: 'CONFIRMED' | 'PARTIAL' | 'NOT_ACHIEVED' | 'RETURN_FOR_MEASUREMENT';
  effectivenessSnapshotId?: string | null;
  reviewHistory?: Array<{
    requestedOutcome: string;
    canonicalOutcome: 'CONFIRMED' | 'PARTIAL' | 'NOT_ACHIEVED' | 'RETURN_FOR_MEASUREMENT';
    reviewerId: string;
    rationale: string;
    reviewedAt: string;
    snapshotId: string;
  }>;
  closureSnapshotId: string | null;
  createdAt: string;
  updatedAt: string;
}
export function measurementFindings(m: BenefitMeasurement) {
  const f: string[] = [];
  if (
    m.knowledgeState === 'UNKNOWN' ||
    m.knowledgeState === 'UNCONFIRMED' ||
    m.baseline === null ||
    m.current === null ||
    m.target === null
  )
    f.push('MEASUREMENT_EVIDENCE_MISSING');
  if (m.confidence === 'UNKNOWN') f.push('CONFIDENCE_UNKNOWN');
  if (!m.evidenceRefs.length) f.push('EVIDENCE_REFS_MISSING');
  if (!m.sourceRef.ref || !m.sourceRef.version || !m.contractRef.ref || !m.contractRef.version)
    f.push('VERSIONED_SOURCE_OR_CONTRACT_MISSING');
  return f;
}
export async function createEffectivenessCase(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<
      EffectivenessCase,
      | 'effectivenessCaseId'
      | 'status'
      | 'measurements'
      | 'rationale'
      | 'closureSnapshotId'
      | 'createdAt'
      | 'updatedAt'
    >
  >
): Promise<MaterialCommandResult<EffectivenessCase>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload,
      i = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        p.initiativeId
      ),
      pack = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'benefits_handoff_pack',
        p.benefitsHandoffPackRef.packId
      ),
      results = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'results_acceptance',
        p.resultsAcceptanceRef.resultsCaseId
      );
    const observations: ResultsKpiObservation[] = [];
    for (const ref of p.observationRefs ?? []) {
      const observation = await tx.getRelatedAggregateForUpdate<ResultsKpiObservation>(
        envelope.organizationId,
        'results_kpi_observation',
        ref.observationId
      );
      if (
        !observation ||
        observation.version !== ref.version ||
        observation.payload.resultsCaseRef.resultsCaseId !== p.resultsAcceptanceRef.resultsCaseId ||
        observation.payload.resultsCaseRef.version !== p.resultsAcceptanceRef.version
      )
        throw new MaterialCommandValidationError('Exact accepted Results KPI observation required');
      observations.push(observation.payload);
    }
    if (
      !i ||
      i.payload.lifecycleState !== 'BENEFITS_TRACKING' ||
      !pack ||
      pack.version !== p.benefitsHandoffPackRef.version ||
      pack.payload.initiativeId !== p.initiativeId ||
      !results ||
      results.version !== p.resultsAcceptanceRef.version ||
      !['ACCEPTED', 'ACCEPTED_WITH_GAPS'].includes(results.payload.status) ||
      !observations.length
    )
      throw new MaterialCommandValidationError('Exact accepted benefits tracking lineage required');
    const now = new Date().toISOString(),
      v: EffectivenessCase = {
        ...p,
        effectivenessCaseId: envelope.aggregateId,
        status: 'TRACKING',
        measurements: [],
        rationale: null,
        effectivenessSnapshotId: null,
        reviewHistory: [],
        closureSnapshotId: null,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: v,
      response: v,
      eventType: 'effectiveness.tracking-started',
      eventPayload: v,
      auditPayload: v,
    };
  });
}
type EffectAction =
  | { action: 'RECORD'; measurement: BenefitMeasurement }
  | { action: 'REQUEST_REVIEW' }
  | {
      action: 'DECIDE';
      outcome:
        | 'CONFIRMED'
        | 'PARTIAL'
        | 'NOT_ACHIEVED'
        | 'RETURN_FOR_MEASUREMENT'
        | 'EFFECTIVE'
        | 'INEFFECTIVE'
        | 'NOT_VERIFIED';
      rationale: string;
      expectedInitiativeVersion: number;
      snapshotId: string;
    };

export interface EffectivenessSnapshot {
  snapshotId: string;
  initiativeId: string;
  executionCaseId: string;
  effectivenessCaseId: string;
  effectivenessVersion: number;
  outcome: 'CONFIRMED' | 'PARTIAL' | 'NOT_ACHIEVED' | 'RETURN_FOR_MEASUREMENT';
  measurements: BenefitMeasurement[];
  observations: ResultsKpiObservation[];
  benefitsHandoffPackRef: { packId: string; version: number };
  resultsAcceptanceRef: { resultsCaseId: string; version: number };
  rationale: string;
  reviewedBy: string;
  reviewedAt: string;
}
export function canonicalEffectivenessOutcome(outcome: string): EffectivenessSnapshot['outcome'] {
  if (outcome === 'EFFECTIVE') return 'CONFIRMED';
  if (outcome === 'INEFFECTIVE') return 'NOT_ACHIEVED';
  if (outcome === 'NOT_VERIFIED') return 'RETURN_FOR_MEASUREMENT';
  return outcome as EffectivenessSnapshot['outcome'];
}
export async function transitionEffectiveness(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<EffectAction>
): Promise<MaterialCommandResult<EffectivenessCase>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<EffectivenessCase>(
      envelope.organizationId,
      'effectiveness_case',
      envelope.aggregateId
    );
    if (!c) throw new MaterialCommandValidationError('Effectiveness case not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: EffectivenessCase;
    if (p.action === 'RECORD') {
      throw new MaterialCommandValidationError(
        'Local Effectiveness actuals are retired; use canonical Results KPI observations'
      );
    } else if (p.action === 'REQUEST_REVIEW') {
      if (
        c.status !== 'TRACKING' ||
        envelope.actorId !== c.benefitOwnerId ||
        !c.observationRefs.length
      )
        throw new MaterialCommandValidationError('Canonical Results observation refs required');
      next = { ...c, status: 'PENDING_REVIEW', updatedAt: now };
    } else {
      if (
        c.status !== 'PENDING_REVIEW' ||
        envelope.actorId !== c.reviewerId ||
        c.reviewerId === c.benefitOwnerId
      )
        throw new MaterialCommandValidationError('Independent effectiveness reviewer required');
      if (!p.rationale.trim() || !p.snapshotId.trim())
        throw new MaterialCommandValidationError(
          'Effectiveness rationale and snapshot identity required'
        );
      const initiative = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        c.initiativeId
      );
      if (
        !initiative ||
        initiative.version !== p.expectedInitiativeVersion ||
        initiative.payload.lifecycleState !== 'BENEFITS_TRACKING'
      )
        throw new MaterialCommandValidationError('Exact BENEFITS_TRACKING Initiative required');
      const outcome = canonicalEffectivenessOutcome(p.outcome);
      const observations: ResultsKpiObservation[] = [];
      for (const ref of c.observationRefs) {
        const observation = await tx.getRelatedAggregateForUpdate<ResultsKpiObservation>(
          envelope.organizationId,
          'results_kpi_observation',
          ref.observationId
        );
        if (!observation || observation.version !== ref.version)
          throw new MaterialCommandValidationError('Results KPI observation snapshot is stale');
        observations.push(observation.payload);
      }
      const snapshot: EffectivenessSnapshot = {
        snapshotId: p.snapshotId,
        initiativeId: c.initiativeId,
        executionCaseId: c.executionCaseId,
        effectivenessCaseId: c.effectivenessCaseId,
        effectivenessVersion: envelope.expectedVersion,
        outcome,
        measurements: c.measurements,
        observations,
        benefitsHandoffPackRef: c.benefitsHandoffPackRef,
        resultsAcceptanceRef: c.resultsAcceptanceRef,
        rationale: p.rationale,
        reviewedBy: envelope.actorId,
        reviewedAt: now,
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'effectiveness_snapshot',
        p.snapshotId,
        0,
        1,
        snapshot
      );
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'initiative',
        c.initiativeId,
        initiative.version,
        initiative.version + 1,
        {
          ...initiative.payload,
          lifecycleState: 'EFFECTIVENESS_REVIEWED',
          effectivenessSnapshotId: p.snapshotId,
        }
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `INITIATIVE_EFFECTIVENESS_SNAPSHOT:${p.snapshotId}`,
        sourceType: 'initiative',
        sourceId: c.initiativeId,
        sourceVersion: initiative.version + 1,
        targetType: 'effectiveness_snapshot',
        targetId: p.snapshotId,
        payload: { outcome },
      });
      next = {
        ...c,
        status: 'REVIEWED',
        reviewOutcome: outcome,
        rationale: p.rationale,
        effectivenessSnapshotId: p.snapshotId,
        reviewHistory: [
          ...(c.reviewHistory ?? []),
          {
            requestedOutcome: p.outcome,
            canonicalOutcome: outcome,
            reviewerId: envelope.actorId,
            rationale: p.rationale,
            reviewedAt: now,
            snapshotId: p.snapshotId,
          },
        ],
        updatedAt: now,
      };
    }
    return {
      mutation: next,
      response: next,
      eventType: `effectiveness.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export interface ClosureSnapshot {
  snapshotId: string;
  initiativeId: string;
  executionCaseId: string;
  effectivenessCaseId: string;
  effectivenessVersion: number;
  outcome: 'EFFECTIVE';
  measurementRefs: Array<{
    measurementId: string;
    sourceRef: { ref: string; version: number };
    asOf: string;
  }>;
  closedAt: string;
  closedBy: string;
  rationale: string;
}
export async function closeEffectiveInitiative(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    snapshotId: string;
    rationale: string;
    expectedInitiativeVersion: number;
    expectedExecutionCaseVersion: number;
  }>
): Promise<MaterialCommandResult<EffectivenessCase>> {
  throw new MaterialCommandValidationError(
    'Direct effectiveness close is retired; governed Closure Case decision is required'
  );
  /* compatibility signature retained so older clients fail closed with an explicit migration error */
  /* istanbul ignore next */
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<EffectivenessCase>(
      envelope.organizationId,
      'effectiveness_case',
      envelope.aggregateId
    );
    if (
      !c ||
      c.status !== 'EFFECTIVE' ||
      envelope.actorId !== c.closureAuthorityId ||
      c.closureAuthorityId === c.benefitOwnerId ||
      c.closureAuthorityId === c.reviewerId
    )
      throw new MaterialCommandValidationError(
        'Independent closure authority and EFFECTIVE outcome required'
      );
    const i = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        c.initiativeId
      ),
      ec = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'execution_case',
        c.executionCaseId
      );
    if (
      !i ||
      i.version !== envelope.payload.expectedInitiativeVersion ||
      i.payload.lifecycleState !== 'BENEFITS_TRACKING' ||
      !ec ||
      ec.version !== envelope.payload.expectedExecutionCaseVersion
    )
      throw new MaterialCommandValidationError('Exact closure parents required');
    const now = new Date().toISOString(),
      snap: ClosureSnapshot = {
        snapshotId: envelope.payload.snapshotId,
        initiativeId: c.initiativeId,
        executionCaseId: c.executionCaseId,
        effectivenessCaseId: c.effectivenessCaseId,
        effectivenessVersion: envelope.expectedVersion,
        outcome: 'EFFECTIVE',
        measurementRefs: c.measurements.map((m) => ({
          measurementId: m.measurementId,
          sourceRef: m.sourceRef,
          asOf: m.asOf,
        })),
        closedAt: now,
        closedBy: envelope.actorId,
        rationale: envelope.payload.rationale,
      };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'initiative',
      c.initiativeId,
      i.version,
      i.version + 1,
      { ...i.payload, lifecycleState: 'CLOSED', closureSnapshotId: snap.snapshotId }
    );
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'execution_case',
      c.executionCaseId,
      ec.version,
      ec.version + 1,
      { ...ec.payload, state: 'CLOSED', closureSnapshotId: snap.snapshotId }
    );
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'closure_snapshot',
      snap.snapshotId,
      0,
      1,
      snap
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `EFFECTIVENESS_CLOSURE:${snap.snapshotId}`,
      sourceType: 'effectiveness_case',
      sourceId: c.effectivenessCaseId,
      sourceVersion: envelope.expectedVersion + 1,
      targetType: 'closure_snapshot',
      targetId: snap.snapshotId,
      payload: { initiativeId: c.initiativeId },
    });
    const next = {
      ...c,
      status: 'CLOSED' as const,
      closureSnapshotId: snap.snapshotId,
      updatedAt: now,
    };
    return {
      mutation: next,
      response: next,
      eventType: 'effectiveness.closed',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export interface ArchiveManifest {
  archiveId: string;
  initiativeId: string;
  closureSnapshotRef: { snapshotId: string; version: number };
  retentionPolicyRef: { ref: string; version: number };
  exportRefs: Array<{ ref: string; version: number }>;
  archivedAt: string;
  archivedBy: string;
}
export async function archiveClosedInitiative(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    initiativeId: string;
    expectedInitiativeVersion: number;
    closureSnapshotRef: { snapshotId: string; version: number };
    retentionPolicyRef: { ref: string; version: number };
    legalHold: boolean;
    exportRefs: Array<{ ref: string; version: number }>;
  }>
): Promise<MaterialCommandResult<ArchiveManifest>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    if (p.legalHold) throw new MaterialCommandValidationError('Active legal hold blocks archive');
    const i = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        p.initiativeId
      ),
      snap = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'closure_snapshot',
        p.closureSnapshotRef.snapshotId
      );
    if (
      !i ||
      i.version !== p.expectedInitiativeVersion ||
      i.payload.lifecycleState !== 'CLOSED' ||
      !snap ||
      snap.version !== p.closureSnapshotRef.version ||
      snap.payload.initiativeId !== p.initiativeId ||
      !p.retentionPolicyRef.ref ||
      !p.exportRefs.length
    )
      throw new MaterialCommandValidationError(
        'Exact closure, retention and export evidence required'
      );
    const now = new Date().toISOString(),
      manifest: ArchiveManifest = {
        archiveId: envelope.aggregateId,
        initiativeId: p.initiativeId,
        closureSnapshotRef: p.closureSnapshotRef,
        retentionPolicyRef: p.retentionPolicyRef,
        exportRefs: p.exportRefs,
        archivedAt: now,
        archivedBy: envelope.actorId,
      };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'initiative',
      p.initiativeId,
      i.version,
      i.version + 1,
      { ...i.payload, lifecycleState: 'ARCHIVED', archiveManifestId: manifest.archiveId }
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_ARCHIVE:${manifest.archiveId}`,
      sourceType: 'closure_snapshot',
      sourceId: p.closureSnapshotRef.snapshotId,
      sourceVersion: p.closureSnapshotRef.version,
      targetType: 'archive_manifest',
      targetId: manifest.archiveId,
      payload: { initiativeId: p.initiativeId },
    });
    return {
      mutation: manifest,
      response: manifest,
      eventType: 'initiative.archived',
      eventPayload: manifest,
      auditPayload: manifest,
    };
  });
}
