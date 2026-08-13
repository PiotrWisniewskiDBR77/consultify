import { createHash } from 'node:crypto';

import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
export interface AIAnalysisProposal {
  proposalId: string;
  initiativeId: string;
  initiativeVersion: number;
  cardKey: string;
  cardVersion: number;
  sourceRef: { aggregateType: string; aggregateId: string; version: number };
  model: { provider: string; model: string; version: string };
  prompt: { promptId: string; version: number };
  template: { templateId: string; version: number };
  inputHash: string;
  output: Record<string, unknown>;
  evidenceRefs: Array<{ ref: string; version: number }>;
  counterEvidenceRefs: Array<{ ref: string; version: number }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  requestedBy: string;
  authorizedReviewerId: string;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
  review: {
    outcome: 'ACCEPT' | 'EDIT' | 'REJECT';
    reviewerId: string;
    rationale: string;
    truthFragment: Record<string, unknown> | null;
    reviewedAt: string;
  } | null;
  publishedCardVersion: number | null;
  createdAt: string;
  updatedAt: string;
}
export function aiInputHash(v: unknown) {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex');
}
type Draft = Omit<
  AIAnalysisProposal,
  'proposalId' | 'status' | 'review' | 'publishedCardVersion' | 'createdAt' | 'updatedAt'
>;
async function exact(
  tx: MaterialCommandTransaction,
  org: string,
  p: Pick<
    AIAnalysisProposal,
    'initiativeId' | 'initiativeVersion' | 'cardKey' | 'cardVersion' | 'sourceRef'
  >
) {
  const i = await tx.getRelatedAggregateForUpdate<any>(org, 'initiative', p.initiativeId),
    card = await tx.getLatestInitiativeCardForUpdate(org, p.initiativeId, p.cardKey),
    source = await tx.getRelatedAggregateForUpdate<any>(
      org,
      p.sourceRef.aggregateType,
      p.sourceRef.aggregateId
    );
  if (
    !i ||
    i.version !== p.initiativeVersion ||
    !card ||
    card.cardVersion !== p.cardVersion ||
    !source ||
    source.version !== p.sourceRef.version
  )
    throw new MaterialCommandValidationError('Stale Initiative Card or source snapshot');
  return { i, card, source };
}
export async function createAIAnalysisProposal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Draft>
): Promise<MaterialCommandResult<AIAnalysisProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    await exact(tx, envelope.organizationId, p);
    if (
      !p.inputHash ||
      !p.model.provider ||
      !p.model.model ||
      !p.prompt.version ||
      !p.template.version ||
      !Object.keys(p.output).length ||
      !p.evidenceRefs.length ||
      p.confidence === 'UNKNOWN'
    )
      throw new MaterialCommandValidationError('Complete AI provenance and evidence required');
    const now = new Date().toISOString(),
      v: AIAnalysisProposal = {
        ...p,
        proposalId: envelope.aggregateId,
        status: 'PENDING_REVIEW',
        review: null,
        publishedCardVersion: null,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: v,
      response: v,
      eventType: 'ai-analysis.proposed',
      eventPayload: v,
      auditPayload: v,
    };
  });
}
export async function reviewAIAnalysisProposal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    outcome: 'ACCEPT' | 'EDIT' | 'REJECT';
    rationale: string;
    editedFragment: Record<string, unknown> | null;
  }>
): Promise<MaterialCommandResult<AIAnalysisProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = await tx.getAggregatePayload<AIAnalysisProposal>(
      envelope.organizationId,
      'ai_analysis_proposal',
      envelope.aggregateId
    );
    if (
      !p ||
      p.status !== 'PENDING_REVIEW' ||
      envelope.actorId !== p.authorizedReviewerId ||
      p.requestedBy === p.authorizedReviewerId
    )
      throw new MaterialCommandValidationError('Authorized independent human review required');
    const c = envelope.payload;
    if (c.outcome === 'EDIT' && (!c.editedFragment || !Object.keys(c.editedFragment).length))
      throw new MaterialCommandValidationError('Edited truth fragment required');
    let published: number | null = null,
      truth: Record<string, unknown> | null = null;
    if (c.outcome !== 'REJECT') {
      const { i, card } = await exact(tx, envelope.organizationId, p);
      truth = c.outcome === 'EDIT' ? c.editedFragment : p.output;
      const newVersion = p.cardVersion + 1;
      await tx.publishInitiativeCardVersion({
        organizationId: envelope.organizationId,
        initiativeId: p.initiativeId,
        cardKey: p.cardKey,
        cardVersion: newVersion,
        aggregateVersion: i.version + 1,
        applicability: card.applicability,
        completion: card.completion,
        quality: card.quality,
        freshness: 'CURRENT',
        reviewState: 'NOT_REQUESTED',
        content: {
          ...card.content,
          ...truth,
          _aiLineage: {
            proposalId: p.proposalId,
            outcome: c.outcome,
            sourceRef: p.sourceRef,
            model: p.model,
            prompt: p.prompt,
            template: p.template,
            inputHash: p.inputHash,
            evidenceRefs: p.evidenceRefs,
            counterEvidenceRefs: p.counterEvidenceRefs,
            reviewerId: envelope.actorId,
          },
        },
        evidenceRefs: [
          ...new Set([
            ...card.evidenceRefs,
            ...p.evidenceRefs.map((e) => e.ref),
            ...p.counterEvidenceRefs.map((e) => e.ref),
          ]),
        ],
        waiverDecisionId: card.waiverDecisionId,
        publishedBy: envelope.actorId,
      });
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'initiative',
        p.initiativeId,
        i.version,
        i.version + 1,
        { ...i.payload, updatedAt: new Date().toISOString() }
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `AI_TRUTH_CARD:${p.proposalId}`,
        sourceType: 'ai_analysis_proposal',
        sourceId: p.proposalId,
        sourceVersion: envelope.expectedVersion + 1,
        targetType: 'initiative_card',
        targetId: `${p.initiativeId}:${p.cardKey}`,
        payload: { oldCardVersion: p.cardVersion, newCardVersion: newVersion, outcome: c.outcome },
      });
      published = newVersion;
    }
    const now = new Date().toISOString(),
      status = c.outcome === 'ACCEPT' ? 'ACCEPTED' : c.outcome === 'EDIT' ? 'EDITED' : 'REJECTED',
      next: AIAnalysisProposal = {
        ...p,
        status,
        review: {
          outcome: c.outcome,
          reviewerId: envelope.actorId,
          rationale: c.rationale,
          truthFragment: truth,
          reviewedAt: now,
        },
        publishedCardVersion: published,
        updatedAt: now,
      };
    return {
      mutation: next,
      response: next,
      eventType: `ai-analysis.${status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
