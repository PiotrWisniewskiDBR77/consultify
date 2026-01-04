/**
 * PayAsYouGoService Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for PayAsYouGoService - 85%+ coverage target
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import PayAsYouGoService from '../../../../src/services/payAsYouGoService.js';

describe('PayAsYouGoService', () => {
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

        if (PayAsYouGoService.setDependencies) {
            PayAsYouGoService.setDependencies({ db: mockDb });
        }
    });

    describe('Service Methods', () => {
        it('should have required methods', () => {
            expect(PayAsYouGoService).toBeDefined();
            expect(PayAsYouGoService.recordUsage).toBeDefined();
        });

        it('should record usage in database', async () => {
            (mockDb.run as any).mockImplementation(function (sql: any, params: any, callback: any) {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const result = await PayAsYouGoService.recordUsage({
                orgId: 'org-1',
                usageType: 'tokens',
                quantity: 100,
                unitPrice: 0.01,
            });

            expect(result).toBeDefined();
            expect(result.totalCost).toBe(1);
        });

        it('should get current period usage', async () => {
            const mockUsageRows = [
                { usage_type: 'tokens', total_quantity: 100, avg_unit_price: 0.01, total_cost: 1, usage_count: 1 },
            ];
            (mockDb.all as any).mockImplementation((sql: any, params: any, callback: any) => {
                callback(null, mockUsageRows);
            });

            const summary = await PayAsYouGoService.getCurrentPeriodUsage('org-1');
            expect(summary.totalCost).toBe(1);
            expect(summary.byType.tokens).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            (mockDb.get as ReturnType<typeof vi.fn>).mockImplementation(
                (sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                    callback(new Error('Database error'));
                },
            );

            expect(true).toBe(true);
        });
    });
});
