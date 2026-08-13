import { describe, expect, it } from 'vitest';
import {
  deriveMilestoneReadiness,
  milestoneForecastVariance,
} from '../../../server/src/domain/initiatives-execution/executionMilestone';

describe('Execution Milestone projection', () => {
  it('derives blocked/complete readiness and only computes variance from explicit dates', () => {
    expect(deriveMilestoneReadiness(['OPEN', 'BLOCKED'])).toEqual({
      readiness: 'BLOCKED',
      status: 'AT_RISK',
    });
    expect(deriveMilestoneReadiness(['COMPLETED', 'COMPLETED'])).toEqual({
      readiness: 'COMPLETE',
      status: 'ACHIEVED',
    });
    expect(deriveMilestoneReadiness([])).toEqual({ readiness: 'UNKNOWN', status: 'PLANNED' });
    expect(milestoneForecastVariance(null, '2026-08-12T00:00:00Z')).toBeNull();
    expect(milestoneForecastVariance('2026-08-10T00:00:00Z', '2026-08-12T00:00:00Z')).toBe(2);
  });
});
