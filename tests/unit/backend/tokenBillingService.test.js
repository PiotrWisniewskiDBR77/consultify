/**
 * Token Billing Service Tests
 * 
 * CRITICAL BILLING SERVICE - Must have 95%+ coverage
 * Tests token balance management, deductions, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const TokenBillingService = require('../../../server/services/tokenBillingService.js');

describe('TokenBillingService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getBalance()', () => {
        it('should return user token balance', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    platform_tokens: 1000,
                    platform_tokens_bonus: 100,
                    byok_tokens: 5000,
                    local_tokens: 0
                });
            });

            const balance = await TokenBillingService.getBalance(userId);

            expect(balance).toBeDefined();
            expect(balance.platform_tokens).toBe(1000);
            expect(balance.platform_tokens_bonus).toBe(100);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [userId],
                expect.any(Function)
            );
        });

        it('should return zero balance for new user', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const balance = await TokenBillingService.getBalance(userId);

            expect(balance.platform_tokens).toBe(0);
            expect(balance.platform_tokens_bonus).toBe(0);
        });

        it('should handle database errors', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(
                TokenBillingService.getBalance(userId)
            ).rejects.toThrow('DB Error');
        });
    });

    describe('hasSufficientBalance()', () => {
        it('should return true when balance is sufficient', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    platform_tokens: 1000,
                    platform_tokens_bonus: 100
                });
            });

            const result = await TokenBillingService.hasSufficientBalance(userId, 500, 'platform');

            expect(result).toBe(true);
        });

        it('should return false when balance is insufficient', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    platform_tokens: 100,
                    platform_tokens_bonus: 0
                });
            });

            const result = await TokenBillingService.hasSufficientBalance(userId, 500, 'platform');

            expect(result).toBe(false);
        });

        it('should include bonus tokens in balance check', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    platform_tokens: 400,
                    platform_tokens_bonus: 200
                });
            });

            const result = await TokenBillingService.hasSufficientBalance(userId, 500, 'platform');

            expect(result).toBe(true); // 400 + 200 = 600 >= 500
        });
    });

    describe('deductTokens()', () => {
        it('should deduct tokens from user balance', async () => {
            const userId = testUsers.user.id;
            const tokens = 100;
            
            // Mock margin lookup
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('billing_margins')) {
                    callback(null, {
                        base_cost_per_1k: 0.01,
                        margin_percent: 10,
                        min_charge: 0.001
                    });
                } else {
                    callback(null, null);
                }
            });

            // Mock transaction
            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('BEGIN TRANSACTION')) {
                    callback.call({ changes: 0 }, null);
                } else if (query.includes('UPDATE users SET token_balance')) {
                    callback.call({ changes: 1 }, null);
                } else if (query.includes('COMMIT')) {
                    callback.call({ changes: 0 }, null);
                } else {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await TokenBillingService.deductTokens(userId, tokens, 'platform');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should deduct from organization balance when organizationId provided', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const tokens = 100;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('billing_margins')) {
                    callback(null, {
                        base_cost_per_1k: 0.01,
                        margin_percent: 10,
                        min_charge: 0.001
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            let orgUpdateCalled = false;
            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('UPDATE organizations SET token_balance')) {
                    orgUpdateCalled = true;
                    expect(params).toContain(orgId);
                }
                callback.call({ changes: 1 }, null);
            });

            await TokenBillingService.deductTokens(userId, tokens, 'platform', { organizationId: orgId });

            expect(orgUpdateCalled).toBe(true);
        });

        it('should handle insufficient balance', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('SELECT') && !query.includes('billing_margins')) {
                    callback(null, {
                        platform_tokens: 50,
                        platform_tokens_bonus: 0
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await TokenBillingService.deductTokens(userId, 100, 'platform');

            expect(result.success).toBe(false);
            expect(result.error).toContain('insufficient');
        });

        it('should handle database errors', async () => {
            const userId = testUsers.user.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(
                TokenBillingService.deductTokens(userId, 100, 'platform')
            ).rejects.toThrow('DB Error');
        });
    });

    describe('creditTokens()', () => {
        it('should credit tokens to user balance', async () => {
            const userId = testUsers.user.id;
            const tokens = 500;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await TokenBillingService.creditTokens(userId, tokens, 'platform');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE users SET token_balance'),
                expect.arrayContaining([tokens, userId]),
                expect.any(Function)
            );
        });

        it('should credit to organization balance when organizationId provided', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const tokens = 500;
            
            let orgUpdateCalled = false;
            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('UPDATE organizations SET token_balance')) {
                    orgUpdateCalled = true;
                    expect(params).toContain(orgId);
                }
                callback.call({ changes: 1 }, null);
            });

            await TokenBillingService.creditTokens(userId, tokens, 'platform', { organizationId: orgId });

            expect(orgUpdateCalled).toBe(true);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only deduct from specified organization', async () => {
            const userId = testUsers.user.id;
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('billing_margins')) {
                    callback(null, {
                        base_cost_per_1k: 0.01,
                        margin_percent: 10,
                        min_charge: 0.001
                    });
                } else {
                    callback(null, { platform_tokens: 1000 });
                }
            });

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            let org1UpdateCalled = false;
            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('UPDATE organizations SET token_balance')) {
                    expect(params).toContain(org1Id);
                    expect(params).not.toContain(org2Id);
                    org1UpdateCalled = true;
                }
                callback.call({ changes: 1 }, null);
            });

            await TokenBillingService.deductTokens(userId, 100, 'platform', { organizationId: org1Id });

            expect(org1UpdateCalled).toBe(true);
        });
    });

    describe('getMargins()', () => {
        it('should return all billing margins', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    { source_type: 'platform', margin_percent: 10 },
                    { source_type: 'byok', margin_percent: 5 }
                ]);
            });

            const margins = await TokenBillingService.getMargins();

            expect(margins).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM billing_margins'),
                [],
                expect.any(Function)
            );
        });
    });

    describe('getMargin()', () => {
        it('should return margin for specific source type', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    source_type: 'platform',
                    margin_percent: 10,
                    base_cost_per_1k: 0.01
                });
            });

            const margin = await TokenBillingService.getMargin('platform');

            expect(margin.source_type).toBe('platform');
            expect(margin.margin_percent).toBe(10);
        });
    });
});
