/**
 * Billing Cron Job Tests
 * ETAP 6: Testy dla billing cron jobs (80%+ coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Removed createRequire

describe('BillingCron', () => {
    let BillingCron;
    let mockDb;
    let mockBudgetService;
    let mockAdminAlertService;
    let mockPayAsYouGoService;
    let mockSeatManagementService;

    beforeEach(async () => { // Async beforeEach
        vi.resetModules();

        mockDb = {
            all: vi.fn()
        };

        mockBudgetService = {
            resetMonthlyBudgets: vi.fn().mockResolvedValue(undefined)
        };

        mockAdminAlertService = {
            checkAndTriggerAlerts: vi.fn().mockResolvedValue({ triggeredCount: 0 })
        };

        mockPayAsYouGoService = {
            generatePayAsYouGoInvoice: vi.fn().mockResolvedValue({ invoiced: false })
        };

        mockSeatManagementService = {
            updateSeatCount: vi.fn().mockResolvedValue(undefined)
        };

        vi.doMock('../../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../../server/services/budgetService', () => ({
            default: mockBudgetService
        }));

        vi.doMock('../../../../server/services/adminAlertService', () => ({
            default: mockAdminAlertService
        }));

        vi.doMock('../../../../server/services/payAsYouGoService', () => ({
            default: mockPayAsYouGoService
        }));

        vi.doMock('../../../../server/services/seatManagementService', () => ({
            default: mockSeatManagementService
        }));

        const module = await import('../../../../server/cron/billingCron.ts');
        BillingCron = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../../server/database');
        vi.doUnmock('../../../../server/services/budgetManagementService');
        vi.doUnmock('../../../../server/services/adminAlertService');
        vi.doUnmock('../../../../server/services/payAsYouGoService');
        vi.doUnmock('../../../../server/services/seatManagementService');
    });

    describe('resetMonthlyBudgets', () => {
        it('should reset monthly budgets successfully', async () => {
            await BillingCron.resetMonthlyBudgets();

            expect(mockBudgetService.resetMonthlyBudgets).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            mockBudgetService.resetMonthlyBudgets.mockRejectedValue(new Error('Reset failed'));

            await expect(BillingCron.resetMonthlyBudgets()).resolves.not.toThrow();
        });
    });

    describe('checkAndTriggerAlerts', () => {
        it('should check alerts for all active organizations', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { id: 'org-1' },
                    { id: 'org-2' }
                ]);
            });

            await BillingCron.checkAndTriggerAlerts();

            expect(mockDb.all).toHaveBeenCalledWith(
                'SELECT id FROM organizations WHERE status = ?',
                ['active'],
                expect.any(Function)
            );
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenCalledTimes(2);
        });

        it('should handle database errors', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(BillingCron.checkAndTriggerAlerts()).resolves.not.toThrow();
        });

        it('should continue processing even if one org fails', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ id: 'org-1' }, { id: 'org-2' }]);
            });

            mockAdminAlertService.checkAndTriggerAlerts
                .mockResolvedValueOnce({ triggeredCount: 1 })
                .mockRejectedValueOnce(new Error('Org 2 failed'));

            await expect(BillingCron.checkAndTriggerAlerts()).resolves.not.toThrow();
        });
    });

    describe('generatePayAsYouGoInvoices', () => {
        it('should generate invoices for PAYG organizations', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ organization_id: 'org-1' }]);
            });

            mockPayAsYouGoService.generatePayAsYouGoInvoice.mockResolvedValue({
                invoiced: true,
                totalCost: 100.50
            });

            await BillingCron.generatePayAsYouGoInvoices();

            expect(mockPayAsYouGoService.generatePayAsYouGoInvoice).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(BillingCron.generatePayAsYouGoInvoices()).resolves.not.toThrow();
        });
    });

    describe('updateSeatCounts', () => {
        it('should update seat counts for all active organizations', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [{ id: 'org-1' }, { id: 'org-2' }]);
            });

            await BillingCron.updateSeatCounts();

            expect(mockSeatManagementService.updateSeatCount).toHaveBeenCalledTimes(2);
        });

        it('should handle errors gracefully', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(BillingCron.updateSeatCounts()).resolves.not.toThrow();
        });
    });

    describe('calculateMonthlyUsage', () => {
        it('should complete without errors', async () => {
            await expect(BillingCron.calculateMonthlyUsage()).resolves.not.toThrow();
        });
    });
});










