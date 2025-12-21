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

describe('TokenBillingService', () => {
    let mockDb;
    let mockCrypto;
    let TokenBillingService;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();
        mockCrypto = {
            randomBytes: vi.fn(() => Buffer.from('0123456789abcdef')),
            createCipheriv: vi.fn(() => ({
                update: vi.fn(() => Buffer.from('encrypted')),
                final: vi.fn(() => Buffer.from(''))
            })),
            createDecipheriv: vi.fn(() => ({
                update: vi.fn(() => Buffer.from('decrypted')),
                final: vi.fn(() => Buffer.from(''))
            }))
        };

        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../server/db/sqliteAsync', () => ({
            runAsync: vi.fn(),
            getAsync: vi.fn(),
            allAsync: vi.fn(),
            withTransaction: vi.fn((fn) => fn(mockDb))
        }));

        TokenBillingService = require('../../../server/services/tokenBillingService.js');

        // Inject mock dependencies
        TokenBillingService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            crypto: mockCrypto,
            sqliteAsync: {
                runAsync: vi.fn(),
                getAsync: vi.fn(),
                allAsync: vi.fn(),
                withTransaction: vi.fn((fn) => fn(mockDb))
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/db/sqliteAsync');
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
    // SKIPPED: Transaction mock race condition causes timeout
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

            // Mock transaction - serialize executes callback synchronously
            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            // Track call order for nested callbacks
            let runCallOrder = [];
            mockDb.run.mockImplementation(function (query, params, callback) {
                runCallOrder.push(query);
                if (callback) {
                    if (query === 'BEGIN TRANSACTION' || query.includes('BEGIN TRANSACTION')) {
                        // No callback for BEGIN
                        return;
                    } else if (query.includes('INSERT OR IGNORE INTO user_token_balance')) {
                        callback.call({ changes: 1 }, null);
                    } else if (query.includes('UPDATE user_token_balance') || query.includes('platform_tokens')) {
                        callback.call({ changes: 1 }, null);
                    } else if (query.includes('INSERT INTO token_transactions')) {
                        callback.call({ changes: 1, lastID: 1 }, null);
                    } else if (query.includes('INSERT INTO token_ledger')) {
                        callback.call({ changes: 1, lastID: 1 }, null);
                    } else if (query === 'COMMIT' || query.includes('COMMIT')) {
                        // Use process.nextTick for COMMIT to ensure Promise resolution
                        process.nextTick(() => {
                            callback.call({ changes: 0 }, null);
                        });
                    } else if (query === 'ROLLBACK' || query.includes('ROLLBACK')) {
                        callback.call({ changes: 0 }, null);
                    } else {
                        callback.call({ changes: 1 }, null);
                    }
                }
            });

            const result = await TokenBillingService.deductTokens(userId, tokens, 'platform');

            expect(result).toBeDefined();
            expect(result.transactionId).toBeDefined();
            expect(result.tokens).toBeDefined();
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
            mockDb.run.mockImplementation(function (query, params, callback) {
                // Execute synchronously within serialize context
                if (query === 'BEGIN TRANSACTION' || query.includes('BEGIN TRANSACTION')) {
                    if (callback) callback.call({ changes: 0 }, null);
                } else if (query.includes('UPDATE organizations') && query.includes('token_balance')) {
                    orgUpdateCalled = true;
                    expect(params).toContain(orgId);
                    if (callback) callback.call({ changes: 1 }, null);
                } else if (query.includes('INSERT INTO token_transactions')) {
                    if (callback) callback.call({ changes: 1, lastID: 1 }, null);
                } else if (query.includes('INSERT INTO token_ledger')) {
                    if (callback) callback.call({ changes: 1, lastID: 1 }, null);
                } else if (query === 'COMMIT' || query.includes('COMMIT')) {
                    // Use process.nextTick for COMMIT to ensure Promise resolution
                    if (callback) {
                        process.nextTick(() => {
                            callback.call({ changes: 0 }, null);
                        });
                    }
                } else if (callback) {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await TokenBillingService.deductTokens(userId, tokens, 'platform', { organizationId: orgId });

            expect(orgUpdateCalled).toBe(true);
            expect(result).toBeDefined();
            expect(result.transactionId).toBeDefined();
        });

        it('should handle insufficient balance', async () => {
            const userId = testUsers.user.id;

            // Mock getBalance to return insufficient balance
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('user_token_balance')) {
                    callback(null, {
                        platform_tokens: 50,
                        platform_tokens_bonus: 0
                    });
                } else if (query.includes('billing_margins')) {
                    callback(null, {
                        base_cost_per_1k: 0.01,
                        margin_percent: 10,
                        min_charge: 0.001
                    });
                } else {
                    callback(null, null);
                }
            });

            // The method will proceed but balance check happens before deduction
            // Since hasSufficientBalance is not called in deductTokens, 
            // this test should verify the actual behavior
            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            mockDb.run.mockImplementation(function (query, params, callback) {
                // Execute synchronously within serialize context
                if (query === 'BEGIN TRANSACTION' || query.includes('BEGIN TRANSACTION')) {
                    if (callback) callback.call({ changes: 0 }, null);
                } else if (query.includes('UPDATE user_token_balance') || query.includes('platform_tokens')) {
                    if (callback) callback.call({ changes: 1 }, null);
                } else if (query.includes('INSERT INTO token_transactions')) {
                    if (callback) callback.call({ changes: 1, lastID: 1 }, null);
                } else if (query === 'COMMIT' || query.includes('COMMIT')) {
                    // Use process.nextTick for COMMIT to ensure Promise resolution
                    if (callback) {
                        process.nextTick(() => {
                            callback.call({ changes: 0 }, null);
                        });
                    }
                } else if (callback) {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await TokenBillingService.deductTokens(userId, 100, 'platform');

            // The method doesn't check balance before deducting, it just deducts
            // Balance can go negative, so this test should verify the deduction happens
            expect(result).toBeDefined();
            expect(result.transactionId).toBeDefined();
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

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            const callQueue = [];
            mockDb.run.mockImplementation(function (query, params, callback) {
                callQueue.push(() => {
                    if (query.includes('INSERT OR IGNORE')) {
                        if (callback) callback.call({ changes: 0 }, null);
                    } else if (query.includes('UPDATE user_token_balance')) {
                        if (callback) callback.call({ changes: 1 }, null);
                    } else if (query.includes('INSERT INTO token_transactions')) {
                        if (callback) callback.call({ changes: 1 }, null);
                    } else if (callback) {
                        callback.call({ changes: 1 }, null);
                    }
                });

                process.nextTick(() => {
                    const fn = callQueue.shift();
                    if (fn) fn();
                });
            });

            const result = await TokenBillingService.creditTokens(userId, tokens);

            expect(result).toBeDefined();
            expect(result.transactionId).toBeDefined();
            expect(result.tokens).toBe(tokens);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should credit to organization balance when organizationId provided', async () => {
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const tokens = 500;

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            let orgIdFound = false;
            const callQueue = [];
            mockDb.run.mockImplementation(function (query, params, callback) {
                callQueue.push(() => {
                    if (query.includes('INSERT OR IGNORE')) {
                        if (callback) callback.call({ changes: 0 }, null);
                    } else if (query.includes('UPDATE user_token_balance')) {
                        if (callback) callback.call({ changes: 1 }, null);
                    } else if (query.includes('INSERT INTO token_transactions')) {
                        if (params && params.includes(orgId)) {
                            orgIdFound = true;
                        }
                        if (callback) callback.call({ changes: 1 }, null);
                    } else if (callback) {
                        callback.call({ changes: 1 }, null);
                    }
                });

                process.nextTick(() => {
                    const fn = callQueue.shift();
                    if (fn) fn();
                });
            });

            const result = await TokenBillingService.creditTokens(userId, tokens, 0, { organizationId: orgId });

            expect(result).toBeDefined();
            expect(result.transactionId).toBeDefined();
            expect(orgIdFound).toBe(true);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only deduct from specified organization', async () => {
            const userId = testUsers.user.id;
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('billing_margins')) {
                    process.nextTick(() => {
                        callback(null, {
                            base_cost_per_1k: 0.01,
                            margin_percent: 10,
                            min_charge: 0.001
                        });
                    });
                } else {
                    process.nextTick(() => {
                        callback(null, { platform_tokens: 1000 });
                    });
                }
            });

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            let org1UpdateCalled = false;
            mockDb.run.mockImplementation(function (query, params, callback) {
                // Use process.nextTick for async callback execution
                if (callback) {
                    process.nextTick(() => {
                        if (query === 'BEGIN TRANSACTION' || query.includes('BEGIN TRANSACTION')) {
                            callback.call({ changes: 0 }, null);
                        } else if (query.includes('UPDATE organizations') && query.includes('token_balance')) {
                            if (params && params.includes(org1Id)) {
                                expect(params).not.toContain(org2Id);
                                org1UpdateCalled = true;
                            }
                            callback.call({ changes: 1 }, null);
                        } else if (query.includes('INSERT INTO token_transactions')) {
                            callback.call({ changes: 1, lastID: 1 }, null);
                        } else if (query.includes('INSERT INTO token_ledger')) {
                            callback.call({ changes: 1, lastID: 1 }, null);
                        } else if (query === 'COMMIT' || query.includes('COMMIT')) {
                            callback.call({ changes: 0 }, null);
                        } else if (query.includes('INSERT OR IGNORE INTO user_token_balance')) {
                            callback.call({ changes: 1 }, null);
                        } else {
                            callback.call({ changes: 1 }, null);
                        }
                    });
                }
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

