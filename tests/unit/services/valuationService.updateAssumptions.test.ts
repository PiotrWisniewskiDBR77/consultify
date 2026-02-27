import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/services/auditService.js', () => ({
  log: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateAssumptions, updatePeers } from '../../../server/src/services/valuationService';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import * as audit from '../../../server/src/services/auditService.js';

describe('valuationService updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateAssumptions merges wacc breakdown and manual forecast, and downgrades approved to draft', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM valuations')) {
        return {
          id: 'val-1',
          organization_id: 'org-1',
          status: 'APPROVED',
          assumptions: JSON.stringify({
            horizonYears: 5,
            waccPercent: 10,
            waccBreakdown: {
              riskFreeRate: 4,
              equityRiskPremium: 5,
              beta: 1.1,
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
            manualForecast: { years: [{ year: 1, fcff: 100 }] },
          }),
        };
      }
      if (sql.includes('SELECT status FROM valuations')) {
        return { status: 'APPROVED' };
      }
      return null;
    });

    await updateAssumptions('org-1', 'val-1', {
      waccPercent: 13,
      waccBreakdown: { beta: 1.4 },
      manualForecast: { years: [{ year: 1, fcff: 120 }, { year: 2, fcff: 150 }] },
    }, {
      userId: 'u-1',
      userEmail: 'user@example.com',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    // First update: approved -> draft
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE valuations SET status = 'DRAFT'"),
      ['val-1', 'org-1']
    );

    // Second update: assumptions JSON persisted
    const updateCall = dbRun.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE valuations SET assumptions')
    );
    expect(updateCall).toBeTruthy();
    const updateArgs = updateCall?.[1] as any[];
    const saved = JSON.parse(updateArgs[0]);
    expect(saved.waccPercent).toBe(13);
    expect(saved.waccBreakdown.beta).toBe(1.4);
    expect(saved.waccBreakdown.riskFreeRate).toBe(4);
    expect(saved.manualForecast.years).toHaveLength(2);

    expect(vi.mocked(audit.log)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.valuation_assumption_updated',
        resourceId: 'val-1',
        organizationId: 'org-1',
      })
    );
  });

  it('updatePeers stores multiples and writes audit log', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM valuations')) {
        return {
          id: 'val-2',
          organization_id: 'org-2',
          status: 'DRAFT',
          peers: JSON.stringify({ metric: 'EV/EBITDA', min: 5, median: 7, max: 10, peerSet: [] }),
        };
      }
      if (sql.includes('SELECT status FROM valuations')) {
        return { status: 'DRAFT' };
      }
      return null;
    });

    await updatePeers(
      'org-2',
      'val-2',
      {
        metric: 'EV/Revenue',
        min: 2,
        median: 4,
        max: 6,
        peerSet: [{ name: 'Peer 1' }],
      },
      { userId: 'u-2' }
    );

    const updateCall = dbRun.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE valuations SET peers')
    );
    expect(updateCall).toBeTruthy();
    const updateArgs = updateCall?.[1] as any[];
    expect(JSON.parse(updateArgs[0])).toMatchObject({
      metric: 'EV/Revenue',
      min: 2,
      median: 4,
      max: 6,
    });

    expect(vi.mocked(audit.log)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.valuation_peer_set_updated',
        resourceId: 'val-2',
        organizationId: 'org-2',
      })
    );
  });
});
