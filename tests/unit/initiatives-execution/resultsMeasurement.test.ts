import { describe, expect, it } from 'vitest';
import { resultsObservationFindings } from '../../../server/src/domain/initiatives-execution/resultsMeasurement';

const observation: any = {
  measurementState: 'MEASURED',
  observedValue: 58,
  knowledgeState: 'KNOWN',
  confidence: 'HIGH',
  currency: 'PLN',
  asOf: '2026-08-10T00:00:00.000Z',
};
describe('Results/Finance authoritative observation', () => {
  it('fails measured Finance truth closed and preserves explicit NOT_MEASURED', () => {
    expect(resultsObservationFindings(observation, null)).toContain(
      'FINANCE_RECONCILIATION_UNAVAILABLE_OR_STALE'
    );
    expect(
      resultsObservationFindings(
        {
          ...observation,
          measurementState: 'NOT_MEASURED',
          observedValue: null,
          knowledgeState: 'UNKNOWN',
        },
        null
      )
    ).toEqual([]);
    expect(
      resultsObservationFindings(
        {
          ...observation,
          measurementState: 'NOT_MEASURED',
          observedValue: 0,
          knowledgeState: 'UNKNOWN',
        },
        null
      )
    ).toContain('NOT_MEASURED_MUST_NOT_INVENT_VALUE');
  });
});
