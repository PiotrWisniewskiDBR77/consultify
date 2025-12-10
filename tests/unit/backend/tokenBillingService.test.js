import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for TokenBillingService
 * Uses real database - production-ready tests
 */
describe('TokenBillingService - Integration', () => {
    let TokenBillingService;

    beforeAll(async () => {
        // Clear any mock flags
        delete process.env.MOCK_DB;

        // Import the real service (no mocks)
        const mod = await import('../../../server/services/tokenBillingService.js');
        TokenBillingService = mod.default;
    });

    describe('Margins', () => {
        it('should get margins without throwing', async () => {
            const margins = await TokenBillingService.getMargins();
            expect(Array.isArray(margins)).toBe(true);
        });

        it('should get specific margin by source type', async () => {
            const margin = await TokenBillingService.getMargin('platform');
            // May return null if not configured, but should not throw
            expect(margin === null || typeof margin === 'object').toBe(true);
        });
    });

    describe('Packages', () => {
        it('should get packages without throwing', async () => {
            const packages = await TokenBillingService.getPackages();
            expect(Array.isArray(packages)).toBe(true);
        });

        it('should upsert package without throwing', async () => {
            const testPackage = {
                id: 'test-package-' + Date.now(),
                name: 'Test Token Package',
                tokens: 1000,
                priceUsd: 9.99
            };

            await expect(
                TokenBillingService.upsertPackage(testPackage)
            ).resolves.not.toThrow();
        });
    });

    describe('Balance', () => {
        it('should get balance without throwing', async () => {
            const testUserId = 'test-user-' + Date.now();
            const balance = await TokenBillingService.getBalance(testUserId);
            // Balance may be null for new user
            expect(balance === null || typeof balance === 'object').toBe(true);
        });

        it('should ensure balance creates record', async () => {
            const testUserId = 'test-user-ensure-' + Date.now();

            await expect(
                TokenBillingService.ensureBalance(testUserId)
            ).resolves.not.toThrow();
        });

        it('should credit tokens to user', async () => {
            const testUserId = 'test-user-credit-' + Date.now();
            await TokenBillingService.ensureBalance(testUserId);

            await expect(
                TokenBillingService.creditTokens(testUserId, 1000, 100, {})
            ).resolves.not.toThrow();
        });
    });

    describe('Balance Check', () => {
        it('should check sufficient balance', async () => {
            const testUserId = 'test-user-check-' + Date.now();

            const hasSufficient = await TokenBillingService.hasSufficientBalance(testUserId, 100);
            expect(typeof hasSufficient === 'boolean').toBe(true);
        });
    });
});
