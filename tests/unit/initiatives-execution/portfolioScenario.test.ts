import { describe, expect, it } from 'vitest';
import {
  diffPortfolioScenarios,
  type PortfolioScenario,
} from '../../../server/src/domain/initiatives-execution/portfolioScenario';
const unknown = { state: 'UNKNOWN' as const, value: null, reason: 'No governed source' };
const scenario = (version: number, rank: number): PortfolioScenario => ({
  scenarioId: 's1',
  scenarioVersion: version,
  status: version === 2 ? 'PUBLISHED' : 'SUPERSEDED',
  scope: { portfolioId: 'p1', goalIds: ['g1'], asOf: '2026-08-09T20:00:00Z' },
  model: { modelId: 'weighted-vcr', version: 3 },
  decompositionKeys: ['fit', 'value', 'risk'],
  createdBy: 'owner',
  updatedBy: 'owner',
  publishedBy: version === 2 ? 'owner' : null,
  publishedAt: version === 2 ? '2026-08-09T21:00:00Z' : null,
  previousPublishedVersion: null,
  memberships: [
    {
      initiativeId: 'i1',
      initiativeVersion: 7,
      disposition: 'CONDITIONAL',
      scoreDecomposition: { fit: 8, value: 7, risk: null },
      rank,
      rankOverride:
        rank === 1
          ? { actorId: 'owner', reason: 'Mandatory regulatory lane', previousRank: 2, newRank: 1 }
          : null,
      coverage: unknown,
      overlap: unknown,
      roughDemand: unknown,
      confidence: 'UNKNOWN',
      rationale: 'Compare without inventing missing values',
    },
  ],
});
describe('Portfolio Scenario', () => {
  it('keeps unknown distinct from zero and exposes rank override in version diff', () => {
    const changes = diffPortfolioScenarios(scenario(1, 2), scenario(2, 1));
    expect(changes).toHaveLength(1);
    expect(changes[0].before?.coverage).toEqual(unknown);
    expect(changes[0].after?.rankOverride?.reason).toBe('Mandatory regulatory lane');
  });
  it('does not encode dates, scheduling, or capacity commitments in the scenario contract', () => {
    const json = JSON.stringify(scenario(2, 1));
    expect(json).not.toContain('scheduled');
    expect(json).not.toContain('startDate');
    expect(json).not.toContain('capacityCommitment');
  });
});
