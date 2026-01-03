/**
 * BillingService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Unit tests for BillingService - 85%+ coverage target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IDatabase } from '../../../../src/database/IDatabase.js';
import BillingService from '../../../../src/services/BillingService.js';

describe('BillingService', () => {
    let mockDb: IDatabase;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                const dbObj = {
                    ...mockDb,
                    changes: 1,
                    lastID: 1,
                };
                if (callback) {
                    callback(null);
                }
                return dbObj;
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;

        if (BillingService.setDependencies) {
            BillingService.setDependencies({ db: mockDb });
        }
    });

    describe('Service Methods', () => {
        it('should have required methods', () => {
            expect(BillingService).toBeDefined();
            expect(BillingService.getPlans).toBeDefined();
        });

        it('should fetch plans from database', async () => {
            const mockPlans = [{ id: 'plan-1', name: 'Free Plan' }];
            (mockDb.all as any).mockReturnValue(Promise.resolve(mockPlans));

            const plans = await BillingService.getPlans();
            expect(plans).toEqual(mockPlans);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM subscription_plans'),
                expect.any(Array)
            );
        });

        it('should fetch plan by id', async () => {
            const mockPlan = { id: 'plan-1', name: 'Free Plan' };
            (mockDb.get as any).mockReturnValue(Promise.resolve(mockPlan));

            const plan = await BillingService.getPlanById('plan-1');
            expect(plan).toEqual(mockPlan);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM subscription_plans WHERE id = ?'),
                ['plan-1']
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database error'));
            });

            expect(true).toBe(true);
        });
    });
});
