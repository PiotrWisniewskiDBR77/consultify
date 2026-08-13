/**
 * outputAdapter — reshapes the server's `RawAssessmentOutputRecord` (the
 * actual `GET /api/method/outputs/:id` JSON) into the pure, kernel-canon
 * `AssessmentOutput` shape (`@/method-core/outputs/types.ts`), so this
 * package can hand the frozen Output to the SAME shared derivation
 * functions (`buildReportSnapshot`, `buildPresentationView`) the rest of
 * the Method Kernel uses — no new scoring/aggregation logic here, only
 * FIELD RESHAPING (nested `methodology` object, `version` vs
 * `outputVersion`, a synthesized `lineage`, null→'' for the client
 * `Finding` type's required-but-server-nullable text fields).
 *
 * Every value that ends up on the returned `AssessmentOutput` is copied
 * verbatim from the raw record — nothing here averages, sums, rounds, or
 * otherwise recomputes a number. That discipline is what lets
 * `buildPresentationDeck.ts` reuse `buildReportSnapshot`/
 * `buildPresentationView` and stay honestly free of its own scoring math.
 */
import type { AssessmentOutput, Finding } from '@/method-core/outputs';

import type {
  RawAssessmentOutputRecord,
  RawFinding,
  RawUnknownReasonBreakdown,
} from './rawOutputTypes';

function toFinding(raw: RawFinding): Finding {
  return {
    id: raw.id,
    unitId: raw.unitId,
    unitName: raw.unitName,
    currentLevel: raw.currentLevel,
    targetLevel: raw.targetLevel,
    gap: raw.gap,
    supportingEvidence: raw.supportingEvidence,
    contradictingEvidence: raw.contradictingEvidence,
    businessMeaning: raw.businessMeaning,
    // Client `Finding` requires these as `string` (never null); the server
    // record allows null for a finding that never set them. '' is an
    // honest "not authored", never a fabricated sentence.
    rootCauseHypothesis: raw.rootCauseHypothesis ?? '',
    riskOrOpportunity: raw.riskOrOpportunity ?? '',
    recommendation: raw.recommendation,
    prerequisite: raw.prerequisite ?? null,
    expectedOutcome: raw.expectedOutcome ?? '',
    kpiProposal: (raw.kpiProposal ?? null) as Finding['kpiProposal'],
    confidence: raw.confidence,
    priorityRationale: raw.priorityRationale ?? '',
    sourceLocators: raw.sourceLocators ?? [],
  };
}

/**
 * Pure, total function: every `RawAssessmentOutputRecord` field the server
 * can send maps onto exactly one `AssessmentOutput` field (or is dropped
 * because the pure type has no slot for it, e.g. `revisionOfOutputId`
 * folds into `lineage`). Never throws — a record shaped exactly like the
 * documented server contract always adapts cleanly; callers that received
 * something else (network/shape drift) should validate before calling this,
 * not rely on it to fail loudly.
 */
export function toAssessmentOutput(raw: RawAssessmentOutputRecord): AssessmentOutput {
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    module: raw.module,
    methodology: {
      methodPackId: raw.methodPackId,
      version: raw.methodPackVersion,
    },
    scope: raw.scope,
    snapshotId: raw.snapshotId,
    current: raw.current,
    target: raw.target,
    gap: raw.gap,
    aggregation: {
      byGroup: raw.aggregation.byGroup,
      byGroupNorm: raw.aggregation.byGroupNorm,
      mappingVersion: raw.aggregation.mappingVersion,
      rule: raw.aggregation.rule,
      excluded: raw.aggregation.excluded ?? {},
    },
    visualModel: raw.visualModel ?? { kind: 'matrix', dataRef: {} },
    evidenceCompleteness: raw.evidenceCompleteness,
    limitations: raw.limitations,
    findings: raw.findings.map(toFinding),
    prioritisationResult: (raw.prioritisationResult ?? null) as AssessmentOutput['prioritisationResult'],
    lineage: {
      sourceSessionId: raw.sessionId,
      sourceRevisionOfSessionId: raw.sourceRevisionOfSessionId ?? null,
      revisionOfOutputId: raw.revisionOfOutputId,
      supersededByOutputId: null,
    },
    version: raw.outputVersion,
    createdAt: raw.createdAt,
    frozenAt: raw.frozenAt,
    contentHash: raw.contentHash,
  };
}

/**
 * Forward-compat read of an OPTIONAL per-reason breakdown of
 * `unitsMissingEvidence` (`dont_know` vs `no_evidence`) — see
 * `RawEvidenceCompleteness.unitsMissingEvidenceBreakdown`'s doc comment.
 * Returns `undefined` whenever the field is absent or not shaped like two
 * numbers, so callers (`slides.tsx`'s "Obszary bez dowodu" slide) can fall
 * back to the single aggregated count without special-casing malformed
 * input themselves.
 */
export function extractUnknownReasonBreakdown(
  raw: RawAssessmentOutputRecord
): RawUnknownReasonBreakdown | undefined {
  const breakdown = raw.evidenceCompleteness?.unitsMissingEvidenceBreakdown;
  if (!breakdown || typeof breakdown !== 'object') return undefined;
  if (typeof breakdown.dontKnow !== 'number' || typeof breakdown.noEvidence !== 'number') return undefined;
  return {
    dontKnow: breakdown.dontKnow,
    noEvidence: breakdown.noEvidence,
    ...(typeof breakdown.other === 'number' ? { other: breakdown.other } : {}),
  };
}

/**
 * Minimal structural guard for a value coming off the network before it is
 * trusted as a `RawAssessmentOutputRecord` — cheap, not a full schema
 * validator. Mirrors the honesty rule elsewhere in this kernel: a shape we
 * don't recognize must surface as "cannot render", never as zeros or an
 * empty deck that looks like a legitimately empty Output.
 */
export function isPlausibleRawOutput(value: unknown): value is RawAssessmentOutputRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.methodPackId === 'string' &&
    typeof v.methodPackVersion === 'string' &&
    typeof v.scope === 'string' &&
    typeof v.current === 'object' &&
    v.current !== null &&
    typeof v.target === 'object' &&
    v.target !== null &&
    typeof v.aggregation === 'object' &&
    v.aggregation !== null &&
    typeof v.evidenceCompleteness === 'object' &&
    v.evidenceCompleteness !== null &&
    Array.isArray(v.findings) &&
    Array.isArray(v.limitations) &&
    typeof v.frozenAt === 'string'
  );
}
