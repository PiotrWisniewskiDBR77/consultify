import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/services/auditService.js', () => ({
  log: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'fixed-uuid-0001',
}));

import {
  approveValuation,
  generateAdvisory,
  generateNegotiationPack,
} from '../../../server/src/services/valuationService';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';

const baseValuation = {
  id: 'val-1',
  organization_id: 'org-1',
  status: 'DRAFT',
  horizon_years: 3,
  currency: 'PLN',
  source_type: 'manual',
  source_id: null,
  project_id: null,
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
    manualForecast: {
      years: [
        { year: 1, fcff: 100, revenue: 400, ebitda: 80 },
        { year: 2, fcff: 110, revenue: 430, ebitda: 90 },
        { year: 3, fcff: 120, revenue: 470, ebitda: 100 },
      ],
    },
  }),
  peers: '[]',
  results: JSON.stringify({
    dcf: {
      enterpriseValue: 1234,
      pvExplicit: 400,
      pvTerminal: 800,
      discountRatePercent: 12,
      terminalMethod: 'gordon',
      terminalGrowthPercent: 3,
    },
    tornado: [{ driver: 'WACC (±1%)' }, { driver: 'FCFF level (±5%)' }],
  }),
  version: 1,
};

describe('valuationService approval + advisory + negotiation pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approveValuation requires computed results', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      ...baseValuation,
      results: JSON.stringify({}),
    });

    await expect(approveValuation('org-1', 'val-1', 'user-1')).rejects.toThrow(
      'Compute valuation before approval'
    );
  });

  it('approveValuation validates terminal growth vs WACC', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      ...baseValuation,
      assumptions: JSON.stringify({
        ...JSON.parse(baseValuation.assumptions),
        terminalMethod: 'gordon',
        terminalGrowthPercent: 15,
        waccPercent: 10,
      }),
    });

    await expect(approveValuation('org-1', 'val-1', 'user-1')).rejects.toThrow(
      'terminal growth must be lower than WACC'
    );
  });

  it('approveValuation writes snapshot and marks approved', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockResolvedValue(baseValuation);

    await approveValuation('org-1', 'val-1', 'user-1');

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO valuation_snapshots'),
      expect.arrayContaining(['val-1', 1])
    );
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('SET status = \'APPROVED\''),
      ['user-1', expect.any(String), 'val-1', 'org-1']
    );
  });

  it('generateAdvisory requires approved status', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      ...baseValuation,
      status: 'DRAFT',
    });

    await expect(generateAdvisory('org-1', 'val-1')).rejects.toThrow(
      'Valuation must be APPROVED'
    );
  });

  it('generateAdvisory writes advisory with evidence lines', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockResolvedValue({
      ...baseValuation,
      status: 'APPROVED',
    });

    const advisory = await generateAdvisory('org-1', 'val-1');

    expect(advisory.recommendations.length).toBeGreaterThan(5);
    expect(advisory.recommendations[0].evidence.join(' ')).toContain('EV: 1234');
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE valuations SET advisory'),
      [expect.any(String), 'val-1', 'org-1']
    );
  });

  it('generateNegotiationPack requires approved status', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      ...baseValuation,
      status: 'DRAFT',
    });

    await expect(generateNegotiationPack('org-1', 'val-1')).rejects.toThrow(
      'Valuation must be APPROVED'
    );
  });

  it('generateNegotiationPack includes drivers and writes pack', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockResolvedValue({
      ...baseValuation,
      status: 'APPROVED',
    });

    const pack = await generateNegotiationPack('org-1', 'val-1');

    expect(pack.proPoints.length).toBeGreaterThan(1);
    const driversPoint = pack.proPoints.find((p: any) => p.title.includes('drivers'));
    expect(driversPoint?.evidence?.length).toBeGreaterThan(0);
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE valuations SET negotiation_pack'),
      [expect.any(String), 'val-1', 'org-1']
    );
  });
});
