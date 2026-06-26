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
    expect(results.disclaimers.length).toBeGreaterThan(0);

    // B2 — numeric DCF assertions, hand-derived from computeDcf() (valuationService.ts:688-729),
    // NOT snapshotted from the service output. WACC = waccPercent = 12% (the engine uses
    // assumptions.waccPercent directly, NOT the waccBreakdown which would give ~8.94%).
    // Input FCFF: Y1=100, Y2=110, Y3=120; gordon g=3%; netDebt=0; no shares.
    //   pvExplicit = 100/1.12 + 110/1.12^2 + 120/1.12^3
    //              = 89.285714 + 87.691327 + 85.413527 = 262.39
    expect(results.dcf.pvExplicit).toBeCloseTo(262.39, 2);
    //   terminalValue (gordon) = lastFcff*(1+g)/(wacc-g) = 120*1.03/(0.12-0.03) = 123.6/0.09 = 1373.33
    expect(results.dcf.terminalValue).toBeCloseTo(1373.33, 2);
    //   pvTerminal = 1373.3333 / 1.12^3 = 1373.3333 / 1.404928 = 977.51
    //   enterpriseValue = pvExplicit + pvTerminal = 262.39 + 977.51 = 1239.90
    expect(results.dcf.enterpriseValue).toBeCloseTo(1239.9, 2);
    //   equityValue = enterpriseValue - netDebt = 1239.90 - 0 = 1239.90
    expect(results.dcf.equityValue).toBeCloseTo(1239.9, 2);
    //   discountRatePercent echoes the WACC actually used for discounting
    expect(results.dcf.discountRatePercent).toBeCloseTo(12, 2);
    //   no sharesOutstanding in assumptions → perShare is undefined (not 0/NaN)
    expect(results.dcf.perShare).toBeUndefined();

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE valuations SET results = ?'),
      [expect.any(String), 'val-1', 'org-1']
    );

    // REGRESJA (comps zero na manual): manual loader MUSI wyprowadzić companyMetric
    // z ostatniego roku prognozy, inaczej computeComps daje impliedEnterpriseValue=0
    // i pasmo comps na football-field zapada się mimo ustawionych peers.
    // base = ebitdaLastYear (Y3) = 100; EV/EBITDA min/median/max = 6/8/10 → 600/800/1000.
    expect(results.comps).toBeTruthy();
    expect(results.comps.impliedEnterpriseValue.min).toBeCloseTo(600, 2);
    expect(results.comps.impliedEnterpriseValue.median).toBeCloseTo(800, 2);
    expect(results.comps.impliedEnterpriseValue.max).toBeCloseTo(1000, 2);
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
