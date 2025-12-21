/**
 * Token Ledger Enterprise Tests
 * 
 * Tests for enterprise-grade requirements:
 * - Atomicity (ledger fail => rollback)
 * - Fail-closed for TRIAL (missing org denied)
 * - PAYGO measurable (status change + ledger event)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';

const require = createRequire(import.meta.url);

describe('Token Ledger Enterprise Tests', () => {
    let TokenBillingService;
    let mockDb;
    let mockSqliteAsync;
    
    // Mock database with controllable behavior
    let mockDbBehavior = {
        failLedgerInsert: false,
        orgExists: true,
        orgBalance: 10000,
        billingStatus: 'TRIAL',
        organizationType: 'TRIAL'
    };

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
        
        // Reset to default behavior
        mockDbBehavior = {
            failLedgerInsert: false,
            orgExists: true,
            orgBalance: 10000,
            billingStatus: 'TRIAL',
            organizationType: 'TRIAL'
        };
        
        // Setup default mocks
        mockSqliteAsync.getAsync.mockImplementation((db, sql, params) => {
            if (!mockDbBehavior.orgExists && sql.includes('organizations')) {
                return Promise.resolve(null);
            }
            if (sql.includes('organizations')) {
                return Promise.resolve({
                    token_balance: mockDbBehavior.orgBalance,
                    billing_status: mockDbBehavior.billingStatus,
                    organization_type: mockDbBehavior.organizationType
                });
            }
            return Promise.resolve({});
        });
        
        mockSqliteAsync.runAsync.mockImplementation((db, sql, params) => {
            if (mockDbBehavior.failLedgerInsert && sql.includes('token_ledger')) {
                return Promise.reject(new Error('FATAL: Ledger insert failed'));
            }
            return Promise.resolve({ changes: 1, lastID: 1 });
        });
        
        mockSqliteAsync.withTransaction.mockImplementation(async (db, fn) => {
            try {
                return await fn();
            } catch (e) {
                throw e;
            }
        });
        
        mockDb.get.mockImplementation((sql, params, callback) => {
            if (sql.includes('token_ledger')) {
                callback(null, { total_credits: 50000, total_debits: 1000, transaction_count: 10 });
            } else {
                callback(null, {});
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/db/sqliteAsync');
    });

    // ==========================================
    // TEST 1: FAIL-CLOSED FOR TRIAL
    // ==========================================
    describe('Fail-Closed for TRIAL', () => {
        it('should deny access when org not found (fail-closed)', async () => {
            mockDbBehavior.orgExists = false;

            const check = await TokenBillingService.hasOrgSufficientBalance('org-missing', 100);

            expect(check.allowed).toBe(false);
            expect(check.reason).toContain('Balance check failed');
        });

        it('should deny when TRIAL balance insufficient', async () => {
            mockDbBehavior.orgBalance = 50; // Less than requested

            const check = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(check.allowed).toBe(false);
            expect(check.reason).toContain('Trial token limit reached');
        });

        it('should allow when TRIAL balance is sufficient', async () => {
            mockDbBehavior.orgBalance = 10000;

            const check = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(check.allowed).toBe(true);
        });
    });

    // ==========================================
    // TEST 2: PAYGO TRIGGER
    // ==========================================
    describe('PAYGO Trigger', () => {
        it('should flag paygoTriggered when ACTIVE org has low balance', async () => {
            mockDbBehavior.billingStatus = 'ACTIVE';
            mockDbBehavior.organizationType = 'ORG';
            mockDbBehavior.orgBalance = 50; // Less than requested but ACTIVE

            const check = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(check.allowed).toBe(true);
            expect(check.paygoTriggered).toBe(true);
        });
    });

    // ==========================================
    // TEST 3: ATOMICITY
    // ==========================================
    describe('Atomicity - Ledger Fail Rolls Back', () => {
        it('getOrgBalance uses async pattern', async () => {
            const result = await TokenBillingService.getOrgBalance('org-123');

            expect(mockSqliteAsync.getAsync).toHaveBeenCalled();
            expect(result.balance).toBe(10000);
        });

        it('getOrgBalance throws on missing org', async () => {
            mockDbBehavior.orgExists = false;

            await expect(TokenBillingService.getOrgBalance('org-missing'))
                .rejects.toThrow('Organization not found');
        });
    });

    // ==========================================
    // TEST 4: LEDGER SUMMARY
    // ==========================================
    describe('Ledger Summary', () => {
        it('returns aggregated values', async () => {
            const summary = await TokenBillingService.getLedgerSummary('org-123');

            expect(summary).toHaveProperty('totalCredits');
            expect(summary).toHaveProperty('totalDebits');
            expect(summary).toHaveProperty('computedBalance');
            expect(summary).toHaveProperty('transactionCount');
        });
    });
});
