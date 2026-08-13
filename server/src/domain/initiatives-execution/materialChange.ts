import { createHash } from 'node:crypto';

import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
type Target =
  | {
      kind: 'INITIATIVE_CARD';
      initiativeId: string;
      cardKey: string;
      version: number;
      initiativeVersion: number;
    }
  | {
      kind: 'PLANNING_BASELINE' | 'EXECUTION_BASELINE';
      aggregateType: 'plan_scenario' | 'execution_case';
      aggregateId: string;
      version: number;
    };
type Impact = {
  knowledgeState: 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
  refs: Array<{ ref: string; version: number }>;
};
export interface MaterialChangeProposal {
  proposalId: string;
  target: Target;
  oldSnapshot: Record<string, unknown>;
  newSnapshot: Record<string, unknown>;
  oldHash: string;
  newHash: string;
  diff: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  classification: 'NON_MATERIAL' | 'MATERIAL';
  tolerance: {
    policyRef: string;
    policyVersion: number;
    withinTolerance: boolean;
    rationale: string;
  };
  blastRadius: {
    tasks: Impact;
    decisions: Impact;
    milestones: Impact;
    risks: Impact;
    capacity: Impact;
    approvals: Impact;
    handoff: Impact;
  };
  reversibility: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
  governedInputRef?: {
    kind: 'CAPACITY_OPTION';
    comparisonId: string;
    comparisonVersion: number;
    optionId: string;
  };
  ownerId: string;
  authorityId: string;
  status:
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'CONDITIONALLY_APPROVED'
    | 'RETURNED'
    | 'REJECTED'
    | 'PUBLISHED';
  conditions: string[];
  rationale: string | null;
  publishedTargetVersion: number | null;
  createdAt: string;
  updatedAt: string;
}
function stable(v: any): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
export function materialSnapshotHash(v: Record<string, unknown>) {
  return createHash('sha256').update(stable(v)).digest('hex');
}
export function changeImpactFindings(
  p: Pick<
    MaterialChangeProposal,
    'oldSnapshot' | 'newSnapshot' | 'diff' | 'blastRadius' | 'reversibility'
  >
) {
  const f: string[] = [];
  if (materialSnapshotHash(p.oldSnapshot) === materialSnapshotHash(p.newSnapshot) || !p.diff.length)
    f.push('NO_EXACT_DIFF');
  for (const [k, v] of Object.entries(p.blastRadius))
    if (['UNKNOWN', 'UNCONFIRMED'].includes(v.knowledgeState))
      f.push(`${k.toUpperCase()}_IMPACT_UNKNOWN`);
  if (p.reversibility === 'UNKNOWN') f.push('REVERSIBILITY_UNKNOWN');
  return f;
}
async function assertTarget(
  tx: MaterialCommandTransaction,
  org: string,
  target: Target,
  old: Record<string, unknown>
) {
  if (target.kind === 'INITIATIVE_CARD') {
    const card = await tx.getLatestInitiativeCardForUpdate(
        org,
        target.initiativeId,
        target.cardKey
      ),
      initiative = await tx.getRelatedAggregateForUpdate<any>(
        org,
        'initiative',
        target.initiativeId
      );
    if (
      !card ||
      card.cardVersion !== target.version ||
      !initiative ||
      initiative.version !== target.initiativeVersion ||
      materialSnapshotHash(card.content) !== materialSnapshotHash(old)
    )
      throw new MaterialCommandValidationError('Stale published Initiative Card snapshot');
    return { card, initiative };
  }
  const a = await tx.getRelatedAggregateForUpdate<any>(
    org,
    target.aggregateType,
    target.aggregateId
  );
  if (
    !a ||
    a.version !== target.version ||
    materialSnapshotHash(a.payload) !== materialSnapshotHash(old)
  )
    throw new MaterialCommandValidationError('Stale baseline snapshot');
  return { aggregate: a };
}
type Draft = Omit<
  MaterialChangeProposal,
  | 'proposalId'
  | 'oldHash'
  | 'newHash'
  | 'status'
  | 'conditions'
  | 'rationale'
  | 'publishedTargetVersion'
  | 'createdAt'
  | 'updatedAt'
>;
export async function createMaterialChange(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Draft>
): Promise<MaterialCommandResult<MaterialChangeProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    await assertTarget(tx, envelope.organizationId, p.target, p.oldSnapshot);
    if (p.governedInputRef) {
      const input = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'capacity_options',
        p.governedInputRef.comparisonId
      );
      if (
        !input ||
        input.version !== p.governedInputRef.comparisonVersion ||
        input.payload.status !== 'SELECTED' ||
        input.payload.selectedOptionId !== p.governedInputRef.optionId ||
        input.payload.nextGovernedInput?.kind !== 'MATERIAL_CHANGE' ||
        input.payload.planRef?.scenarioId !==
          (p.target.kind === 'PLANNING_BASELINE' ? p.target.aggregateId : null) ||
        !input.payload.options?.some(
          (option: any) =>
            option.optionId === p.governedInputRef!.optionId && option.kind === 'RESEQUENCE'
        )
      )
        throw new MaterialCommandValidationError(
          'Exact selected RESEQUENCE Capacity Option input required'
        );
    }
    const findings = changeImpactFindings(p);
    if (findings.length)
      throw new MaterialCommandValidationError(`Material change incomplete: ${findings.join(',')}`);
    if (p.classification === 'NON_MATERIAL' && !p.tolerance.withinTolerance)
      throw new MaterialCommandValidationError('Outside tolerance change must be MATERIAL');
    const now = new Date().toISOString(),
      v: MaterialChangeProposal = {
        ...p,
        proposalId: envelope.aggregateId,
        oldHash: materialSnapshotHash(p.oldSnapshot),
        newHash: materialSnapshotHash(p.newSnapshot),
        status: 'DRAFT',
        conditions: [],
        rationale: null,
        publishedTargetVersion: null,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: v,
      response: v,
      eventType: 'material-change.drafted',
      eventPayload: v,
      auditPayload: v,
    };
  });
}
type Action =
  | { action: 'REQUEST' }
  | {
      action: 'DECIDE';
      outcome: 'APPROVE' | 'CONDITIONAL' | 'RETURN' | 'REJECT';
      conditions: string[];
      rationale: string;
    }
  | { action: 'PUBLISH' };
export async function transitionMaterialChange(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Action>
): Promise<MaterialCommandResult<MaterialChangeProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<MaterialChangeProposal>(
      envelope.organizationId,
      'material_change',
      envelope.aggregateId
    );
    if (!c) throw new MaterialCommandValidationError('Material change not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: MaterialChangeProposal;
    if (p.action === 'REQUEST') {
      if (c.status !== 'DRAFT' || envelope.actorId !== c.ownerId)
        throw new MaterialCommandValidationError('Owner requests DRAFT change');
      await assertTarget(tx, envelope.organizationId, c.target, c.oldSnapshot);
      if (changeImpactFindings(c).length)
        throw new MaterialCommandValidationError('Unknown impacts block request');
      next = { ...c, status: 'PENDING', updatedAt: now };
    } else if (p.action === 'DECIDE') {
      if (
        c.status !== 'PENDING' ||
        envelope.actorId !== c.authorityId ||
        c.authorityId === c.ownerId
      )
        throw new MaterialCommandValidationError('Independent authority required');
      if (p.outcome === 'CONDITIONAL' && !p.conditions.length)
        throw new MaterialCommandValidationError('Conditional approval requires conditions');
      const status =
        p.outcome === 'APPROVE'
          ? 'APPROVED'
          : p.outcome === 'CONDITIONAL'
            ? 'CONDITIONALLY_APPROVED'
            : p.outcome === 'RETURN'
              ? 'RETURNED'
              : 'REJECTED';
      next = { ...c, status, conditions: p.conditions, rationale: p.rationale, updatedAt: now };
    } else {
      if (
        !['APPROVED', 'CONDITIONALLY_APPROVED'].includes(c.status) ||
        envelope.actorId !== c.ownerId
      )
        throw new MaterialCommandValidationError('Approved change owner publishes');
      const target = await assertTarget(tx, envelope.organizationId, c.target, c.oldSnapshot);
      let published: number;
      if (c.target.kind === 'INITIATIVE_CARD') {
        const card = target.card!,
          initiative = target.initiative!,
          newVersion = c.target.version + 1;
        await tx.publishInitiativeCardVersion({
          organizationId: envelope.organizationId,
          initiativeId: c.target.initiativeId,
          cardKey: c.target.cardKey,
          cardVersion: newVersion,
          aggregateVersion: initiative.version + 1,
          applicability: card.applicability,
          completion: card.completion,
          quality: card.quality,
          freshness: 'CURRENT',
          reviewState: 'NOT_REQUESTED',
          content: c.newSnapshot,
          evidenceRefs: card.evidenceRefs,
          waiverDecisionId: card.waiverDecisionId,
          publishedBy: envelope.actorId,
        });
        await tx.persistRelatedAggregate(
          envelope.organizationId,
          'initiative',
          c.target.initiativeId,
          initiative.version,
          initiative.version + 1,
          { ...initiative.payload, updatedAt: now }
        );
        published = newVersion;
      } else {
        const a = target.aggregate!;
        await tx.persistRelatedAggregate(
          envelope.organizationId,
          c.target.aggregateType,
          c.target.aggregateId,
          a.version,
          a.version + 1,
          {
            ...c.newSnapshot,
            rebaseline: {
              materialChangeId: c.proposalId,
              oldVersion: a.version,
              approvedBy: c.authorityId,
            },
          }
        );
        published = a.version + 1;
      }
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `MATERIAL_CHANGE_TARGET:${c.proposalId}`,
        sourceType: 'material_change',
        sourceId: c.proposalId,
        sourceVersion: envelope.expectedVersion + 1,
        targetType:
          c.target.kind === 'INITIATIVE_CARD' ? 'initiative_card' : c.target.aggregateType,
        targetId:
          c.target.kind === 'INITIATIVE_CARD'
            ? `${c.target.initiativeId}:${c.target.cardKey}`
            : c.target.aggregateId,
        payload: {
          oldVersion: c.target.version,
          newVersion: published,
          oldHash: c.oldHash,
          newHash: c.newHash,
        },
      });
      next = { ...c, status: 'PUBLISHED', publishedTargetVersion: published, updatedAt: now };
    }
    return {
      mutation: next,
      response: next,
      eventType: `material-change.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
