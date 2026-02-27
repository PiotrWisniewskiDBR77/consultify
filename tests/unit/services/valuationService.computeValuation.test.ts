import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/services/auditService.js', () => ({
  log: vi.fn(),
}));

import { computeValuation } from '../../../server/src/services/valuationService';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';

describe('valuationService.computeValuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes valuation for manual forecast and persists results', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 3,
      currency: 'PLN',
      source_type: 'manual',
      source_id: null,
      assumptions: JSON.stringify({
        horizonYears: 3,
        waccPercent: 12,
        waccBreakdown: {
          riskFreeRate: 4,
          equityRiskPremium: 5,
          beta: 1.2,
          costOfDebt: 8,
          taxRate: 19,
          debtWeight: 30,
          equityWeight: 70,
        },
        terminalMethod: 'gordon',
        terminalGrowthPercent: 3,
        exitMultiple: 8,
        exitMultipleMetric: 'EV/EBITDA',
        netDebt: 0,
        manualForecast: {
          years: [
            { year: 1, fcff: 100, revenue: 400, ebitda: 80 },
            { year: 2, fcff: 110, revenue: 430, ebitda: 90 },
            { year: 3, fcff: 120, revenue: 470, ebitda: 100 },
          ],
        },
      }),
      peers: JSON.stringify({
        metric: 'EV/EBITDA',
        min: 6,
        median: 8,
        max: 10,
        peerSet: [{ name: 'Peer A' }],
      }),
      results: '{}',
    });

    const results = await computeValuation('org-1', 'val-1');

    expect(results.source.type).toBe('manual');
    expect(results.forecast.years).toHaveLength(3);
    expect(results.dcf.enterpriseValue).toBeTypeOf('number');
    expect(results.disclaimers.length).toBeGreaterThan(0);

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE valuations SET results = ?'),
      [expect.any(String), 'val-1', 'org-1']
    );
  });

  it('throws when manual forecast is missing', async () => {
    const dbGet = vi.mocked(DbPromise.get);

    dbGet.mockResolvedValue({
      id: 'val-2',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 3,
      currency: 'PLN',
      source_type: 'manual',
      source_id: null,
      assumptions: JSON.stringify({
        horizonYears: 3,
        waccPercent: 12,
        manualForecast: { years: [] },
      }),
      peers: '[]',
      results: '{}',
    });

    await expect(computeValuation('org-1', 'val-2')).rejects.toThrow('Manual forecast missing');
  });
});
