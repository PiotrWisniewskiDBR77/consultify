import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('uuid', () => ({
    v4: () => 'uuid-1234'
}));


const mockBillingService = {
    getOrganizationBilling: vi.fn()
};

vi.mock('../../../server/services/billingService', () => ({
    default: mockBillingService
}));

import UsageService from '../../../server/services/usageService.js';

describe('UsageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default DB mocks
        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb(null, null);
        });

        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') cb.call({ changes: 1 }, null);
        });

        mockBillingService.getOrganizationBilling.mockResolvedValue({
            plan_id: 'pro-plan',
            token_limit: 100000,
            storage_limit: 1000,
            allow_overage: 1
        });
    });

    describe('recordTokenUsage', () => {
        it('should record usage successfully', async () => {
            const result = await UsageService.recordTokenUsage(
                'org-1', 'user-1', 100, 'TEST_ACTION', { meta: 'data' }
            );

            expect(result.id).toBe('uuid-1234');
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO usage_logs'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getCurrentUsage', () => {
        it('should aggregate usage logs', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    // Mock SUM result
                    cb(null, { total_tokens: 5000, total_storage: 200 });
                }
            });

            const usage = await UsageService.getCurrentUsage('org-1');

            expect(usage.totalTokens).toBe(5000);
            expect(usage.storageUsed).toBe(200);
        });
    });

    describe('checkQuota', () => {
        it('should allow if within limit', async () => {
            // Usage 5000, Limit 100000 (from mockBillingService default)
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { total_tokens: 5000 });
                }
            });

            const result = await UsageService.checkQuota('org-1', 'token');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(95000);
        });

        it('should allow overage if enabled', async () => {
            // Usage 150000, Limit 100000, allow_overage = 1
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { total_tokens: 150000 });
                }
            });

            const result = await UsageService.checkQuota('org-1', 'token');
            expect(result.allowed).toBe(true); // Overage allowed
            expect(result.overageEnabled).toBe(true);
        });

        it('should block if over limit and no overage', async () => {
            mockBillingService.getOrganizationBilling.mockResolvedValue({
                token_limit: 1000,
                allow_overage: 0
            });

            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { total_tokens: 1500 }); // 1500 > 1000
                }
            });

            const result = await UsageService.checkQuota('org-1', 'token');
            expect(result.allowed).toBe(false);
        });
    });

    describe('recordProjectStorageUsage', () => {
        it('should record project usage', async () => {
            const result = await UsageService.recordProjectStorageUsage('proj-1', 500, 'UPLOAD');
            expect(result.id).toBe('uuid-1234');
        });
    });
});
