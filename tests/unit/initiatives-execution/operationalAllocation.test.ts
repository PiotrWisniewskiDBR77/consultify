import { describe, expect, it } from 'vitest';
import { simulateOperationalAllocation } from '../../../server/src/domain/initiatives-execution/operationalAllocation';

const basis = {
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [{ periodId: 'w1', start: '2026-08-10T00:00:00.000Z', end: '2026-08-17T00:00:00.000Z' }],
};
const ref = {
  ref: 'source-1',
  version: 2,
  knowledgeState: 'KNOWN' as const,
  confidence: 'HIGH' as const,
  asOf: '2026-08-10T00:00:00.000Z',
  reason: null,
};
const allocation = {
  timeBasis: basis,
  demand: { unit: 'FTE', low: 0.5, base: 1, high: 1.5, knowledgeState: 'ESTIMATED' as const },
  availabilityRef: ref,
  calendarRef: ref,
  remainingEstimateRef: ref,
  skillRequirements: ['delivery'],
};

describe('Operational Allocation simulation', () => {
  it('is READY only with exact basis and usable evidence', () =>
    expect(simulateOperationalAllocation(allocation, basis)).toEqual({
      state: 'READY',
      findings: [],
    }));
  it('keeps UNKNOWN demand and evidence missing rather than coercing them to zero', () => {
    const unknown = {
      ...allocation,
      demand: {
        ...allocation.demand,
        low: null,
        base: null,
        high: null,
        knowledgeState: 'UNKNOWN' as const,
      },
      availabilityRef: { ...ref, ref: null, version: null, knowledgeState: 'UNKNOWN' as const },
    };
    const result = simulateOperationalAllocation(unknown, basis);
    expect(result.state).toBe('EVIDENCE_MISSING');
    expect(result.findings).toEqual(
      expect.arrayContaining(['AVAILABILITY_EVIDENCE_MISSING', 'DEMAND_EVIDENCE_MISSING'])
    );
    expect(unknown.demand.base).toBeNull();
  });
  it('reports mismatched basis and invalid range as PARTIAL', () => {
    const result = simulateOperationalAllocation(
      { ...allocation, demand: { ...allocation.demand, low: 2, base: 1, high: 1.5 } },
      { ...basis, timezone: 'UTC' }
    );
    expect(result.state).toBe('PARTIAL');
    expect(result.findings).toEqual(
      expect.arrayContaining(['TIME_BASIS_MISMATCH', 'DEMAND_RANGE_INVALID'])
    );
  });
});
