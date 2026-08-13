import { createHash } from 'node:crypto';

import { type MaterialChangeProposal, materialSnapshotHash } from './materialChange.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type SignalState = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export interface ManagementSignal {
  signalId: string;
  fingerprint: string;
  ruleId: string;
  sourceType: string;
  sourceId: string;
  sourceVersions: Record<string, number>;
  projectId: string;
  severity: 'WARNING' | 'CRITICAL';
  state: SignalState;
  occurrences: Array<{
    occurredAt: string;
    evidenceRef: string;
    sourceVersions: Record<string, number>;
  }>;
  createdAt: string;
  updatedAt: string;
}
export interface InterventionOption {
  optionId: string;
  kind: 'DO_NOTHING' | 'ACTION';
  label: string;
  impacts: Array<{ targetRef: string; effect: string }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  reversibility: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
}
export interface InterventionCase {
  interventionId: string;
  projectId: string;
  status:
    | 'DRAFT'
    | 'PENDING_DECISION'
    | 'APPROVED'
    | 'REJECTED'
    | 'APPLIED'
    | 'VERIFICATION_DUE'
    | 'CLOSED'
    | 'ESCALATED';
  signalRefs: Array<{ signalId: string; signalVersion: number; fingerprint: string }>;
  ownerId: string;
  authorityId: string;
  slaAt: string;
  hypotheses: string[];
  evidenceRefs: string[];
  counterEvidenceRefs: string[];
  unknowns: string[];
  blastRadiusRefs: Array<{ ref: string; version: number }>;
  options: InterventionOption[];
  selectedOptionId: string | null;
  rationale: string | null;
  targetCommand: {
    clientRequestId: string;
    aggregateType: string;
    aggregateId: string;
    aggregateVersion: number;
    commandType: string;
  } | null;
  planChange?: {
    planScenarioId: string;
    before: { version: number; hash: string };
    after: { version: number; hash: string };
    capacityOptionInput: {
      comparisonId: string;
      comparisonVersion: number;
      optionId: string;
    } | null;
    affected: {
      initiatives: Array<{ id: string; version: number }>;
      executionCases: Array<{ id: string; version: number }>;
      tasks: Array<{ id: string; version: number }>;
    };
  } | null;
  verifyBy: string | null;
  expectedEffect: string | null;
  measurementSource: { ref: string; version: number } | null;
  verification: {
    outcome: 'EFFECTIVE' | 'PARTIAL' | 'INEFFECTIVE' | 'NOT_VERIFIED';
    evidenceRefs: string[];
    verifiedAt: string;
    verifiedBy: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function managementSignalFingerprint(input: {
  ruleId: string;
  sourceType: string;
  sourceId: string;
}) {
  return createHash('sha256')
    .update(`${input.ruleId}\u0000${input.sourceType}\u0000${input.sourceId}`)
    .digest('hex');
}
async function projectForSignalSource(
  tx: MaterialCommandTransaction,
  org: string,
  sourceType: string,
  sourceId: string
): Promise<string | null> {
  if (sourceType === 'initiative') {
    const initiative = await tx.getRelatedAggregateForUpdate<any>(org, 'initiative', sourceId);
    return initiative?.payload?.projectId ?? null;
  }
  const source = await tx.getRelatedAggregateForUpdate<any>(org, sourceType, sourceId);
  if (!source) return null;
  if (source.payload.projectId) return source.payload.projectId;
  if (source.payload.initiativeId) {
    const initiative = await tx.getRelatedAggregateForUpdate<any>(
      org,
      'initiative',
      source.payload.initiativeId
    );
    return initiative?.payload?.projectId ?? null;
  }
  if (sourceType === 'capacity_scenario' && source.payload.planScenarioId) {
    const plan = await tx.getRelatedAggregateForUpdate<any>(
      org,
      'plan_scenario',
      source.payload.planScenarioId
    );
    if (!plan) return null;
    const portfolio = await tx.getRelatedAggregateForUpdate<any>(
      org,
      'portfolio_scenario',
      plan.payload.portfolioScenarioId
    );
    return portfolio?.payload?.scope?.portfolioId ?? null;
  }
  if (sourceType === 'plan_scenario') {
    const portfolio = await tx.getRelatedAggregateForUpdate<any>(
      org,
      'portfolio_scenario',
      source.payload.portfolioScenarioId
    );
    return portfolio?.payload?.scope?.portfolioId ?? null;
  }
  return null;
}
export function governedPlanTruthHash(payload: Record<string, unknown>) {
  const { rebaseline: _rebaseline, ...truth } = payload;
  return materialSnapshotHash(truth);
}

export async function ingestManagementSignal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<
      ManagementSignal,
      'signalId' | 'fingerprint' | 'projectId' | 'state' | 'occurrences' | 'createdAt' | 'updatedAt'
    > & { occurredAt: string; evidenceRef: string }
  >
): Promise<MaterialCommandResult<ManagementSignal>> {
  if (
    envelope.aggregateType !== 'management_signal' ||
    envelope.commandType !== 'management-signal.ingest'
  )
    throw new MaterialCommandValidationError('Invalid signal command');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload,
      fingerprint = managementSignalFingerprint(p);
    if (envelope.aggregateId !== fingerprint)
      throw new MaterialCommandValidationError(
        'Signal identity must equal deterministic fingerprint'
      );
    const projectId = await projectForSignalSource(
      tx,
      envelope.organizationId,
      p.sourceType,
      p.sourceId
    );
    if (!projectId)
      throw new MaterialCommandValidationError(
        'Canonical signal source project lineage is required'
      );
    const previous = await tx.getAggregatePayload<ManagementSignal>(
      envelope.organizationId,
      'management_signal',
      envelope.aggregateId
    );
    const now = new Date().toISOString();
    const occurrence = {
      occurredAt: p.occurredAt,
      evidenceRef: p.evidenceRef,
      sourceVersions: p.sourceVersions,
    };
    const signal: ManagementSignal = previous
      ? {
          ...previous,
          sourceVersions: p.sourceVersions,
          projectId,
          severity: p.severity,
          state: 'OPEN',
          occurrences: [...previous.occurrences, occurrence],
          updatedAt: now,
        }
      : {
          signalId: envelope.aggregateId,
          fingerprint,
          ruleId: p.ruleId,
          sourceType: p.sourceType,
          sourceId: p.sourceId,
          sourceVersions: p.sourceVersions,
          projectId,
          severity: p.severity,
          state: 'OPEN',
          occurrences: [occurrence],
          createdAt: now,
          updatedAt: now,
        };
    return {
      mutation: signal,
      response: signal,
      eventType: previous ? 'management-signal.reoccurred' : 'management-signal.created',
      eventPayload: signal,
      auditPayload: signal,
    };
  });
}

type CaseDraft = Omit<
  InterventionCase,
  | 'interventionId'
  | 'projectId'
  | 'status'
  | 'signalRefs'
  | 'selectedOptionId'
  | 'rationale'
  | 'targetCommand'
  | 'verifyBy'
  | 'expectedEffect'
  | 'measurementSource'
  | 'verification'
  | 'planChange'
  | 'createdAt'
  | 'updatedAt'
> & { signalRefs: Array<{ signalId: string; signalVersion: number; fingerprint: string }> };
export async function draftInterventionCase(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<CaseDraft>
): Promise<MaterialCommandResult<InterventionCase>> {
  if (
    envelope.aggregateType !== 'intervention_case' ||
    envelope.commandType !== 'intervention.draft'
  )
    throw new MaterialCommandValidationError('Invalid intervention draft');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    if (!p.options.some((o) => o.kind === 'DO_NOTHING'))
      throw new MaterialCommandValidationError('DO_NOTHING option is mandatory');
    const projects = new Set<string>();
    for (const ref of p.signalRefs) {
      const signal = await tx.getRelatedAggregateForUpdate<ManagementSignal>(
        envelope.organizationId,
        'management_signal',
        ref.signalId
      );
      if (
        !signal ||
        signal.version !== ref.signalVersion ||
        signal.payload.fingerprint !== ref.fingerprint
      )
        throw new MaterialCommandValidationError('Exact signal snapshot required');
      projects.add(signal.payload.projectId);
    }
    if (projects.size !== 1)
      throw new MaterialCommandValidationError(
        'All Intervention signals must resolve to one exact project'
      );
    const previous = await tx.getAggregatePayload<InterventionCase>(
        envelope.organizationId,
        'intervention_case',
        envelope.aggregateId
      ),
      now = new Date().toISOString();
    if (previous && previous.status !== 'DRAFT')
      throw new MaterialCommandValidationError('Only DRAFT case can merge signals');
    const refs = [...(previous?.signalRefs ?? [])];
    for (const r of p.signalRefs) if (!refs.some((x) => x.signalId === r.signalId)) refs.push(r);
    const value: InterventionCase = {
      ...p,
      interventionId: envelope.aggregateId,
      projectId: [...projects][0],
      status: 'DRAFT',
      signalRefs: refs,
      selectedOptionId: null,
      rationale: null,
      targetCommand: null,
      verifyBy: null,
      expectedEffect: null,
      measurementSource: null,
      verification: null,
      planChange: null,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    for (const r of p.signalRefs)
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `INTERVENTION_SIGNAL:${r.signalId}`,
        sourceType: 'management_signal',
        sourceId: r.signalId,
        sourceVersion: r.signalVersion,
        targetType: 'intervention_case',
        targetId: envelope.aggregateId,
        payload: { fingerprint: r.fingerprint },
      });
    return {
      mutation: value,
      response: value,
      eventType: previous ? 'intervention.signals-merged' : 'intervention.drafted',
      eventPayload: value,
      auditPayload: value,
    };
  });
}

type CaseAction =
  | { action: 'REQUEST' }
  | {
      action: 'DECIDE';
      outcome: 'APPROVED' | 'REJECTED';
      selectedOptionId: string;
      rationale: string;
    }
  | {
      action: 'APPLY';
      targetReceiptClientRequestId: string;
      targetAggregateType: 'operational_allocation' | 'execution_task';
      targetAggregateId: string;
      expectedTargetVersion: number;
      expectedTargetState: string;
      verifyBy: string;
      expectedEffect: string;
      measurementSource: { ref: string; version: number };
    }
  | {
      action: 'APPLY';
      targetReceiptClientRequestId: string;
      targetAggregateType: 'material_change';
      targetAggregateId: string;
      expectedTargetVersion: number;
      expectedTargetState: 'PUBLISHED';
      planChange: {
        planScenarioId: string;
        oldVersion: number;
        newVersion: number;
        oldHash: string;
        newHash: string;
        selectedCapacityOptionRef: {
          comparisonId: string;
          comparisonVersion: number;
          optionId: string;
        } | null;
        affected: {
          initiatives: Array<{ id: string; version: number }>;
          executionCases: Array<{ id: string; version: number }>;
          tasks: Array<{ id: string; version: number }>;
        };
      };
      verifyBy: string;
      expectedEffect: string;
      measurementSource: { ref: string; version: number };
    }
  | {
      action: 'VERIFY';
      outcome: 'EFFECTIVE' | 'PARTIAL' | 'INEFFECTIVE' | 'NOT_VERIFIED';
      evidenceRefs: string[];
    };
export async function transitionInterventionCase(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<CaseAction>
): Promise<MaterialCommandResult<InterventionCase>> {
  if (
    envelope.aggregateType !== 'intervention_case' ||
    envelope.commandType !== 'intervention.transition'
  )
    throw new MaterialCommandValidationError('Invalid intervention transition');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<InterventionCase>(
      envelope.organizationId,
      'intervention_case',
      envelope.aggregateId
    );
    if (!c) throw new MaterialCommandValidationError('Intervention not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: InterventionCase;
    if (p.action === 'REQUEST') {
      if (c.status !== 'DRAFT' || envelope.actorId !== c.ownerId)
        throw new MaterialCommandValidationError('Owner can request a DRAFT intervention');
      if (!c.options.some((o) => o.kind === 'DO_NOTHING'))
        throw new MaterialCommandValidationError('DO_NOTHING option is mandatory');
      next = { ...c, status: 'PENDING_DECISION', updatedAt: now };
    } else if (p.action === 'DECIDE') {
      if (
        c.status !== 'PENDING_DECISION' ||
        envelope.actorId !== c.authorityId ||
        c.authorityId === c.ownerId
      )
        throw new MaterialCommandValidationError('Independent authority decision required');
      if (!c.options.some((o) => o.optionId === p.selectedOptionId))
        throw new MaterialCommandValidationError('Selected option is not in case');
      next = {
        ...c,
        status: p.outcome,
        selectedOptionId: p.selectedOptionId,
        rationale: p.rationale,
        updatedAt: now,
      };
    } else if (p.action === 'APPLY') {
      if (c.status !== 'APPROVED' || envelope.actorId !== c.ownerId)
        throw new MaterialCommandValidationError('Approved intervention owner must apply');
      const receipt = await tx.findReceipt<any>(
        envelope.organizationId,
        p.targetReceiptClientRequestId
      );
      if (
        !receipt ||
        receipt.aggregateType !== p.targetAggregateType ||
        receipt.aggregateId !== p.targetAggregateId ||
        receipt.aggregateVersion !== p.expectedTargetVersion
      )
        throw new MaterialCommandValidationError('Canonical target command receipt required');
      const target = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        p.targetAggregateType,
        p.targetAggregateId
      );
      if (
        !target ||
        target.version !== p.expectedTargetVersion ||
        String(target.payload.status) !== p.expectedTargetState
      )
        throw new MaterialCommandValidationError('Canonical target readback mismatch');
      let planChange: InterventionCase['planChange'] = null;
      if (p.targetAggregateType === 'material_change') {
        const change = target.payload as MaterialChangeProposal;
        if (
          receipt.commandType !== 'material-change.transition' ||
          change.status !== 'PUBLISHED' ||
          change.target.kind !== 'PLANNING_BASELINE' ||
          change.target.aggregateType !== 'plan_scenario' ||
          change.target.aggregateId !== p.planChange.planScenarioId ||
          change.target.version !== p.planChange.oldVersion ||
          change.publishedTargetVersion !== p.planChange.newVersion ||
          change.oldHash !== p.planChange.oldHash ||
          change.newHash !== p.planChange.newHash
        )
          throw new MaterialCommandValidationError('Exact published Plan Material Change required');
        const plan = await tx.getRelatedAggregateForUpdate<any>(
          envelope.organizationId,
          'plan_scenario',
          p.planChange.planScenarioId
        );
        if (!plan || plan.version !== p.planChange.newVersion) {
          throw new MaterialCommandValidationError('Published Plan readback version mismatch');
        }
        if (governedPlanTruthHash(plan.payload) !== p.planChange.newHash)
          throw new MaterialCommandValidationError('Published Plan readback hash mismatch');
        const expectedInput = change.governedInputRef
          ? {
              comparisonId: change.governedInputRef.comparisonId,
              comparisonVersion: change.governedInputRef.comparisonVersion,
              optionId: change.governedInputRef.optionId,
            }
          : null;
        if (
          JSON.stringify(expectedInput) !== JSON.stringify(p.planChange.selectedCapacityOptionRef)
        )
          throw new MaterialCommandValidationError('Selected Capacity Option lineage mismatch');
        for (const [aggregateType, refs] of [
          ['initiative', p.planChange.affected.initiatives],
          ['execution_case', p.planChange.affected.executionCases],
          ['execution_task', p.planChange.affected.tasks],
        ] as const)
          for (const ref of refs) {
            const affected = await tx.getRelatedAggregateForUpdate<any>(
              envelope.organizationId,
              aggregateType,
              ref.id
            );
            if (!affected || affected.version !== ref.version)
              throw new MaterialCommandValidationError('Affected object reference is stale');
          }
        planChange = {
          planScenarioId: p.planChange.planScenarioId,
          before: { version: p.planChange.oldVersion, hash: p.planChange.oldHash },
          after: { version: p.planChange.newVersion, hash: p.planChange.newHash },
          capacityOptionInput: p.planChange.selectedCapacityOptionRef,
          affected: p.planChange.affected,
        };
        await tx.claimRelation({
          organizationId: envelope.organizationId,
          relationType: `PLAN_INTERVENTION:${c.interventionId}`,
          sourceType: 'plan_scenario',
          sourceId: p.planChange.planScenarioId,
          sourceVersion: p.planChange.newVersion,
          targetType: 'intervention_case',
          targetId: c.interventionId,
          payload: {
            materialChangeId: change.proposalId,
            before: planChange.before,
            after: planChange.after,
          },
        });
      }
      next = {
        ...c,
        status: 'VERIFICATION_DUE',
        targetCommand: {
          clientRequestId: p.targetReceiptClientRequestId,
          aggregateType: receipt.aggregateType,
          aggregateId: receipt.aggregateId,
          aggregateVersion: receipt.aggregateVersion,
          commandType: receipt.commandType,
        },
        verifyBy: p.verifyBy,
        expectedEffect: p.expectedEffect,
        measurementSource: p.measurementSource,
        planChange,
        updatedAt: now,
      };
    } else {
      if (c.status !== 'VERIFICATION_DUE')
        throw new MaterialCommandValidationError('Applied intervention is required');
      if (envelope.actorId === c.ownerId)
        throw new MaterialCommandValidationError('Independent verification required');
      next = {
        ...c,
        status: p.outcome === 'EFFECTIVE' ? 'CLOSED' : 'ESCALATED',
        verification: {
          outcome: p.outcome,
          evidenceRefs: p.evidenceRefs,
          verifiedAt: now,
          verifiedBy: envelope.actorId,
        },
        updatedAt: now,
      };
    }
    return {
      mutation: next,
      response: next,
      eventType: `intervention.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
