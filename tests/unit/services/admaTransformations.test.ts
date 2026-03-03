import { describe, expect, it } from 'vitest';

import { computeADMATransformationScores } from '../../../src/services/admaTransformations';

describe('computeADMATransformationScores', () => {
  it('computes weighted current/target and gapToFoF', () => {
    const rows = computeADMATransformationScores({
      dimensions: {
        production_tech: { current: 2, target: 4 },
        digital_investments: { current: 4, target: 5 },
      },
      fofBenchmark: 4,
    });

    const t1 = rows.find((r) => r.id === 'T1');
    expect(t1).toBeTruthy();
    expect(t1?.current).toBeCloseTo(2.6, 5); // 2*0.7 + 4*0.3
    expect(t1?.target).toBeCloseTo(4.3, 5); // 4*0.7 + 5*0.3
    expect(t1?.gapToFoF).toBeCloseTo(1.4, 5); // 4 - 2.6
  });

  it('returns null current when all mapped dimensions are missing', () => {
    const rows = computeADMATransformationScores({
      dimensions: {
        digital_strategy: { current: 3, target: 4 },
      },
      fofBenchmark: 4,
    });
    const t1 = rows.find((r) => r.id === 'T1');
    expect(t1?.current).toBeNull();
    expect(t1?.gapToFoF).toBeNull();
  });
});

