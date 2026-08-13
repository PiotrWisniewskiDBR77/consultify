import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface FinanceReconciliation {
  reconciliationId: string;
  projectId: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'STALE';
  sourceRef: { ref: string; version: number };
  asOf: string;
  currency: string;
  amount: number | null;
  rationale: string;
  ownerId: string;
  createdAt: string;
}
export interface ResultsKpiObservation {
  observationId: string;
  resultsCaseRef: { resultsCaseId: string; version: number };
  kpiId: string;
  baselineValue: number | null;
  observedValue: number | null;
  targetValue: number | null;
  formula: string;
  unit: string;
  currency: string | null;
  window: { start: string; end: string; cadence: string };
  sourceRef: { ref: string; version: number };
  asOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  knowledgeState: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
  measurementState: 'MEASURED' | 'NOT_MEASURED';
  financeReconciliationRef: { reconciliationId: string; version: number } | null;
  rationale: string;
  producerId: string;
  createdAt: string;
}
export function resultsObservationFindings(
  observation: Omit<ResultsKpiObservation, 'observationId' | 'createdAt'>,
  finance: FinanceReconciliation | null
) {
  const findings: string[] = [];
  if (observation.measurementState === 'MEASURED') {
    if (
      observation.observedValue === null ||
      !Number.isFinite(observation.observedValue) ||
      ['UNKNOWN', 'UNCONFIRMED'].includes(observation.knowledgeState) ||
      observation.confidence === 'UNKNOWN'
    )
      findings.push('AUTHORITATIVE_VALUE_REQUIRED');
    if (
      observation.currency &&
      (!finance ||
        finance.status !== 'AVAILABLE' ||
        finance.currency !== observation.currency ||
        Date.parse(finance.asOf) < Date.parse(observation.asOf))
    )
      findings.push('FINANCE_RECONCILIATION_UNAVAILABLE_OR_STALE');
  } else if (
    observation.observedValue !== null ||
    !['UNKNOWN', 'UNCONFIRMED'].includes(observation.knowledgeState)
  )
    findings.push('NOT_MEASURED_MUST_NOT_INVENT_VALUE');
  return findings;
}

export async function createFinanceReconciliation(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Omit<FinanceReconciliation, 'reconciliationId' | 'createdAt'>>
): Promise<MaterialCommandResult<FinanceReconciliation>> {
  if (
    envelope.aggregateType !== 'finance_reconciliation' ||
    envelope.commandType !== 'finance-reconciliation.create'
  )
    throw new MaterialCommandValidationError('Invalid Finance reconciliation create');
  return executeMaterialCommand(uow, envelope, async () => {
    const p = envelope.payload;
    if (
      envelope.actorId !== p.ownerId ||
      !p.projectId.trim() ||
      !p.sourceRef.ref ||
      p.sourceRef.version < 1 ||
      !Number.isFinite(Date.parse(p.asOf)) ||
      !p.currency.trim() ||
      !p.rationale.trim()
    )
      throw new MaterialCommandValidationError(
        'Exact Finance project, source, owner, currency, asOf and rationale required'
      );
    if ((p.status === 'AVAILABLE') !== (p.amount !== null && Number.isFinite(p.amount)))
      throw new MaterialCommandValidationError(
        'AVAILABLE Finance reconciliation requires amount; unavailable/stale must not invent amount'
      );
    const item = {
      ...p,
      reconciliationId: envelope.aggregateId,
      createdAt: new Date().toISOString(),
    };
    return {
      mutation: item,
      response: item,
      eventType: 'finance-reconciliation.created',
      eventPayload: item,
      auditPayload: item,
    };
  });
}

export async function createResultsKpiObservation(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Omit<ResultsKpiObservation, 'observationId' | 'createdAt'>>
): Promise<MaterialCommandResult<ResultsKpiObservation>> {
  if (
    envelope.aggregateType !== 'results_kpi_observation' ||
    envelope.commandType !== 'results-observation.create'
  )
    throw new MaterialCommandValidationError('Invalid Results KPI observation create');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    const results = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'results_acceptance',
      p.resultsCaseRef.resultsCaseId
    );
    if (
      !results ||
      results.version !== p.resultsCaseRef.version ||
      !['ACCEPTED', 'ACCEPTED_WITH_GAPS'].includes(results.payload.status)
    )
      throw new MaterialCommandValidationError('Exact accepted Results Case required');
    if (
      envelope.actorId !== p.producerId ||
      !p.kpiId.trim() ||
      !p.formula.trim() ||
      !p.unit.trim() ||
      !p.sourceRef.ref ||
      p.sourceRef.version < 1 ||
      !Number.isFinite(Date.parse(p.asOf)) ||
      !Number.isFinite(Date.parse(p.window.start)) ||
      !Number.isFinite(Date.parse(p.window.end)) ||
      !p.window.cadence.trim() ||
      !p.rationale.trim()
    )
      throw new MaterialCommandValidationError(
        'Versioned Results observation evidence is incomplete'
      );
    let finance: { version: number; payload: FinanceReconciliation } | null = null;
    if (p.financeReconciliationRef)
      finance = await tx.getRelatedAggregateForUpdate<FinanceReconciliation>(
        envelope.organizationId,
        'finance_reconciliation',
        p.financeReconciliationRef.reconciliationId
      );
    if (
      p.financeReconciliationRef &&
      (!finance || finance.version !== p.financeReconciliationRef.version)
    )
      throw new MaterialCommandValidationError('Exact Finance reconciliation required');
    const findings = resultsObservationFindings(p, finance?.payload ?? null);
    if (findings.length) throw new MaterialCommandValidationError(findings.join(','));
    const item = { ...p, observationId: envelope.aggregateId, createdAt: new Date().toISOString() };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `RESULTS_OBSERVATION:${item.observationId}`,
      sourceType: 'results_acceptance',
      sourceId: p.resultsCaseRef.resultsCaseId,
      sourceVersion: p.resultsCaseRef.version,
      targetType: 'results_kpi_observation',
      targetId: item.observationId,
      payload: { kpiId: item.kpiId, measurementState: item.measurementState },
    });
    return {
      mutation: item,
      response: item,
      eventType: 'results-observation.created',
      eventPayload: item,
      auditPayload: item,
    };
  });
}
