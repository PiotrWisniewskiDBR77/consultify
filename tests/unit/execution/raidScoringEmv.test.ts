/**
 * M14/F8 — EMV + 5×5 + residual (additive scoring extensions).
 */
import { describe, expect, it } from 'vitest';

import {
  calculateEmv,
  calculateRiskScore5x5,
  categorizeScore5x5,
  residualScore,
} from '../../../server/src/services/raidScoringService.js';

describe('EMV / 5×5 / residual', () => {
  it('EMV = P% × financial impact', () => {
    expect(calculateEmv(50, 100000)).toBe(50000);
    expect(calculateEmv(10, 200000)).toBe(20000);
    expect(calculateEmv(150, 1000)).toBe(1000); // clamp >100 → 100%
  });

  it('5×5 score + categorisation', () => {
    expect(calculateRiskScore5x5('VERY_HIGH', 'CRITICAL')).toBe(25);
    expect(categorizeScore5x5(25)).toBe('RED');
    expect(calculateRiskScore5x5('LOW', 'LOW')).toBe(4);
    expect(categorizeScore5x5(4)).toBe('GREEN');
    expect(categorizeScore5x5(10)).toBe('AMBER');
  });

  it('5×5 returns null on unknown value (no silent fallback)', () => {
    expect(calculateRiskScore5x5('WAT', 'CRITICAL')).toBeNull();
  });

  it('residual reduces inherent by control effectiveness', () => {
    expect(residualScore(20, 0.7)).toBe(6); // 20 × 0.3
    expect(residualScore(20, 0)).toBe(20);
    expect(residualScore(20, 1)).toBe(0);
  });
});
