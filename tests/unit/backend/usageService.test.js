import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for UsageService
 * Uses real database - tests actual service behavior
 */
describe('UsageService - Integration', () => {
    let UsageService;

    beforeAll(async () => {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);

        // Ensure DB is initialized
        const db = require('../../../server/database.js');
        await db.initPromise;

        // Clear any mock flags
        delete process.env.MOCK_DB;

        // Import the real service (no mocks)
        const mod = await import('../../../server/services/usageService.js');
        UsageService = mod.default;
    });

    describe('Record Usage', () => {
        it('should record token usage without throwing', async () => {
            const testUserId = 'test-user-' + Date.now();
            const testOrgId = 'test-org-' + Date.now();

            // Should not throw
            await expect(
                UsageService.recordTokenUsage(testUserId, testOrgId, 100, 50, 'chat', 'test model')
            ).resolves.not.toThrow();
        });

        it('should record storage usage without throwing', async () => {
            const testUserId = 'test-user-' + Date.now();
            const testOrgId = 'test-org-' + Date.now();

            await expect(
                UsageService.recordStorageUsage(testUserId, testOrgId, 1024)
            ).resolves.not.toThrow();
        });
    });

    describe('Get Usage', () => {
        it('should get current usage without throwing', async () => {
            const testOrgId = 'test-org-' + Date.now();

            const usage = await UsageService.getCurrentUsage(testOrgId);
            // Should return an object (may be empty for new org)
            expect(usage).toBeDefined();
        });
    });

    describe('Check Quota', () => {
        it('should check quota without throwing', async () => {
            const testOrgId = 'test-org-' + Date.now();

            const result = await UsageService.checkQuota(testOrgId);
            // Should return an object with allowed property
            expect(result).toBeDefined();
            expect(typeof result.allowed === 'boolean' || result.allowed === undefined).toBe(true);
        });
    });
});
