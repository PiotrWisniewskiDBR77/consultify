import { describe, expect, it } from 'vitest';
import { planningMissingKeys } from '../transformationPlanningIntakeService.js';

describe('planningMissingKeys', () => {
  it('returns the exact clarification keys in stable order', () => {
    expect(planningMissingKeys({})).toEqual(['measurable_outcomes','sponsor','scope','horizon']);
    expect(planningMissingKeys({measurableOutcomes:['Reduce lead time to 2 days'],sponsor:'COO',scope:'Order to cash',horizon:'Q4'})).toEqual([]);
  });
  it('normalizes blank values as missing', () => {
    expect(planningMissingKeys({measurableOutcomes:['  '],sponsor:' ',scope:'Operations',horizon:null})).toEqual(['measurable_outcomes','sponsor','horizon']);
  });
});
