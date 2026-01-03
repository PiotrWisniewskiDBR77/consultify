/**
 * Unit Tests for BudgetService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import BudgetService from '../../../server/services/budgetService';

// Mock dependencies
const mockQueryHelpers = {
    queryOne: vi.fn(),
    queryAll: vi.fn(),
    queryRun: vi.fn(),
    queryParallel: vi.fn(),
    transaction: vi.fn()
};

const mockUuid = {
    v4: vi.fn(() => 'test-uuid-123')
};

describe('BudgetService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        BudgetService.setDependencies({
            queryHelpers: mockQueryHelpers,
            uuidv4: mockUuid.v4
        });
    });

    describe('createBudget', () => {
        it('should create a budget with correct contingency calculation', async () => {
            mockQueryHelpers.queryRun.mockResolvedValue({ lastID: 1, changes: 1 });

            const result = await BudgetService.createBudget(
                'org-1',
                'init-1',
                { plannedAmount: 100000, contingencyPercent: 10 },
                'user-1'
            );

            expect(result).toMatchObject({
                id: 'test-uuid-123',
                initiativeId: 'init-1',
                plannedAmount: 100000,
                contingencyAmount: 10000
            });

            expect(mockQueryHelpers.queryRun).toHaveBeenCalled();
        });
    });

    describe('calculateTotals', () => {
        it('should calculate correct totals from line items', async () => {
            mockQueryHelpers.queryOne
                .mockResolvedValueOnce({
                    total_planned: 50000,
                    total_actual: 30000,
                    total_committed: 10000,
                    total_forecast: 55000
                })
                .mockResolvedValueOnce({
                    planned_amount: 50000,
                    approved_amount: 50000,
                    contingency_amount: 5000
                });

            const totals = await BudgetService.calculateTotals('budget-1');

            expect(totals).toMatchObject({
                totalPlanned: 50000,
                totalActual: 30000,
                totalCommitted: 10000,
                remaining: 20000,
                consumedPercent: 60,
                isOverBudget: false,
                status: 'ON_TRACK'
            });
        });
    });

    describe('calculateBurnRate', () => {
        it('should calculate monthly burn rate from transactions', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([
                { total: 15000, count: 5, month: '2024-12' },
                { total: 14000, count: 4, month: '2024-11' },
                { total: 16000, count: 6, month: '2024-10' }
            ]);

            const burnRate = await BudgetService.calculateBurnRate('budget-1');

            expect(burnRate.monthlyBurnRate).toBe(15000);
            expect(burnRate.averageMonthly).toBe(15000);
            expect(burnRate.trend).toBe('STABLE');
        });
    });

    describe('getPortfolioSummary', () => {
        it('should aggregate portfolio budget data', async () => {
            mockQueryHelpers.queryAll.mockResolvedValue([
                {
                    id: 'budget-1',
                    initiative_id: 'init-1',
                    initiative_name: 'Initiative 1',
                    initiative_status: 'EXECUTING',
                    planned_amount: 100000,
                    approved_amount: 100000,
                    total_actual: 50000,
                    total_committed: 10000,
                    currency: 'PLN'
                },
                {
                    id: 'budget-2',
                    initiative_id: 'init-2',
                    initiative_name: 'Initiative 2',
                    initiative_status: 'EXECUTING',
                    planned_amount: 200000,
                    approved_amount: 200000,
                    total_actual: 180000,
                    total_committed: 15000,
                    currency: 'PLN'
                }
            ]);

            const summary = await BudgetService.getPortfolioSummary('org-1');

            expect(summary.initiatives).toHaveLength(2);
            expect(summary.totals.totalPlanned).toBe(300000);
            expect(summary.totals.totalActual).toBe(230000);
        });
    });
});




