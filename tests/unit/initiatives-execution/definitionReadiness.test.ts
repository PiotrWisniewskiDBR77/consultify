import { describe, expect, it } from 'vitest';

import { evaluateDefinitionReadiness } from '../../../server/src/domain/initiatives-execution/definitionReadiness';
import type { InitiativeCardVersionReadModel } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

const content: Record<string, Record<string, unknown>> = {
  'summary-scope': { problem: 'Problem', outcome: 'Outcome', inScope: ['A'], outOfScope: ['B'] },
  'strategic-fit': { objectives: ['OEE'], rationale: 'Supports the operating model.' },
  'success-criteria': { successCriteria: ['Lead time'], measurementPlan: 'Weekly' },
  'outcomes-benefits': { outcomes: ['Faster changeover'], benefits: ['Capacity'] },
  options: { doNothing: 'No change', alternatives: ['SMED'] },
  'people-team': { team: ['Operations'], capacityAssumptions: 'Part-time participation.' },
  'roles-raci': { accountableOwnerId: 'owner', roles: ['Engineer'] },
  stakeholders: { ownerId: 'owner', sponsorId: 'sponsor' },
};

const card = (cardKey: string): InitiativeCardVersionReadModel => ({
  cardKey,
  cardVersion: 2,
  aggregateVersion: 8,
  applicability: 'REQUIRED',
  completion: 'COMPLETE',
  quality: 'SUFFICIENT',
  freshness: 'CURRENT',
  reviewState: 'ACCEPTED',
  content: content[cardKey],
  evidenceRefs: [`evidence:${cardKey}:v2`],
  waiverDecisionId: null,
  publishedBy: 'owner',
  publishedAt: '2026-08-09T20:00:00.000Z',
});

describe('server Definition readiness', () => {
  it('returns READY only with exact reviewed current versions and valid lineage', () => {
    const result = evaluateDefinitionReadiness(Object.keys(content).map(card), true);
    expect(result.readiness).toBe('READY');
    expect(result.findings).toEqual([]);
    expect(result.cardVersions).toEqual({
      'summary-scope': 2,
      'strategic-fit': 2,
      'success-criteria': 2,
      'outcomes-benefits': 2,
      options: 2,
      'people-team': 2,
      'roles-raci': 2,
      stakeholders: 2,
    });
  });

  it('returns addressable findings instead of converting unknown into complete', () => {
    const result = evaluateDefinitionReadiness(
      [
        { ...card('summary-scope'), quality: 'UNKNOWN', content: { problem: '' } },
        card('success-criteria'),
        card('options'),
      ],
      false
    );
    expect(result.readiness).toBe('BLOCKED');
    expect(result.findings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining([
        'SOURCE_LINEAGE_INVALID',
        'QUALITY_UNKNOWN',
        'FIELD_REQUIRED:problem',
        'PUBLISHED_CARD_MISSING',
      ])
    );
  });
});
