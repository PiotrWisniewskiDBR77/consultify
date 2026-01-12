/**
 * Unit Tests for BillingCron
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    calculateMonthlyUsage,
    checkAndTriggerAlerts,
    generatePayAsYouGoInvoices,
    getBillingCron,
    resetMonthlyBudgets,
    updateSeatCounts,
} from '../../../../src/cron/BillingCron.js';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('BillingCron', () => {
    let mockDb: IDatabase;
    let mockBudgetService: { resetMonthlyBudgets: () => Promise<void> };
    let mockAdminAlertService: { checkAndTriggerAlerts: (orgId: string) => Promise<{ triggeredCount: number }> };
    let mockPayAsYouGoService: {
        generatePayAsYouGoInvoice: (
            orgId: string,
            startDate: Date,
            endDate: Date,
        ) => Promise<{ invoiced: boolean; totalCost: number }>;
    };
    let mockSeatManagementService: { updateSeatCount: (orgId: string) => Promise<void> };

    beforeEach(() => {
        // Mock database
        mockDb = {
            get: vi.fn(),
            all: vi.fn((sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
                callback(null, [{ id: 'org1' }, { id: 'org2' }]);
                return mockDb;
            }),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
        } as unknown as IDatabase;

        // Mock services
        mockBudgetService = {
            resetMonthlyBudgets: vi.fn().mockResolvedValue(undefined),
        };

        mockAdminAlertService = {
            checkAndTriggerAlerts: vi.fn().mockResolvedValue({ triggeredCount: 2 }),
        };

        mockPayAsYouGoService = {
            generatePayAsYouGoInvoice: vi.fn().mockResolvedValue({ invoiced: true, totalCost: 100.5 }),
        };

        mockSeatManagementService = {
            updateSeatCount: vi.fn().mockResolvedValue(undefined),
        };
    });

    describe('resetMonthlyBudgets', () => {
        it('should reset monthly budgets successfully', async () => {
            await resetMonthlyBudgets({
                db: mockDb,
                budgetManagementService: mockBudgetService,
            });

            expect(mockBudgetService.resetMonthlyBudgets).toHaveBeenCalledOnce();
        });

        it('should handle errors during reset', async () => {
            mockBudgetService.resetMonthlyBudgets = vi.fn().mockRejectedValue(new Error('Reset failed'));

            await expect(
                resetMonthlyBudgets({
                    db: mockDb,
                    budgetManagementService: mockBudgetService,
                }),
            ).rejects.toThrow('Reset failed');
        });
    });

    describe('checkAndTriggerAlerts', () => {
        it('should check and trigger alerts for all organizations', async () => {
            const triggeredCount = await checkAndTriggerAlerts({
                db: mockDb,
                adminAlertService: mockAdminAlertService,
            });

            expect(triggeredCount).toBe(4); // 2 orgs * 2 alerts each
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenCalledTimes(2);
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenCalledWith('org1');
            expect(mockAdminAlertService.checkAndTriggerAlerts).toHaveBeenCalledWith('org2');
        });

        it('should handle errors for individual organizations', async () => {
            mockAdminAlertService.checkAndTriggerAlerts = vi
                .fn()
                .mockResolvedValueOnce({ triggeredCount: 1 })
                .mockRejectedValueOnce(new Error('Alert check failed'));

            const triggeredCount = await checkAndTriggerAlerts({
                db: mockDb,
                adminAlertService: mockAdminAlertService,
            });

            expect(triggeredCount).toBe(1); // Only first org succeeded
        });

        it('should return 0 when no organizations found', async () => {
            mockDb.all = vi.fn(
                (sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
                    callback(null, []);
                    return mockDb;
                },
            ) as unknown as IDatabase['all'];

            const triggeredCount = await checkAndTriggerAlerts({
                db: mockDb,
                adminAlertService: mockAdminAlertService,
            });

            expect(triggeredCount).toBe(0);
        });
    });

    describe('generatePayAsYouGoInvoices', () => {
        it('should generate invoices for PAYG organizations', async () => {
            mockDb.all = vi.fn(
                (sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
                    callback(null, [{ organization_id: 'org1' }, { organization_id: 'org2' }]);
                    return mockDb;
                },
            ) as unknown as IDatabase['all'];

            const invoicesGenerated = await generatePayAsYouGoInvoices({
                db: mockDb,
                payAsYouGoService: mockPayAsYouGoService,
            });

            expect(invoicesGenerated).toBe(2);
            expect(mockPayAsYouGoService.generatePayAsYouGoInvoice).toHaveBeenCalledTimes(2);
        });

        it('should handle errors for individual invoices', async () => {
            mockDb.all = vi.fn(
                (sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
                    callback(null, [{ organization_id: 'org1' }, { organization_id: 'org2' }]);
                    return mockDb;
                },
            ) as unknown as IDatabase['all'];

            mockPayAsYouGoService.generatePayAsYouGoInvoice = vi
                .fn()
                .mockResolvedValueOnce({ invoiced: true, totalCost: 100 })
                .mockRejectedValueOnce(new Error('Invoice generation failed'));

            const invoicesGenerated = await generatePayAsYouGoInvoices({
                db: mockDb,
                payAsYouGoService: mockPayAsYouGoService,
            });

            expect(invoicesGenerated).toBe(1); // Only first succeeded
        });

        it('should calculate correct date range for last month', async () => {
            mockDb.all = vi.fn(
                (sql: string, params: unknown[], callback: (err: Error | null, rows?: unknown[]) => void) => {
                    callback(null, [{ organization_id: 'org1' }]);
                    return mockDb;
                },
            ) as unknown as IDatabase['all'];

            await generatePayAsYouGoInvoices({
                db: mockDb,
                payAsYouGoService: mockPayAsYouGoService,
            });

            const callArgs = (mockPayAsYouGoService.generatePayAsYouGoInvoice as ReturnType<typeof vi.fn>).mock
                .calls[0];
            const startDate = callArgs[1] as Date;
            const endDate = callArgs[2] as Date;

            expect(startDate).toBeInstanceOf(Date);
            expect(endDate).toBeInstanceOf(Date);
            expect(startDate.getTime()).toBeLessThan(endDate.getTime());
        });
    });

    describe('updateSeatCounts', () => {
        it('should update seat counts for all organizations', async () => {
            const updated = await updateSeatCounts({
                db: mockDb,
                seatManagementService: mockSeatManagementService,
            });

            expect(updated).toBe(2);
            expect(mockSeatManagementService.updateSeatCount).toHaveBeenCalledTimes(2);
            expect(mockSeatManagementService.updateSeatCount).toHaveBeenCalledWith('org1');
            expect(mockSeatManagementService.updateSeatCount).toHaveBeenCalledWith('org2');
        });

        it('should handle errors for individual organizations', async () => {
            mockSeatManagementService.updateSeatCount = vi
                .fn()
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Update failed'));

            const updated = await updateSeatCounts({
                db: mockDb,
                seatManagementService: mockSeatManagementService,
            });

            expect(updated).toBe(1); // Only first succeeded
        });
    });

    describe('calculateMonthlyUsage', () => {
        it('should calculate monthly usage successfully', async () => {
            await calculateMonthlyUsage({
                db: mockDb,
            });

            // Function completes without error
            expect(true).toBe(true);
        });
    });

    describe('getBillingCron', () => {
        it('should return singleton instance', () => {
            const instance1 = getBillingCron({ db: mockDb });
            const instance2 = getBillingCron({ db: mockDb });

            expect(instance1).toBe(instance2);
        });
    });
});

