/**
 * Unit Tests for BudgetService
 * 
 * Tests budget management functionality:
 * - Budget creation
 * - Totals calculation
 * - Burn rate calculation
 * - Forecast at completion
 * - Alert generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import BudgetService from '../../../server/services/budgetService';
import queryHelpers from '../../../server/utils/queryHelpers';

vi.mock('../../../server/utils/queryHelpers', () => {
    const mockHelpers = {
        queryOne: vi.fn(),
        queryAll: vi.fn(),
        queryRun: vi.fn(),
        queryParallel: vi.fn(),
        transaction: vi.fn()
    };
    return {
        ...mockHelpers,
        default: mockHelpers,
    };
});

vi.mock('../../../server/database', () => ({ default: {} }));
vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

describe('BudgetService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // afterEach is no longer needed as we are not using vi.spyOn and vi.restoreAllMocks()

    describe('createBudget', () => {
        it('should create a budget with correct contingency calculation', async () => {
            queryHelpers.queryRun.mockResolvedValue();

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

            expect(queryHelpers.queryRun).toHaveBeenCalledTimes(1);
        });

        it('should use default values when not provided', async () => {
            queryHelpers.queryRun.mockResolvedValue();

            const result = await BudgetService.createBudget(
                'org-1',
                'init-1',
                {},
                'user-1'
            );

            expect(result).toMatchObject({
                plannedAmount: 0,
                contingencyAmount: 0
            });
        });
    });

    describe('calculateTotals', () => {
        it('should calculate correct totals from line items', async () => {
            queryHelpers.queryOne
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

        it('should return WARNING status when 80-95% consumed', async () => {
            queryHelpers.queryOne
                .mockResolvedValueOnce({
                    total_planned: 100000,
                    total_actual: 85000,
                    total_committed: 5000,
                    total_forecast: 100000
                })
                .mockResolvedValueOnce({
                    planned_amount: 100000,
                    approved_amount: 100000,
                    contingency_amount: 10000
                });

            const totals = await BudgetService.calculateTotals('budget-1');

            expect(totals.status).toBe('WARNING');
            expect(totals.consumedPercent).toBe(85);
        });

        it('should return OVERRUN status when over 100% consumed', async () => {
            queryHelpers.queryOne
                .mockResolvedValueOnce({
                    total_planned: 100000,
                    total_actual: 110000,
                    total_committed: 0,
                    total_forecast: 110000
                })
                .mockResolvedValueOnce({
                    planned_amount: 100000,
                    approved_amount: 100000,
                    contingency_amount: 10000
                });

            const totals = await BudgetService.calculateTotals('budget-1');

            expect(totals.status).toBe('OVERRUN');
            expect(totals.isOverBudget).toBe(true);
        });
    });

    describe('calculateBurnRate', () => {
        it('should calculate monthly burn rate from transactions', async () => {
            queryHelpers.queryAll.mockResolvedValue([
                { total: 15000, count: 5, month: '2024-12' },
                { total: 12000, count: 4, month: '2024-11' },
                { total: 18000, count: 6, month: '2024-10' }
            ]);

            const burnRate = await BudgetService.calculateBurnRate('budget-1');

            expect(burnRate.monthlyBurnRate).toBe(15000);
            expect(burnRate.averageMonthly).toBe(15000);
            expect(burnRate.trend).toBe('STABLE');
        });

        it('should detect increasing trend', async () => {
            queryHelpers.queryAll.mockResolvedValue([
                { total: 25000, count: 5, month: '2024-12' },
                { total: 15000, count: 4, month: '2024-11' }
            ]);

            const burnRate = await BudgetService.calculateBurnRate('budget-1');

            expect(burnRate.trend).toBe('INCREASING');
        });

        it('should detect decreasing trend', async () => {
            queryHelpers.queryAll.mockResolvedValue([
                { total: 10000, count: 5, month: '2024-12' },
                { total: 20000, count: 4, month: '2024-11' }
            ]);

            const burnRate = await BudgetService.calculateBurnRate('budget-1');

            expect(burnRate.trend).toBe('DECREASING');
        });

        it('should return zero burn rate when no transactions', async () => {
            queryHelpers.queryAll.mockResolvedValue([]);

            const burnRate = await BudgetService.calculateBurnRate('budget-1');

            expect(burnRate.monthlyBurnRate).toBe(0);
            expect(burnRate.trend).toBe('STABLE');
        });
    });

    describe('forecastCompletion', () => {
        it('should calculate EAC based on progress', async () => {
            queryHelpers.queryOne
                .mockResolvedValueOnce({ initiative_id: 'init-1' })
                .mockResolvedValueOnce({
                    total_planned: 100000,
                    total_actual: 50000,
                    total_committed: 0,
                    total_forecast: 100000
                })
                .mockResolvedValueOnce({
                    planned_amount: 100000,
                    approved_amount: 100000,
                    contingency_amount: 10000
                })
                .mockResolvedValueOnce({
                    progress: 50,
                    planned_end_date: '2025-06-30'
                });

            queryHelpers.queryAll.mockResolvedValue([]);

            const forecast = await BudgetService.forecastCompletion('budget-1');

            expect(forecast).toBeDefined();
            expect(forecast.estimateAtCompletion).toBeGreaterThan(0);
            expect(forecast.costPerformanceIndex).toBeGreaterThan(0);
        });

        it('should return null for non-existent budget', async () => {
            queryHelpers.queryOne.mockResolvedValue(null);

            const forecast = await BudgetService.forecastCompletion('non-existent');

            expect(forecast).toBeNull();
        });
    });

    describe('checkAlerts', () => {
        it('should generate warning alert at 80% consumption', async () => {
            queryHelpers.queryOne
                .mockResolvedValueOnce({
                    total_planned: 100000,
                    total_actual: 82000,
                    total_committed: 0,
                    total_forecast: 100000
                })
                .mockResolvedValueOnce({
                    planned_amount: 100000,
                    approved_amount: 100000,
                    contingency_amount: 10000
                })
                .mockResolvedValueOnce(null); // No existing alert

            queryHelpers.queryRun.mockResolvedValue();

            const alerts = await BudgetService.checkAlerts('budget-1');

            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].alertType).toBe('THRESHOLD_WARNING');
            expect(alerts[0].severity).toBe('WARNING');
        });

        it('should generate overrun alert at 100%+ consumption', async () => {
            queryHelpers.queryOne
                .mockResolvedValueOnce({
                    total_planned: 100000,
                    total_actual: 105000,
                    total_committed: 0,
                    total_forecast: 110000
                })
                .mockResolvedValueOnce({
                    planned_amount: 100000,
                    approved_amount: 100000,
                    contingency_amount: 10000
                })
                .mockResolvedValueOnce(null);

            queryHelpers.queryRun.mockResolvedValue();

            const alerts = await BudgetService.checkAlerts('budget-1');

            expect(alerts[0].alertType).toBe('OVERRUN');
            expect(alerts[0].severity).toBe('CRITICAL');
        });
    });

    describe('getPortfolioSummary', () => {
        it('should aggregate portfolio budget data', async () => {
            queryHelpers.queryAll.mockResolvedValue([
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
            expect(summary.initiativeCount).toBe(2);
            expect(summary.healthCounts.warning).toBeGreaterThanOrEqual(0);
        });
    });

    describe('BUDGET_CATEGORIES', () => {
        it('should export all budget categories', () => {
            expect(BudgetService.BUDGET_CATEGORIES).toBeDefined();
            expect(BudgetService.BUDGET_CATEGORIES.PERSONNEL).toBe('PERSONNEL');
            expect(BudgetService.BUDGET_CATEGORIES.TECHNOLOGY).toBe('TECHNOLOGY');
        });
    });

    describe('BUDGET_TYPES', () => {
        it('should export all budget types', () => {
            expect(BudgetService.BUDGET_TYPES).toBeDefined();
            expect(BudgetService.BUDGET_TYPES.CAPEX).toBe('CAPEX');
            expect(BudgetService.BUDGET_TYPES.OPEX).toBe('OPEX');
            expect(BudgetService.BUDGET_TYPES.COMBINED).toBe('COMBINED');
        });
    });
});

