import { describe, it, expect } from 'vitest';

import {
  buildSCurve,
  isReconciliationEligible,
  type BenefitProfilePoint,
} from '../../../server/src/services/benefitProfileService.js';

function pt(
  period: string,
  plannedCumulative: number | null,
  actualCumulative: number | null
): BenefitProfilePoint {
  return {
    id: `p-${period}`,
    organizationId: 'org-1',
    initiativeId: 'init-1',
    benefitId: 'ben-1',
    period,
    plannedCumulative,
    actualCumulative,
    createdAt: '2026-06-24T00:00:00.000Z',
  };
}

describe('benefitProfileService.buildSCurve (2.6 S-curve)', () => {
  it('builds plan and actual lines from points in period order', () => {
    const curve = buildSCurve([
      pt('2026-03', 300, 250),
      pt('2026-01', 100, 90),
      pt('2026-02', 200, 180),
    ]);

    expect(curve.plan).toEqual([
      { t: '2026-01', cum: 100 },
      { t: '2026-02', cum: 200 },
      { t: '2026-03', cum: 300 },
    ]);
    expect(curve.actual).toEqual([
      { t: '2026-01', cum: 90 },
      { t: '2026-02', cum: 180 },
      { t: '2026-03', cum: 250 },
    ]);
  });

  it('computes slipAtLatest as planned - actual at the latest full period', () => {
    const curve = buildSCurve([
      pt('2026-01', 100, 90),
      pt('2026-02', 200, 180),
      pt('2026-03', 300, 250), // slip = 300 - 250 = 50 (behind plan)
    ]);
    expect(curve.slipAtLatest).toBe(50);
  });

  it('reports negative slip when actual is ahead of plan', () => {
    const curve = buildSCurve([
      pt('2026-01', 100, 120), // ahead by 20
    ]);
    expect(curve.slipAtLatest).toBe(-20);
  });

  it('skips missing values and uses the latest period with both plan and actual for slip', () => {
    const curve = buildSCurve([
      pt('2026-01', 100, 95),
      pt('2026-02', 200, null), // actual missing → not the slip period
    ]);
    // Plan keeps both periods, actual keeps only the one with a value.
    expect(curve.plan).toEqual([
      { t: '2026-01', cum: 100 },
      { t: '2026-02', cum: 200 },
    ]);
    expect(curve.actual).toEqual([{ t: '2026-01', cum: 95 }]);
    // Latest period with BOTH values is 2026-01 → slip 100 - 95 = 5.
    expect(curve.slipAtLatest).toBe(5);
  });

  it('returns empty lines and zero slip for no points', () => {
    const curve = buildSCurve([]);
    expect(curve.plan).toEqual([]);
    expect(curve.actual).toEqual([]);
    expect(curve.slipAtLatest).toBe(0);
  });
});

describe('benefitProfileService.isReconciliationEligible (2.8 taxonomy)', () => {
  it('is eligible only for hard + run_rate benefits', () => {
    expect(
      isReconciliationEligible({ hardness: 'hard', recurrence: 'run_rate' })
    ).toBe(true);
  });

  it('is not eligible for soft benefits', () => {
    expect(
      isReconciliationEligible({ hardness: 'soft', recurrence: 'run_rate' })
    ).toBe(false);
  });

  it('is not eligible for one_time benefits', () => {
    expect(
      isReconciliationEligible({ hardness: 'hard', recurrence: 'one_time' })
    ).toBe(false);
    expect(
      isReconciliationEligible({ hardness: 'soft', recurrence: 'one_time' })
    ).toBe(false);
  });

  it('is not eligible when taxonomy fields are missing', () => {
    expect(isReconciliationEligible({})).toBe(false);
    expect(isReconciliationEligible({ hardness: 'hard' })).toBe(false);
    expect(isReconciliationEligible({ recurrence: 'run_rate' })).toBe(false);
  });
});
