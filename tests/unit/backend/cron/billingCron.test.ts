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

        // billingCron.ts's initDeps() dynamically imports these exact paths
        // (server/cron/billingCron.ts:55-73) — the mocks below were pointed at
        // stale paths (server/database, server/services/budgetService without
        // "src", "Management") that don't match, so none of them were ever
        // actually intercepted; fixed to match the real specifiers.
        vi.doMock('../../../../server/src/database/Database.js', () => ({
            getDatabase: () => mockDb
        }));

        vi.doMock('../../../../server/src/services/budgetManagementService.js', () => ({
            default: mockBudgetService
        }));

        vi.doMock('../../../../server/src/services/adminAlertService.js', () => ({
            default: mockAdminAlertService
        }));

        vi.doMock('../../../../server/src/services/payAsYouGoService.js', () => ({
            default: mockPayAsYouGoService
        }));

        vi.doMock('../../../../server/src/services/seatManagementService.js', () => ({
            default: mockSeatManagementService
        }));

        const module = await import('../../../../server/cron/billingCron.ts');
        BillingCron = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../../server/src/database/Database.js');
        vi.doUnmock('../../../../server/src/services/budgetManagementService.js');
        vi.doUnmock('../../../../server/src/services/adminAlertService.js');
        vi.doUnmock('../../../../server/src/services/payAsYouGoService.js');
        vi.doUnmock('../../../../server/src/services/seatManagementService.js');
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
            // deps.db.all() in server/cron/billingCron.ts is called Promise-style
            // (`await deps.db.all(sql, params)`, no callback) — this test previously
            // mocked a 3-arg callback-style signature, which doesn't match.
            mockDb.all.mockResolvedValue([
                { id: 'org-1' },
                { id: 'org-2' }
            ]);

            await BillingCron.checkAndTriggerAlerts();

            expect(mockDb.all).toHaveBeenCalledWith(
                'SELECT id FROM organizations WHERE status = ?',
                ['active']
            );
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenCalledTimes(2);
        });

        it('should handle database errors', async () => {
            mockDb.all.mockRejectedValue(new Error('DB Error'));

            await expect(BillingCron.checkAndTriggerAlerts()).resolves.not.toThrow();
            expect(mockDb.all).toHaveBeenCalledWith(
                'SELECT id FROM organizations WHERE status = ?',
                ['active']
            );
            expect(mockAdminAlertService.checkAndTriggerAlerts).not.toHaveBeenCalled();
        });

        it('should continue processing even if one org fails', async () => {
            mockDb.all.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);

            mockAdminAlertService.checkAndTriggerAlerts
                .mockResolvedValueOnce({ triggeredCount: 1 })
                .mockRejectedValueOnce(new Error('Org 2 failed'));

            await expect(BillingCron.checkAndTriggerAlerts()).resolves.not.toThrow();
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenNthCalledWith(1, 'org-1');
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenNthCalledWith(2, 'org-2');
        });
    });

    describe('generatePayAsYouGoInvoices', () => {
        it('should generate invoices for PAYG organizations', async () => {
            // deps.db.all() is called Promise-style (no callback) in
            // server/cron/billingCron.ts — see checkAndTriggerAlerts fix above.
            mockDb.all.mockResolvedValue([{ organization_id: 'org-1' }]);

            mockPayAsYouGoService.generatePayAsYouGoInvoice.mockResolvedValue({
                invoiced: true,
                totalCost: 100.50
            });

            await BillingCron.generatePayAsYouGoInvoices();

            expect(mockPayAsYouGoService.generatePayAsYouGoInvoice).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            mockDb.all.mockRejectedValue(new Error('DB Error'));

            await expect(BillingCron.generatePayAsYouGoInvoices()).resolves.not.toThrow();
        });
    });

    describe('updateSeatCounts', () => {
        it('should update seat counts for all active organizations', async () => {
            mockDb.all.mockResolvedValue([{ id: 'org-1' }, { id: 'org-2' }]);

            await BillingCron.updateSeatCounts();

            expect(mockSeatManagementService.updateSeatCount).toHaveBeenCalledTimes(2);
        });

        it('should handle errors gracefully', async () => {
            mockDb.all.mockRejectedValue(new Error('DB Error'));

            await expect(BillingCron.updateSeatCounts()).resolves.not.toThrow();
        });
    });

    describe('calculateMonthlyUsage', () => {
        it('should complete without errors', async () => {
            await expect(BillingCron.calculateMonthlyUsage()).resolves.not.toThrow();
        });
    });
});









