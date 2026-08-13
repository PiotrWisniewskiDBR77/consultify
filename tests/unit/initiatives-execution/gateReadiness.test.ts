import { describe, expect, it } from 'vitest';

import {
  evaluateGateReadiness,
  type GateCardRequirement,
  type PublishedCardSnapshot,
} from '../../../src/contracts/initiatives-execution/gateReadiness';

const requirements: GateCardRequirement[] = [
  {
    cardKey: 'summary-scope',
    requiredFields: ['problem', 'outcome', 'inScope', 'outOfScope'],
    reviewRequired: true,
    allowAuthorizedWaiver: false,
  },
  {
    cardKey: 'options',
    requiredFields: ['doNothing', 'alternatives'],
    reviewRequired: false,
    allowAuthorizedWaiver: false,
  },
  {
    cardKey: 'stakeholders',
    requiredFields: ['ownerId', 'sponsorId'],
    reviewRequired: false,
    allowAuthorizedWaiver: true,
  },
];

function complete(cardKey: PublishedCardSnapshot['cardKey']): PublishedCardSnapshot {
  const fieldsByCard = {
    'summary-scope': {
      problem: 'Changeovers are unstable',
      outcome: 'Stable performance',
      inScope: ['Line 4'],
      outOfScope: ['Line 5'],
    },
    options: { doNothing: 'Keep current process', alternatives: ['SMED', 'automation'] },
    stakeholders: { ownerId: 'owner-1', sponsorId: 'sponsor-1' },
  } as const;
  return {
    cardKey,
    version: 2,
    applicability: 'REQUIRED',
    completion: 'COMPLETE',
    quality: 'SUFFICIENT',
    freshness: 'CURRENT',
    review: 'ACCEPTED',
    evidenceRefs: [`evidence-${cardKey}`],
    fields: fieldsByCard[cardKey as keyof typeof fieldsByCard],
  };
}

describe('gate readiness finding engine', () => {
  it('returns READY and freezes the exact evaluated card versions', () => {
    const result = evaluateGateReadiness(
      'definition',
      requirements,
      requirements.map((item) => complete(item.cardKey))
    );
    expect(result.readiness).toBe('READY');
    expect(result.findings).toEqual([]);
    expect(result.evaluatedCardVersions).toEqual({
      'summary-scope': 2,
      options: 2,
      stakeholders: 2,
    });
  });

  it('never treats stale, unknown or incomplete evidence as ready', () => {
    const summary = {
      ...complete('summary-scope'),
      freshness: 'STALE' as const,
      quality: 'UNKNOWN' as const,
      completion: 'IN_PROGRESS' as const,
      fields: { problem: '', outcome: null, inScope: [], outOfScope: [] },
    };
    const result = evaluateGateReadiness('definition', requirements, [
      summary,
      complete('options'),
    ]);
    expect(result.readiness).toBe('NOT_READY');
    expect(result.findings.map((item) => item.rule)).toEqual(
      expect.arrayContaining([
        'SOURCE_STALE',
        'QUALITY_UNKNOWN',
        'CARD_INCOMPLETE',
        'FIELD_REQUIRED:problem',
        'PUBLISHED_CARD_MISSING',
      ])
    );
  });

  it('requires an explicit Decision to waive a required catalog card', () => {
    const stakeholders = {
      ...complete('stakeholders'),
      applicability: 'NOT_APPLICABLE' as const,
      fields: {},
    };
    const blocked = evaluateGateReadiness('definition', requirements, [
      complete('summary-scope'),
      complete('options'),
      stakeholders,
    ]);
    const waived = evaluateGateReadiness('definition', requirements, [
      complete('summary-scope'),
      complete('options'),
      { ...stakeholders, waiverDecisionId: 'decision-waiver-1' },
    ]);
    expect(blocked.readiness).toBe('NOT_READY');
    expect(waived.readiness).toBe('READY');
  });

  it('keeps warnings distinct from blockers', () => {
    const result = evaluateGateReadiness('definition', requirements, [
      complete('summary-scope'),
      { ...complete('options'), quality: 'WARNING' },
      complete('stakeholders'),
    ]);
    expect(result.readiness).toBe('CONDITIONALLY_READY');
    expect(result.findings).toEqual([
      expect.objectContaining({ severity: 'WARNING', cardKey: 'options' }),
    ]);
  });
});
