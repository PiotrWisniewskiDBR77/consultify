/**
 * L1: Partner settlements summary (honest unit test)
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

const dbGet = vi.fn();

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: vi.fn(async () => []),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
}));

import { getSettlementsSummary } from '../../server/src/services/partnerCommissionService.js';

describe('partnerCommissionService.getSettlementsSummary', () => {
  it('returns computed summary from DbPromise.get', async () => {
    dbGet.mockResolvedValueOnce({
      pending_commissions: 2,
      pending_commission_amount: 120,
      pending_payouts: 1,
      pending_payout_amount: 50,
      this_month_commissions: 200,
      this_month_payouts: 75,
    });

    const res = await getSettlementsSummary();

    expect(res.totalPendingCommissions).toBe(2);
    expect(res.pendingCommissionAmount).toBe(120);
    expect(res.totalPendingPayouts).toBe(1);
    expect(res.pendingPayoutAmount).toBe(50);
    expect(res.thisMonthCommissions).toBe(200);
    expect(res.thisMonthPayouts).toBe(75);
  });

  it('returns zeros on error', async () => {
    dbGet.mockRejectedValueOnce(new Error('db down'));
    const res = await getSettlementsSummary();
    expect(res.totalPendingCommissions).toBe(0);
    expect(res.totalPendingPayouts).toBe(0);
    expect(res.pendingCommissionAmount).toBe(0);
    expect(res.pendingPayoutAmount).toBe(0);
  });
});
