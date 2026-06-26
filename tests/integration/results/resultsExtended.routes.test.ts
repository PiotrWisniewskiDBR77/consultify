/**
 * M15 Seria T / T1 — route test for resultsExtended.routes.ts
 *
 * Covers all 11 analytical GET endpoints + their newly-added fields:
 *   signals, run-rate, reallocation, adoption, sustainment, scenarios,
 *   counterfactual, finance-link, benefit-profiles, narrative, funnel.
 *
 * Real Express + real routes + real services, DbPromise + auth mocked.
 * dbAll() routes returns by SQL substring so each endpoint runs its real
 * shaping logic against deterministic ROI / adoption / mapping rows.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let injectUser = true;
vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    if (injectUser) req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  };
  return { __esModule: true, default: verifyToken, verifyToken };
});

// Earliest effect_start_date 4 months ago → derivePeriodMonths NOT assumed.
const FOUR_MONTHS_AGO = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const data: Record<string, any[]> = {
  initiatives: [
    { id: 'init-1', name: 'Automatyzacja faktur', status: 'IN_PROGRESS', owner_business_id: 'biz-1', updated_at: new Date().toISOString() },
    { id: 'init-2', name: 'Portal klienta', status: 'COMPLETED', owner_business_id: null, updated_at: new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString() },
  ],
  roi_realized_values: [
    { initiative_id: 'init-1', realized_revenue_delta: 120000, realized_cost_delta: 20000, realized_savings: 10000 },
    { initiative_id: 'init-2', realized_revenue_delta: 50000, realized_cost_delta: 5000, realized_savings: 0 },
  ],
  roi_assumptions: [
    { initiative_id: 'init-1', expected_npv: 300000, expected_revenue_delta: null, expected_cost_delta: null, effect_start_date: FOUR_MONTHS_AGO },
    { initiative_id: 'init-2', expected_npv: null, expected_revenue_delta: 80000, expected_cost_delta: 10000, effect_start_date: FOUR_MONTHS_AGO },
  ],
  initiative_resources: [
    { initiative_id: 'init-1', allocation_percentage: 50 },
    { initiative_id: 'init-2', allocation_percentage: 100 },
  ],
  change_sentiment_snapshots: [
    { initiative_id: 'init-1', avg_rating: 4.2, trend: 'improving' },
  ],
  change_champions: [
    { initiative_id: 'init-1', status: 'active' },
    { initiative_id: 'init-1', status: 'active' },
  ],
  kpi_financial_mappings: [
    { kpi_id: 'kpi-1', statement_line_id: 'line-rev', multiplier: 1, direction: 'positive', current_value: 100, baseline_value: 40 },
    { kpi_id: 'kpi-2', statement_line_id: 'line-cost', multiplier: 1, direction: 'negative', current_value: 30, baseline_value: 50 },
  ],
  initiative_kpis: [
    { id: 'kpi-1', name: 'Przychód', unit: 'PLN', target_value: 200, current_value: 100, measurement_frequency: 'monthly' },
    { id: 'kpi-2', name: 'Koszt obsługi', unit: 'PLN', target_value: 0, current_value: 30, measurement_frequency: 'monthly' },
  ],
};

const defaultDbAll = async (sql: string) => {
  if (/FROM roi_realized_values/i.test(sql)) return data.roi_realized_values;
  if (/FROM roi_assumptions/i.test(sql)) return data.roi_assumptions;
  if (/FROM initiative_resources/i.test(sql)) return data.initiative_resources;
  if (/FROM change_sentiment_snapshots/i.test(sql)) return data.change_sentiment_snapshots;
  if (/FROM change_champions/i.test(sql)) return data.change_champions;
  if (/FROM kpi_financial_mappings/i.test(sql)) return data.kpi_financial_mappings;
  if (/FROM initiative_kpis/i.test(sql)) return data.initiative_kpis;
  if (/FROM initiatives/i.test(sql)) return data.initiatives;
  return [];
};
const dbAll = vi.fn(defaultDbAll);

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  __esModule: true,
  all: (sql: string, ..._rest: any[]) => dbAll(sql),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
  exec: vi.fn(async () => ({ success: true })),
}));

const { default: extendedRouter } = await import(
  '../../../server/src/routes/resultsExtended.routes.js'
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/results-extended', extendedRouter);
  return app;
}

const ENDPOINTS = [
  'signals',
  'run-rate',
  'reallocation',
  'adoption',
  'sustainment',
  'scenarios',
  'counterfactual',
  'finance-link',
  'benefit-profiles',
  'narrative',
  'funnel',
];

beforeEach(() => {
  injectUser = true;
  dbAll.mockReset();
  dbAll.mockImplementation(defaultDbAll);
});

describe('resultsExtended — every endpoint is 200 + 401-gated', () => {
  it.each(ENDPOINTS)('GET /:pid/%s returns 200 with a token', async (ep) => {
    await request(makeApp()).get(`/api/results-extended/all/${ep}`).expect(200);
  });

  it.each(ENDPOINTS)('GET /:pid/%s returns 401 without org context', async (ep) => {
    injectUser = false;
    await request(makeApp()).get(`/api/results-extended/all/${ep}`).expect(401);
  });
});

describe('GET /:pid/signals', () => {
  it('returns signals[] + summary', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/signals').expect(200);
    expect(Array.isArray(res.body.signals)).toBe(true);
    expect(res.body.summary).toBeTypeOf('object');
  });
});

describe('GET /:pid/run-rate', () => {
  it('exposes periodMonths + periodMonthsAssumed (D7)', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/run-rate').expect(200);
    expect(res.body).toHaveProperty('periodMonths');
    expect(res.body).toHaveProperty('periodMonthsAssumed');
    // earliest effect_start_date ~4 months ago → derived, not assumed
    expect(res.body.periodMonthsAssumed).toBe(false);
    expect(res.body.periodMonths).toBeGreaterThanOrEqual(3);
  });

  it('bridge carries annualized / projected / remaining aliases', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/run-rate').expect(200);
    const b = res.body.bridge;
    expect(b).toHaveProperty('annualizedRunRate');
    expect(b).toHaveProperty('projectedFullYear');
    expect(b).toHaveProperty('remainingRunRateContribution');
  });
});

describe('GET /:pid/reallocation', () => {
  it('exposes capacityAssumed + summary.totalAmount', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/reallocation').expect(200);
    expect(res.body).toHaveProperty('capacityAssumed');
    // initiative_resources rows present → capacity is real, not assumed
    expect(res.body.capacityAssumed).toBe(false);
    expect(res.body.summary).toHaveProperty('totalAmount');
    expect(typeof res.body.summary.totalAmount).toBe('number');
  });

  it('flags capacityAssumed=true when no staffing rows exist', async () => {
    dbAll.mockImplementation(async (sql: string) => {
      if (/FROM initiative_resources/i.test(sql)) return [];
      if (/FROM roi_realized_values/i.test(sql)) return data.roi_realized_values;
      if (/FROM roi_assumptions/i.test(sql)) return data.roi_assumptions;
      if (/FROM initiatives/i.test(sql)) return data.initiatives;
      return [];
    });
    const res = await request(makeApp()).get('/api/results-extended/all/reallocation').expect(200);
    expect(res.body.capacityAssumed).toBe(true);
  });
});

describe('GET /:pid/adoption', () => {
  it('dataSource=change-management when adoption tables have rows; flags carry DICE + trend', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/adoption').expect(200);
    expect(res.body.dataSource).toBe('change-management');
    expect(Array.isArray(res.body.flags)).toBe(true);
    const f = res.body.flags[0];
    expect(f).toHaveProperty('diceScore');
    expect(f).toHaveProperty('diceZone');
    expect(f).toHaveProperty('sentimentTrend');
    expect(f).toHaveProperty('championCoveragePct');
  });

  it('falls back to realization-proxy when adoption tables are empty', async () => {
    dbAll.mockImplementation(async (sql: string) => {
      if (/FROM change_sentiment_snapshots/i.test(sql)) return [];
      if (/FROM change_champions/i.test(sql)) return [];
      if (/FROM roi_realized_values/i.test(sql)) return data.roi_realized_values;
      if (/FROM initiatives/i.test(sql)) return data.initiatives;
      return [];
    });
    const res = await request(makeApp()).get('/api/results-extended/all/adoption').expect(200);
    expect(res.body.dataSource).toBe('realization-proxy');
  });
});

describe('GET /:pid/sustainment', () => {
  it('summary exposes sustained/atRisk/overdueReview/unowned buckets', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/sustainment').expect(200);
    const s = res.body.summary;
    expect(s).toHaveProperty('sustained');
    expect(s).toHaveProperty('atRisk');
    expect(s).toHaveProperty('overdueReview');
    expect(s).toHaveProperty('unowned');
    expect(s.total).toBe(2);
    expect(Array.isArray(res.body.statuses)).toBe(true);
    expect(Array.isArray(res.body.calendar)).toBe(true);
  });
});

describe('GET /:pid/scenarios', () => {
  it('returns named scenarios + irr + payback + sensitivity', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/scenarios').expect(200);
    expect(Array.isArray(res.body.scenarios)).toBe(true);
    expect(res.body.scenarios.length).toBe(3);
    for (const sc of res.body.scenarios) {
      expect(sc).toHaveProperty('name');
      expect(typeof sc.name).toBe('string');
    }
    expect(res.body).toHaveProperty('irr');
    expect(res.body).toHaveProperty('paybackPeriod');
    expect(res.body).toHaveProperty('sensitivity');
  });
});

describe('GET /:pid/counterfactual', () => {
  it('returns attributable + counterfactual + confidence', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/counterfactual').expect(200);
    expect(res.body).toHaveProperty('attributable');
    expect(res.body).toHaveProperty('attributablePct');
    expect(res.body).toHaveProperty('counterfactualProjected');
    expect(res.body).toHaveProperty('confidenceLabel');
    expect(res.body).toHaveProperty('totalTarget');
    expect(res.body).toHaveProperty('totalRealized');
  });
});

describe('GET /:pid/finance-link', () => {
  it('aggregate carries totalPositiveImpact / totalNegativeImpact / netImpact', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/finance-link').expect(200);
    const a = res.body.aggregate;
    expect(a).toHaveProperty('totalPositiveImpact');
    expect(a).toHaveProperty('totalNegativeImpact');
    expect(a).toHaveProperty('netImpact');
    expect(a.netImpact).toBeCloseTo(a.totalPositiveImpact + a.totalNegativeImpact, 5);
    expect(res.body.mappingCount).toBe(2);
  });

  it('returns a zeroed aggregate when there are no mappings', async () => {
    dbAll.mockImplementation(async (sql: string) => {
      if (/FROM kpi_financial_mappings/i.test(sql)) return [];
      return [];
    });
    const res = await request(makeApp()).get('/api/results-extended/all/finance-link').expect(200);
    expect(res.body.aggregate.netImpact).toBe(0);
    expect(res.body.mappingCount).toBe(0);
  });
});

describe('GET /:pid/benefit-profiles', () => {
  it('returns profiles[] + summary', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/benefit-profiles').expect(200);
    expect(Array.isArray(res.body.profiles)).toBe(true);
    expect(res.body.profiles.length).toBe(2);
    expect(res.body.summary).toBeTypeOf('object');
  });
});

describe('GET /:pid/narrative', () => {
  it('returns narrative + executiveSummary', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/narrative').expect(200);
    expect(res.body).toHaveProperty('narrative');
    expect(res.body).toHaveProperty('executiveSummary');
  });
});

describe('GET /:pid/funnel', () => {
  it('returns stages[] + conversion[] + valueAtRisk', async () => {
    const res = await request(makeApp()).get('/api/results-extended/all/funnel').expect(200);
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(res.body.stages.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('conversion');
    expect(res.body).toHaveProperty('valueAtRisk');
    expect(res.body.total).toBe(2);
  });
});
