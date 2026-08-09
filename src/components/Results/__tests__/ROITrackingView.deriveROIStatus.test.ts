/**
 * CB-04/RB-003 — ROI status must not report "on-track" for an initiative
 * that has never actually been evaluated (no realized benefit yet, or a
 * zero-projected baseline). Deterministic fixtures — no clock involved.
 */
import { describe, expect, it } from 'vitest';

import { deriveROIStatus, type ROIInitiativeItem } from '../ROITrackingView';

function item(overrides: Partial<ROIInitiativeItem>): ROIInitiativeItem {
  return {
    initiativeId: 'init-1',
    initiativeName: 'Test initiative',
    status: 'active',
    priority: 'medium',
    projectedBenefit: 100,
    realizedBenefit: 0,
    variance: 0,
    hasRealized: false,
    ...overrides,
  };
}

describe('deriveROIStatus', () => {
  it('is "not-evaluable" (never "on-track") when nothing has been realized yet', () => {
    const status = deriveROIStatus(item({ hasRealized: false, realizedBenefit: 0 }));
    expect(status).toBe('not-evaluable');
    expect(status).not.toBe('on-track');
  });

  it('is "not-evaluable" when the projected baseline is zero, even with realized > 0', () => {
    const status = deriveROIStatus(
      item({ hasRealized: true, projectedBenefit: 0, realizedBenefit: 500 })
    );
    expect(status).toBe('not-evaluable');
  });

  it('is "above" when realized clears projected by more than 10%', () => {
    const status = deriveROIStatus(
      item({ hasRealized: true, projectedBenefit: 100, realizedBenefit: 120 })
    );
    expect(status).toBe('above');
  });

  it('is "below" when realized misses projected by more than 10%', () => {
    const status = deriveROIStatus(
      item({ hasRealized: true, projectedBenefit: 100, realizedBenefit: 80 })
    );
    expect(status).toBe('below');
  });

  it('is "on-track" when realized is genuinely evaluated and within ±10% of projected', () => {
    const status = deriveROIStatus(
      item({ hasRealized: true, projectedBenefit: 100, realizedBenefit: 105 })
    );
    expect(status).toBe('on-track');
  });
});
