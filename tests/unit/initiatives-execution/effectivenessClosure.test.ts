import { describe, expect, it } from 'vitest';
import {
  canonicalEffectivenessOutcome,
  measurementFindings,
} from '../../../server/src/domain/initiatives-execution/effectivenessClosure';
describe('Benefit measurement evidence', () => {
  it('never treats UNKNOWN as zero', () => {
    const m: any = {
      measurementId: 'm',
      contractRef: { ref: 'k', version: 1 },
      sourceRef: { ref: 's', version: 1 },
      baseline: null,
      current: null,
      target: null,
      formula: 'x',
      unit: 'PLN',
      currency: 'PLN',
      window: { start: '2026-01-01', end: '2026-03-31' },
      confidence: 'UNKNOWN',
      knowledgeState: 'UNKNOWN',
      asOf: '2026-04-01',
      evidenceRefs: [],
    };
    expect(measurementFindings(m)).toEqual(
      expect.arrayContaining([
        'MEASUREMENT_EVIDENCE_MISSING',
        'CONFIDENCE_UNKNOWN',
        'EVIDENCE_REFS_MISSING',
      ])
    );
    expect(m.current).toBeNull();
  });
});
describe('Effectiveness outcome compatibility', () => {
  it('maps legacy vocabulary without losing canonical outcomes', () => {
    expect(canonicalEffectivenessOutcome('EFFECTIVE')).toBe('CONFIRMED');
    expect(canonicalEffectivenessOutcome('INEFFECTIVE')).toBe('NOT_ACHIEVED');
    expect(canonicalEffectivenessOutcome('NOT_VERIFIED')).toBe('RETURN_FOR_MEASUREMENT');
    expect(canonicalEffectivenessOutcome('PARTIAL')).toBe('PARTIAL');
  });
});
