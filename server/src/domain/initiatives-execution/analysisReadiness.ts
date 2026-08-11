import type { InitiativeCardVersionReadModel } from './postgresInitiativeReader.js';

export const ANALYSIS_CARD_KEYS = [
  'options',
  'financial-analysis',
  'kpi',
  'resources-capacity',
  'dependencies',
  'risk-raid',
  'technical-specification',
  'change-adoption',
  'stakeholders',
  'feasibility-completeness',
] as const;

const CARD_FIELDS: Record<(typeof ANALYSIS_CARD_KEYS)[number], readonly string[]> = {
  options: ['doNothing', 'alternatives', 'recommendedOption'],
  'financial-analysis': ['financeRef', 'scenarioVersion'],
  kpi: ['kpiRefs', 'measurementPlan'],
  'resources-capacity': ['capacityEstimate', 'confidence'],
  dependencies: ['dependencies'],
  'risk-raid': ['risks', 'accountableOwners'],
  'technical-specification': ['technicalAssessment'],
  'change-adoption': ['changeImpact'],
  stakeholders: ['ownerId', 'sponsorId'],
  'feasibility-completeness': ['feasibilityConclusion'],
};

export interface AnalysisReadinessFinding {
  findingId: string;
  cardKey: string;
  severity: 'BLOCKER' | 'WARNING';
  rule: string;
  evidenceRefs: string[];
  message: string;
}

export interface AnalysisReadinessResult {
  readiness: 'NOT_READY' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED';
  cardVersions: Record<string, number>;
  findings: AnalysisReadinessFinding[];
}

function present(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

export function evaluateAnalysisReadiness(
  cards: readonly InitiativeCardVersionReadModel[]
): AnalysisReadinessResult {
  const byKey = new Map(cards.map((card) => [card.cardKey, card]));
  const findings: AnalysisReadinessFinding[] = [];
  const cardVersions: Record<string, number> = {};
  const add = (
    cardKey: string,
    severity: 'BLOCKER' | 'WARNING',
    rule: string,
    refs: string[],
    message: string
  ) =>
    findings.push({
      findingId: `analysis:${cardKey}:${rule}`,
      cardKey,
      severity,
      rule,
      evidenceRefs: refs,
      message,
    });

  for (const cardKey of ANALYSIS_CARD_KEYS) {
    const card = byKey.get(cardKey);
    if (!card) {
      add(cardKey, 'BLOCKER', 'PUBLISHED_CARD_MISSING', [], 'Applicable analysis card is missing.');
      continue;
    }
    cardVersions[cardKey] = card.cardVersion;
    if (card.applicability === 'NOT_APPLICABLE') {
      if (!card.waiverDecisionId)
        add(
          cardKey,
          'BLOCKER',
          'WAIVER_DECISION_REQUIRED',
          card.evidenceRefs,
          'Not applicable requires an authorized Decision.'
        );
      continue;
    }
    if (card.freshness !== 'CURRENT')
      add(
        cardKey,
        'BLOCKER',
        card.freshness === 'STALE' ? 'SOURCE_STALE' : 'SOURCE_UNAVAILABLE',
        card.evidenceRefs,
        'Analysis source is not current.'
      );
    if (card.quality === 'UNKNOWN' || card.quality === 'BLOCKER')
      add(
        cardKey,
        'BLOCKER',
        card.quality === 'UNKNOWN' ? 'QUALITY_UNKNOWN' : 'QUALITY_BLOCKER',
        card.evidenceRefs,
        'Analysis quality is not accepted human truth.'
      );
    else if (card.quality === 'WARNING')
      add(
        cardKey,
        'WARNING',
        'QUALITY_WARNING',
        card.evidenceRefs,
        'Analysis warning remains open.'
      );
    if (card.completion !== 'COMPLETE')
      add(cardKey, 'BLOCKER', 'CARD_INCOMPLETE', card.evidenceRefs, 'Analysis card is incomplete.');
    if (card.reviewState !== 'ACCEPTED')
      add(
        cardKey,
        'BLOCKER',
        'HUMAN_REVIEW_REQUIRED',
        card.evidenceRefs,
        'Independent human review is required.'
      );
    if (!card.evidenceRefs.length)
      add(cardKey, 'BLOCKER', 'EVIDENCE_REQUIRED', [], 'Governed evidence is required.');
    for (const field of [
      ...CARD_FIELDS[cardKey],
      'challenge',
      'counterEvidence',
      'acceptedHumanTruth',
    ]) {
      if (!present(card.content[field]))
        add(
          cardKey,
          'BLOCKER',
          `FIELD_REQUIRED:${field}`,
          card.evidenceRefs,
          `Required field ${field} is missing.`
        );
    }
  }
  const hard = findings.some((f) =>
    ['SOURCE_STALE', 'SOURCE_UNAVAILABLE', 'QUALITY_UNKNOWN', 'QUALITY_BLOCKER'].includes(f.rule)
  );
  const blocker = findings.some((f) => f.severity === 'BLOCKER');
  const warning = findings.some((f) => f.severity === 'WARNING');
  return {
    readiness: hard ? 'BLOCKED' : blocker ? 'NOT_READY' : warning ? 'CONDITIONALLY_READY' : 'READY',
    cardVersions,
    findings,
  };
}
