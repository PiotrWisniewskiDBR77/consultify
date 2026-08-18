import { describe, expect, it } from 'vitest';

import { aggregateDecisionImpact } from '../DecisionDetailView';

describe('DecisionDetailView publish impact', () => {
  it.each([
    [{ scope: 'low', schedule: 'low', cost: 'low', quality: 'low' }, 'low'],
    [{ scope: 'low', schedule: 'medium', cost: 'low', quality: 'low' }, 'medium'],
    [{ scope: 'medium', schedule: 'low', cost: 'high', quality: 'low' }, 'high'],
  ] as const)('maps dimensional editor state to the canonical API enum', (impact, expected) => {
    expect(aggregateDecisionImpact(impact)).toBe(expected);
    expect(impact).toHaveProperty('scope');
    expect(impact).toHaveProperty('quality');
  });
});
