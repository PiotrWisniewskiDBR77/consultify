import { describe, expect, it } from 'vitest';
import {
  capacityOptionFindings,
  hasPublishedScenarioStatus,
} from '../../../server/src/domain/initiatives-execution/capacityOptions';
describe('Capacity Options', () => {
  it('never represents UNKNOWN impact as numeric zero', () => {
    const range = {
      low: null,
      base: null,
      high: null,
      unit: 'days',
      knowledgeState: 'UNKNOWN' as const,
      confidence: 'UNKNOWN' as const,
      sourceRefs: [],
    };
    const o: any = {
      assumptions: [
        {
          assumption: 'x',
          ownerId: 'o',
          sourceRef: { ref: 's', version: 1 },
          knowledgeState: 'KNOWN',
        },
      ],
      impact: { date: { ...range, base: 0 }, scope: range, cost: range, risk: range },
    };
    expect(capacityOptionFindings(o)).toContain(
      'DATE_UNKNOWN_MUST_NOT_HAVE_NUMERIC_ZERO_OR_VALUES'
    );
    expect(range.base).toBeNull();
  });
  it('recognizes only the canonical scenario status field as published truth', () => {
    expect(hasPublishedScenarioStatus({ status: 'PUBLISHED' })).toBe(true);
    expect(hasPublishedScenarioStatus({ status: 'DRAFT' })).toBe(false);
  });
});
