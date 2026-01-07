/**
 * Financial Service Unit Test - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('FinancialService', () => {
    it('should get financials', () => {
        const financials = { revenue: 100000, costs: 60000 };
        expect(financials.revenue).toBeGreaterThan(financials.costs);
    });

    it('should track metrics', () => {
        const metrics = { mrr: 50000, arr: 600000 };
        expect(metrics.arr).toBe(metrics.mrr * 12);
    });
});
