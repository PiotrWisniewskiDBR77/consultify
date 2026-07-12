import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock — module under test imports DbPromise's all/get.
const mockAll = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: mockAll,
  get: mockGet,
  run: vi.fn(),
}));

import { getROIInitiativeDetail, getROIPortfolioSummary } from '../../../server/src/services/v8/resultsROIService.js';

describe('resultsROIService — Faza2 gap #3 (ROI net-of-opex, additive)', () => {
  beforeEach(() => {
    mockAll.mockReset();
    mockGet.mockReset();
  });

  it('getROIPortfolioSummary: adds net* fields alongside existing gross fields, without changing them', async () => {
    mockAll
      // assumptions
      .mockResolvedValueOnce([
        {
          initiative_id: 'ini-1',
          initiative_name: 'Automation rollout',
          status: 'EXECUTING',
          priority: 'HIGH',
          capex: 1000,
          opex_annual: 200,
          expected_revenue_delta: 500,
          expected_cost_delta: 0,
          confidence: 'medium',
        },
      ])
      // realized
      .mockResolvedValueOnce([
        { initiative_id: 'ini-1', total_rev: 300, total_cost: 0, total_savings: 0 },
      ]);

    const summary = await getROIPortfolioSummary('org-1');

    // Existing gross fields are UNCHANGED (regression guard for "nie psuj istniejącego").
    expect(summary.items[0]).toMatchObject({
      capex: 1000,
      opexAnnual: 200,
      projectedBenefit: 500,
      realizedBenefit: 300,
      variance: -200,
    });
    // New additive net fields.
    expect(summary.items[0].netProjectedBenefit).toBe(300); // 500 - 200
    expect(summary.items[0].netRealizedBenefit).toBe(100); // 300 - 200
    expect(summary.items[0].roiPercentGross).toBeCloseTo(30); // 300/1000*100
    expect(summary.items[0].roiPercentNet).toBeCloseTo(10); // 100/1000*100

    expect(summary.summary).toMatchObject({
      totalProjected: 500,
      totalRealized: 300,
      totalCapex: 1000,
    });
    expect(summary.summary.totalOpexAnnual).toBe(200);
    expect(summary.summary.netTotalProjected).toBe(300);
    expect(summary.summary.netTotalRealized).toBe(100);
    expect(summary.summary.roiPercentGross).toBeCloseTo(30);
    expect(summary.summary.roiPercentNet).toBeCloseTo(10);
  });

  it('getROIPortfolioSummary: roiPercentNet is null when capex <= 0 (no divide-by-zero)', async () => {
    mockAll
      .mockResolvedValueOnce([
        {
          initiative_id: 'ini-2',
          initiative_name: 'No capex initiative',
          status: 'EXECUTING',
          priority: 'MEDIUM',
          capex: 0,
          opex_annual: 50,
          expected_revenue_delta: 100,
          expected_cost_delta: 0,
          confidence: 'low',
        },
      ])
      .mockResolvedValueOnce([]);

    const summary = await getROIPortfolioSummary('org-1');
    expect(summary.items[0].roiPercentGross).toBeNull();
    expect(summary.items[0].roiPercentNet).toBeNull();
  });

  it('getROIInitiativeDetail: variance.projected/realized carry net-of-opex fields additively', async () => {
    mockGet.mockResolvedValueOnce({
      capex: 2000,
      opex_annual: 400,
      expected_revenue_delta: 1000,
      expected_cost_delta: 0,
      expected_roi_percent: 50,
      expected_npv: 0,
      expected_payback_months: 0,
      horizon_months: 12,
      confidence: 'high',
    });
    mockAll.mockResolvedValueOnce([
      { realized_revenue_delta: 600, realized_cost_delta: 0, realized_savings: 0 },
    ]);

    const detail = await getROIInitiativeDetail('ini-3', 'org-1');

    expect(detail.variance.hasAssumptions).toBe(true);
    expect(detail.variance.projected?.totalBenefit).toBe(1000); // unchanged gross
    expect(detail.variance.projected?.netTotalBenefit).toBe(600); // 1000 - 400
    expect(detail.variance.projected?.roiPercentNet).toBeCloseTo(30); // 600/2000*100

    expect(detail.variance.realized?.totalBenefit).toBe(600); // unchanged gross
    expect(detail.variance.realized?.netTotalBenefit).toBe(200); // 600 - 400
    expect(detail.variance.realized?.roiPercentNet).toBeCloseTo(10); // 200/2000*100
  });
});
