import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for TokenBillingService
 * Uses real database - production-ready tests
 */
describe('TokenBillingService - Integration', () => {
    let TokenBillingService;

    beforeAll(async () => {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);

        // Ensure DB is initialized
        const db = require('../../../server/database.js');
        await db.initPromise;

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

    describe('Margin Updates', () => {
        it('should update margin and persist changes', async () => {
            const update = { baseCostPer1k: 0.05, marginPercent: 35, minCharge: 0.02, isActive: 1 };
            await TokenBillingService.updateMargin('platform', update);

            const margin = await TokenBillingService.getMargin('platform');
            expect(margin.base_cost_per_1k).toBe(0.05);
            expect(margin.margin_percent).toBe(35);
        });
    });

    describe('Token Deduction / Usage', () => {
        it('should deduct tokens correctly for platform usage', async () => {
            const userId = 'user-deduct-' + Date.now();
            await TokenBillingService.creditTokens(userId, 5000, 0, {}); // Credit 5000

            // Deduct 1000
            const result = await TokenBillingService.deductTokens(userId, 1000, 'platform', { llmProvider: 'openai', modelUsed: 'gpt-4' });
            expect(result.tokens).toBe(1000);

            const balance = await TokenBillingService.getBalance(userId);
            expect(balance.platform_tokens).toBe(4000);
            expect(balance.lifetime_used).toBe(1000);
        });

        it('should handle markup multipliers', async () => {
            const userId = 'user-markup-' + Date.now();
            await TokenBillingService.creditTokens(userId, 5000, 0, {});

            // Deduct 1000 with 1.5 multiplier
            const result = await TokenBillingService.deductTokens(userId, 1000, 'platform', { multiplier: 1.5 });
            expect(result.tokens).toBe(1500); // 1000 * 1.5

            const balance = await TokenBillingService.getBalance(userId);
            expect(balance.platform_tokens).toBe(3500);
        });
    });

    describe('User API Keys (BYOK)', () => {
        it('should add, get and delete user API keys', async () => {
            const userId = 'user-byok-' + Date.now();
            const keyData = {
                provider: 'openai',
                apiKey: 'sk-test-key-123',
                displayName: 'My OpenAI',
                organizationId: 'org-1'
            };

            // Add
            const added = await TokenBillingService.addUserApiKey(userId, keyData);
            expect(added.id).toBeDefined();

            // Get
            const keys = await TokenBillingService.getUserApiKeys(userId);
            expect(keys).toHaveLength(1);
            expect(keys[0].provider).toBe('openai');
            // Check decryption
            const activeKey = await TokenBillingService.getActiveByokKey(userId, 'openai');
            expect(activeKey.api_key).toBe('sk-test-key-123');

            // Delete
            await TokenBillingService.deleteUserApiKey(added.id, userId);
            const keysAfter = await TokenBillingService.getUserApiKeys(userId);
            expect(keysAfter).toHaveLength(0);
        });
    });

    describe('Source Determination', () => {
        it('should prefer BYOK if available and requested', async () => {
            const userId = 'user-src-' + Date.now();
            await TokenBillingService.addUserApiKey(userId, { provider: 'openai', apiKey: 'k', organizationId: 'o' });

            const source = await TokenBillingService.determineTokenSource(userId, 'openai');
            expect(source.sourceType).toBe('byok');
            expect(source.config).toBeDefined();
        });

        it('should fallback to platform if no BYOK key', async () => {
            const userId = 'user-src-platform-' + Date.now();
            await TokenBillingService.ensureBalance(userId); // Ensure 0 balance

            const source = await TokenBillingService.determineTokenSource(userId, 'openai');
            expect(source.sourceType).toBe('platform');
        });
    });

    describe('Analytics', () => {
        it('should retrieve revenue analytics', async () => {
            // We need some transactions first, deduction tests created some
            const analytics = await TokenBillingService.getRevenueAnalytics();
            expect(Array.isArray(analytics)).toBe(true);
        });

        it('should retrieve transactions for user', async () => {
            const userId = 'user-tx-' + Date.now();
            await TokenBillingService.creditTokens(userId, 100);

            const txs = await TokenBillingService.getTransactions(userId);
            expect(txs.length).toBeGreaterThan(0);
        });
    });

});
