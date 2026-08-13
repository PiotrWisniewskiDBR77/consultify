import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
type Residual = {
  residualId: string;
  type: 'TASK' | 'DECISION' | 'RISK';
  description: string;
  ownerId: string | null;
  dueAt: string;
  evidenceRefs: string[];
};
export interface BenefitsHandoffPack {
  packId: string;
  version: number;
  initiativeId: string;
  executionCaseId: string;
  deliveryDecisionId: string;
  acceptedOutcome: 'ACCEPT' | 'ACCEPT_WITH_RESIDUALS';
  baselineRef: { ref: string; version: number };
  scopeRef: { ref: string; version: number };
  deliverableRefs: Array<{ ref: string; version: number }>;
  milestoneRefs: Array<{ ref: string; version: number }>;
  residuals: Residual[];
  financeActualRefs: Array<{ ref: string; version: number }>;
  operationalHandoverRef: { ref: string; version: number };
  benefitOwnerId: string;
  kpiMeasurementContractRefs: Array<{ ref: string; version: number }>;
  createdAt: string;
}
export interface DeliveryAcceptanceCase {
  decisionId: string;
  initiativeId: string;
  executionCaseId: string;
  initiativeVersion: number;
  executionCaseVersion: number;
  authorityId: string;
  ownerId: string;
  status: 'PENDING' | 'ACCEPTED' | 'ACCEPTED_WITH_RESIDUALS' | 'RETURNED' | 'STOPPED';
  baselineRef: BenefitsHandoffPack['baselineRef'];
  scopeRef: BenefitsHandoffPack['scopeRef'];
  deliverableRefs: BenefitsHandoffPack['deliverableRefs'];
  milestoneRefs: BenefitsHandoffPack['milestoneRefs'];
  openTaskRefs: Array<{
    taskId: string;
    version: number;
    ownerId: string | null;
    evidenceRefs: string[];
  }>;
  openDecisionRefs: Array<{
    decisionId: string;
    version: number;
    ownerId: string | null;
    evidenceRefs: string[];
  }>;
  riskResiduals: Residual[];
  financeActualRefs: BenefitsHandoffPack['financeActualRefs'];
  operationalHandoverRef: BenefitsHandoffPack['operationalHandoverRef'];
  benefitOwnerId: string;
  kpiMeasurementContractRefs: BenefitsHandoffPack['kpiMeasurementContractRefs'];
  rationale: string | null;
  benefitsHandoffPackId: string | null;
  createdAt: string;
  updatedAt: string;
}
type Request = Omit<
  DeliveryAcceptanceCase,
  'decisionId' | 'status' | 'rationale' | 'benefitsHandoffPackId' | 'createdAt' | 'updatedAt'
>;
export function deliveryEvidenceFindings(
  p: Pick<
    Request,
    | 'baselineRef'
    | 'scopeRef'
    | 'deliverableRefs'
    | 'operationalHandoverRef'
    | 'benefitOwnerId'
    | 'kpiMeasurementContractRefs'
  >
) {
  const f: string[] = [];
  if (!p.baselineRef.ref) f.push('BASELINE_MISSING');
  if (!p.scopeRef.ref) f.push('SCOPE_MISSING');
  if (!p.deliverableRefs.length) f.push('DELIVERABLES_MISSING');
  if (!p.operationalHandoverRef.ref) f.push('OPERATIONAL_HANDOVER_MISSING');
  if (!p.benefitOwnerId) f.push('BENEFIT_OWNER_MISSING');
  if (!p.kpiMeasurementContractRefs.length) f.push('KPI_MEASUREMENT_CONTRACT_MISSING');
  return f;
}
async function exactParents(
  tx: MaterialCommandTransaction,
  org: string,
  p: {
    initiativeId: string;
    executionCaseId: string;
    initiativeVersion: number;
    executionCaseVersion: number;
  }
) {
  const i = await tx.getRelatedAggregateForUpdate<any>(org, 'initiative', p.initiativeId),
    c = await tx.getRelatedAggregateForUpdate<any>(org, 'execution_case', p.executionCaseId);
  if (
    !i ||
    i.version !== p.initiativeVersion ||
    i.payload.lifecycleState !== 'IN_EXECUTION' ||
    !c ||
    c.version !== p.executionCaseVersion ||
    c.payload.initiativeId !== p.initiativeId
  )
    throw new MaterialCommandValidationError(
      'Exact in-execution Initiative and Execution Case required'
    );
  return { i, c };
}
export async function requestDeliveryAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Request>
): Promise<MaterialCommandResult<DeliveryAcceptanceCase>> {
  if (
    envelope.aggregateType !== 'delivery_acceptance' ||
    envelope.commandType !== 'delivery-acceptance.request'
  )
    throw new MaterialCommandValidationError('Invalid delivery request');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    await exactParents(tx, envelope.organizationId, p);
    if (deliveryEvidenceFindings(p).length)
      throw new MaterialCommandValidationError('Delivery evidence and benefits ownership required');
    const now = new Date().toISOString(),
      value: DeliveryAcceptanceCase = {
        ...p,
        decisionId: envelope.aggregateId,
        status: 'PENDING',
        rationale: null,
        benefitsHandoffPackId: null,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: value,
      response: value,
      eventType: 'delivery-acceptance.requested',
      eventPayload: value,
      auditPayload: value,
    };
  });
}
type Decide = {
  outcome: 'ACCEPT' | 'ACCEPT_WITH_RESIDUALS' | 'RETURN' | 'STOP';
  rationale: string;
  packId: string;
};
export async function decideDeliveryAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Decide>
): Promise<MaterialCommandResult<DeliveryAcceptanceCase>> {
  if (
    envelope.aggregateType !== 'delivery_acceptance' ||
    envelope.commandType !== 'delivery-acceptance.decide'
  )
    throw new MaterialCommandValidationError('Invalid delivery decision');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const d = await tx.getAggregatePayload<DeliveryAcceptanceCase>(
      envelope.organizationId,
      'delivery_acceptance',
      envelope.aggregateId
    );
    if (
      !d ||
      d.status !== 'PENDING' ||
      envelope.actorId !== d.authorityId ||
      d.authorityId === d.ownerId
    )
      throw new MaterialCommandValidationError('Independent pending delivery decision required');
    const accept =
      envelope.payload.outcome === 'ACCEPT' || envelope.payload.outcome === 'ACCEPT_WITH_RESIDUALS';
    let packId: string | null = null;
    if (accept) {
      const residuals: Residual[] = [
        ...d.riskResiduals,
        ...d.openTaskRefs.map((x) => ({
          residualId: x.taskId,
          type: 'TASK' as const,
          description: 'Open delivery Task',
          ownerId: x.ownerId,
          dueAt: '',
          evidenceRefs: x.evidenceRefs,
        })),
        ...d.openDecisionRefs.map((x) => ({
          residualId: x.decisionId,
          type: 'DECISION' as const,
          description: 'Open delivery Decision',
          ownerId: x.ownerId,
          dueAt: '',
          evidenceRefs: x.evidenceRefs,
        })),
      ];
      if (residuals.some((r) => !r.ownerId || !r.evidenceRefs.length))
        throw new MaterialCommandValidationError('Open residuals require owner and evidence');
      if (envelope.payload.outcome === 'ACCEPT' && residuals.length)
        throw new MaterialCommandValidationError('Residuals require ACCEPT_WITH_RESIDUALS');
      const { i, c } = await exactParents(tx, envelope.organizationId, d);
      const now = new Date().toISOString(),
        pack: BenefitsHandoffPack = {
          packId: envelope.payload.packId,
          version: 1,
          initiativeId: d.initiativeId,
          executionCaseId: d.executionCaseId,
          deliveryDecisionId: d.decisionId,
          acceptedOutcome: envelope.payload.outcome as 'ACCEPT' | 'ACCEPT_WITH_RESIDUALS',
          baselineRef: d.baselineRef,
          scopeRef: d.scopeRef,
          deliverableRefs: d.deliverableRefs,
          milestoneRefs: d.milestoneRefs,
          residuals,
          financeActualRefs: d.financeActualRefs,
          operationalHandoverRef: d.operationalHandoverRef,
          benefitOwnerId: d.benefitOwnerId,
          kpiMeasurementContractRefs: d.kpiMeasurementContractRefs,
          createdAt: now,
        };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'initiative',
        d.initiativeId,
        i.version,
        i.version + 1,
        { ...i.payload, lifecycleState: 'DELIVERED', benefitsHandoffPackId: pack.packId }
      );
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'execution_case',
        d.executionCaseId,
        c.version,
        c.version + 1,
        { ...c.payload, deliveryState: 'DELIVERED', deliveryDecisionId: d.decisionId }
      );
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'benefits_handoff_pack',
        pack.packId,
        0,
        1,
        pack
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `DELIVERY_BENEFITS_PACK:${pack.packId}`,
        sourceType: 'delivery_acceptance',
        sourceId: d.decisionId,
        sourceVersion: envelope.expectedVersion + 1,
        targetType: 'benefits_handoff_pack',
        targetId: pack.packId,
        payload: { initiativeId: d.initiativeId },
      });
      packId = pack.packId;
    }
    const status: DeliveryAcceptanceCase['status'] =
      envelope.payload.outcome === 'ACCEPT'
        ? 'ACCEPTED'
        : envelope.payload.outcome === 'ACCEPT_WITH_RESIDUALS'
          ? 'ACCEPTED_WITH_RESIDUALS'
          : envelope.payload.outcome === 'RETURN'
            ? 'RETURNED'
            : 'STOPPED';
    const next = {
      ...d,
      status,
      rationale: envelope.payload.rationale,
      benefitsHandoffPackId: packId,
      updatedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: `delivery-acceptance.${status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export interface ResultsAcceptanceCase {
  resultsCaseId: string;
  packId: string;
  packVersion: number;
  initiativeId: string;
  authorityId: string;
  status: 'PENDING' | 'ACCEPTED' | 'ACCEPTED_WITH_GAPS' | 'REJECTED_WITH_BLOCKERS';
  gaps: Array<{ description: string; ownerId: string; dueAt: string }>;
  blockers: Array<{ description: string; ownerId: string; dueAt: string }>;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
}
export async function requestResultsAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    packId: string;
    packVersion: number;
    initiativeId: string;
    authorityId: string;
  }>
): Promise<MaterialCommandResult<ResultsAcceptanceCase>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload,
      pack = await tx.getRelatedAggregateForUpdate<BenefitsHandoffPack>(
        envelope.organizationId,
        'benefits_handoff_pack',
        p.packId
      ),
      i = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        p.initiativeId
      );
    if (
      !pack ||
      pack.version !== p.packVersion ||
      pack.payload.initiativeId !== p.initiativeId ||
      !i ||
      i.payload.lifecycleState !== 'DELIVERED'
    )
      throw new MaterialCommandValidationError('Exact delivered Benefits Handoff Pack required');
    const now = new Date().toISOString(),
      v: ResultsAcceptanceCase = {
        resultsCaseId: envelope.aggregateId,
        ...p,
        status: 'PENDING',
        gaps: [],
        blockers: [],
        rationale: null,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: v,
      response: v,
      eventType: 'results-acceptance.requested',
      eventPayload: v,
      auditPayload: v,
    };
  });
}
export async function decideResultsAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    outcome: 'ACCEPT' | 'ACCEPT_WITH_GAPS' | 'REJECT_WITH_BLOCKERS';
    rationale: string;
    gaps: Array<{ description: string; ownerId: string; dueAt: string }>;
    blockers: Array<{ description: string; ownerId: string; dueAt: string }>;
  }>
): Promise<MaterialCommandResult<ResultsAcceptanceCase>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const r = await tx.getAggregatePayload<ResultsAcceptanceCase>(
      envelope.organizationId,
      'results_acceptance',
      envelope.aggregateId
    );
    if (!r || r.status !== 'PENDING' || envelope.actorId !== r.authorityId)
      throw new MaterialCommandValidationError('Results authority decision required');
    const p = envelope.payload;
    if (p.outcome === 'ACCEPT_WITH_GAPS' && !p.gaps.length)
      throw new MaterialCommandValidationError('Gaps required');
    if (p.outcome === 'REJECT_WITH_BLOCKERS' && !p.blockers.length)
      throw new MaterialCommandValidationError('Blockers required');
    if (p.outcome !== 'REJECT_WITH_BLOCKERS') {
      const i = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'initiative',
        r.initiativeId
      );
      if (!i || i.payload.lifecycleState !== 'DELIVERED')
        throw new MaterialCommandValidationError('Initiative must remain DELIVERED');
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'initiative',
        r.initiativeId,
        i.version,
        i.version + 1,
        { ...i.payload, lifecycleState: 'BENEFITS_TRACKING', resultsCaseId: r.resultsCaseId }
      );
    }
    const status: ResultsAcceptanceCase['status'] =
        p.outcome === 'ACCEPT'
          ? 'ACCEPTED'
          : p.outcome === 'ACCEPT_WITH_GAPS'
            ? 'ACCEPTED_WITH_GAPS'
            : 'REJECTED_WITH_BLOCKERS',
      next = {
        ...r,
        status,
        gaps: p.gaps,
        blockers: p.blockers,
        rationale: p.rationale,
        updatedAt: new Date().toISOString(),
      };
    return {
      mutation: next,
      response: next,
      eventType: `results-acceptance.${status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
