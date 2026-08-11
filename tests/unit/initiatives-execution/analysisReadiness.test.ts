import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_CARD_KEYS,
  evaluateAnalysisReadiness,
} from '../../../server/src/domain/initiatives-execution/analysisReadiness';
import type { InitiativeCardVersionReadModel } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

const specific: Record<string, Record<string, unknown>> = {
  options: { doNothing: 'Continue', alternatives: ['SMED'], recommendedOption: 'SMED' },
  'financial-analysis': { financeRef: 'finance:model:1', scenarioVersion: 1 },
  kpi: { kpiRefs: ['kpi:lead-time'], measurementPlan: 'Weekly' },
  'resources-capacity': { capacityEstimate: 2, confidence: 'MEDIUM' },
  dependencies: { dependencies: ['dep:maintenance'] },
  'risk-raid': { risks: ['risk:uptime'], accountableOwners: ['owner'] },
  'technical-specification': { technicalAssessment: 'Viable' },
  'change-adoption': { changeImpact: 'Operator training' },
  stakeholders: { ownerId: 'owner', sponsorId: 'sponsor' },
  'feasibility-completeness': { feasibilityConclusion: 'Feasible' },
};
const card = (key: string): InitiativeCardVersionReadModel => ({
  cardKey: key,
  cardVersion: 2,
  aggregateVersion: 5,
  applicability: 'REQUIRED',
  completion: 'COMPLETE',
  quality: 'SUFFICIENT',
  freshness: 'CURRENT',
  reviewState: 'ACCEPTED',
  content: {
    ...specific[key],
    challenge: 'What would falsify this?',
    counterEvidence: ['evidence:counter'],
    acceptedHumanTruth: 'Reviewer accepted the bounded conclusion.',
  },
  evidenceRefs: [`evidence:${key}:v2`],
  waiverDecisionId: null,
  publishedBy: 'analyst',
  publishedAt: '2026-08-09T20:00:00Z',
});

describe('Analysis readiness', () => {
  it('freezes exact applicable card versions only after challenge, counter-evidence and accepted human truth', () => {
    const result = evaluateAnalysisReadiness(ANALYSIS_CARD_KEYS.map(card));
    expect(result.readiness).toBe('READY');
    expect(Object.keys(result.cardVersions)).toEqual([...ANALYSIS_CARD_KEYS]);
    expect(result.findings).toEqual([]);
  });
  it('fails closed on stale or unknown analysis and missing counter-evidence', () => {
    const cards = ANALYSIS_CARD_KEYS.map(card);
    cards[0] = { ...cards[0], freshness: 'STALE' };
    cards[1] = { ...cards[1], quality: 'UNKNOWN' };
    cards[2] = { ...cards[2], content: { ...cards[2].content, counterEvidence: [] } };
    const result = evaluateAnalysisReadiness(cards);
    expect(result.readiness).toBe('BLOCKED');
    expect(result.findings.map((f) => f.rule)).toEqual(
      expect.arrayContaining(['SOURCE_STALE', 'QUALITY_UNKNOWN', 'FIELD_REQUIRED:counterEvidence'])
    );
  });
});
