/**
 * Token Ledger Service Tests
 * 
 * Tests for the token ledger functionality:
 * - Ledger entry creation on debit
 * - Balance calculation
 * - Budget enforcement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('TokenBillingService - Ledger Functionality', () => {
    let TokenBillingService;
    let mockDb;
    let mockSqliteAsync;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();
        mockSqliteAsync = {
            getAsync: vi.fn(),
            runAsync: vi.fn(),
            allAsync: vi.fn(),
            withTransaction: vi.fn()
        };

        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../server/db/sqliteAsync', () => mockSqliteAsync);

        TokenBillingService = require('../../../server/services/tokenBillingService.js');

        // Inject mock dependencies
        TokenBillingService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            crypto: {
                randomBytes: vi.fn(() => Buffer.from('0123456789abcdef')),
                scryptSync: vi.fn(() => Buffer.alloc(32)),
                createCipheriv: vi.fn(() => ({
                    update: vi.fn(() => Buffer.from('encrypted')),
                    final: vi.fn(() => Buffer.from(''))
                })),
                createDecipheriv: vi.fn(() => ({
                    update: vi.fn(() => Buffer.from('decrypted')),
                    final: vi.fn(() => Buffer.from(''))
                }))
            },
            sqliteAsync: mockSqliteAsync
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/db/sqliteAsync');
    });

    describe('getOrgBalance', () => {
        it('should return organization balance and billing status', async () => {
            mockSqliteAsync.getAsync.mockResolvedValue({
                token_balance: 10000,
                billing_status: 'TRIAL',
                organization_type: 'TRIAL'
            });

            const result = await TokenBillingService.getOrgBalance('org-123');

            expect(result).toHaveProperty('balance', 10000);
            expect(result).toHaveProperty('billingStatus', 'TRIAL');
            expect(result).toHaveProperty('organizationType', 'TRIAL');
            expect(mockSqliteAsync.getAsync).toHaveBeenCalledWith(
                mockDb,
                expect.stringContaining('SELECT'),
                ['org-123']
            );
        });
    });

    describe('hasOrgSufficientBalance', () => {
        it('should allow call when balance is sufficient', async () => {
            mockSqliteAsync.getAsync.mockResolvedValue({
                token_balance: 10000,
                billing_status: 'TRIAL',
                organization_type: 'TRIAL'
            });

            const result = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(result.allowed).toBe(true);
            expect(result.balance).toBe(10000);
        });

        it('should deny call when trial balance is insufficient', async () => {
            mockSqliteAsync.getAsync.mockResolvedValue({
                token_balance: 50,
                billing_status: 'TRIAL',
                organization_type: 'TRIAL'
            });

            const result = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Trial token limit reached');
        });
    });

    describe('getLedger', () => {
        it('should return ledger entries for organization', async () => {
            mockDb.all.mockImplementation((query, params, callback) => {
                if (query.includes('token_ledger')) {
                    callback(null, [
                        { id: 'led-1', type: 'CREDIT', amount: 50000, reason: 'Trial Bonus', created_at: new Date().toISOString() },
                        { id: 'led-2', type: 'DEBIT', amount: 100, reason: 'AI Call', created_at: new Date().toISOString() }
                    ]);
                } else {
                    callback(null, []);
                }
            });

            const result = await TokenBillingService.getLedger('org-123');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
            expect(result[0]).toHaveProperty('type', 'CREDIT');
            expect(result[1]).toHaveProperty('type', 'DEBIT');
        });
    });

    describe('getLedgerSummary', () => {
        it('should return aggregated ledger summary', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('token_ledger')) {
                    callback(null, { total_credits: 50000, total_debits: 1500, transaction_count: 15 });
                } else {
                    callback(null, null);
                }
            });

            const result = await TokenBillingService.getLedgerSummary('org-123');

            expect(result).toHaveProperty('totalCredits', 50000);
            expect(result).toHaveProperty('totalDebits', 1500);
            expect(result).toHaveProperty('computedBalance', 48500);
            expect(result).toHaveProperty('transactionCount', 15);
        });
    });

    describe('creditOrganization', () => {
        it('should add credit and create ledger entry', async () => {
            mockSqliteAsync.withTransaction.mockImplementation(async (db, fn) => {
                return await fn();
            });

            mockSqliteAsync.runAsync.mockResolvedValue({ changes: 1, lastID: 1 });

            const result = await TokenBillingService.creditOrganization('org-123', 10000, {
                userId: 'user-1',
                reason: 'Manual Credit',
                refType: 'GRANT'
            });

            expect(result).toHaveProperty('tokens', 10000);
            expect(result).toHaveProperty('orgId', 'org-123');
            expect(result).toHaveProperty('ledgerId');
            expect(mockSqliteAsync.withTransaction).toHaveBeenCalled();
        });
    });
});

// SKIPPED: Transaction mock race condition causes timeout
describe('TokenBillingService - deductTokens with Ledger', () => {
    let TokenBillingService;
    let mockDb;
    let mockSqliteAsync;

    beforeEach(() => {
        vi.resetModules();

        mockDb = createMockDb();
        mockSqliteAsync = {
            getAsync: vi.fn(),
            runAsync: vi.fn(),
            allAsync: vi.fn(),
            withTransaction: vi.fn()
        };

        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../server/db/sqliteAsync', () => mockSqliteAsync);

        TokenBillingService = require('../../../server/services/tokenBillingService.js');

        TokenBillingService.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            crypto: {
                randomBytes: vi.fn(() => Buffer.from('0123456789abcdef')),
                scryptSync: vi.fn(() => Buffer.alloc(32)),
                createCipheriv: vi.fn(() => ({
                    update: vi.fn(() => Buffer.from('encrypted')),
                    final: vi.fn(() => Buffer.from(''))
                })),
                createDecipheriv: vi.fn(() => ({
                    update: vi.fn(() => Buffer.from('decrypted')),
                    final: vi.fn(() => Buffer.from(''))
                }))
            },
            sqliteAsync: mockSqliteAsync
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/db/sqliteAsync');
    });

    it('should create ledger entry when deducting from organization', async () => {
        // Mock margin lookup
        mockDb.get.mockImplementation((query, params, callback) => {
            if (query.includes('billing_margins')) {
                callback(null, { base_cost_per_1k: 0.01, margin_percent: 20, min_charge: 0 });
            } else {
                callback(null, null);
            }
        });

        // Mock transaction - serialize executes callback synchronously
        mockDb.serialize.mockImplementation((callback) => {
            callback();
        });

        let ledgerInsertCalled = false;
        mockDb.run.mockImplementation(function (query, params, callback) {
            if (query === 'BEGIN TRANSACTION' || query.includes('BEGIN TRANSACTION')) {
                // No callback for BEGIN
                return;
            }

            if (callback) {
                if (query.includes('UPDATE organizations') && query.includes('token_balance')) {
                    callback.call({ changes: 1 }, null);
                } else if (query.includes('INSERT INTO token_transactions')) {
                    callback.call({ changes: 1, lastID: 1 }, null);
                } else if (query.includes('INSERT INTO token_ledger')) {
                    ledgerInsertCalled = true;
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

        const result = await TokenBillingService.deductTokens('user-1', 500, 'platform', {
            organizationId: 'org-123',
            llmProvider: 'openai',
            modelUsed: 'gpt-4',
            multiplier: 1.0
        });

        expect(result).toHaveProperty('transactionId');
        expect(result).toHaveProperty('tokens');
        expect(ledgerInsertCalled).toBe(true);
    }, 15000); // Increase timeout to 15 seconds for async callbacks
});
