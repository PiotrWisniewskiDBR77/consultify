/**
 * Token Ledger Service Tests
 * 
 * Tests for the token ledger functionality:
 * - Ledger entry creation on debit
 * - Balance calculation
 * - Budget enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../../../server/database', () => ({
    default: {
        serialize: vi.fn((callback) => callback()),
        run: vi.fn((sql, params, callback) => {
            if (callback) callback.call({ changes: 1 });
        }),
        get: vi.fn((sql, params, callback) => {
            if (sql.includes('organizations')) {
                callback(null, { token_balance: 10000, billing_status: 'TRIAL', organization_type: 'TRIAL' });
            } else if (sql.includes('billing_margins')) {
                callback(null, { base_cost_per_1k: 0.01, margin_percent: 20, min_charge: 0 });
            } else {
                callback(null, {});
            }
        }),
        all: vi.fn((sql, params, callback) => {
            if (sql.includes('token_ledger')) {
                callback(null, [
                    { id: 'led-1', type: 'CREDIT', amount: 50000, reason: 'Trial Bonus', created_at: new Date().toISOString() },
                    { id: 'led-2', type: 'DEBIT', amount: 100, reason: 'AI Call', created_at: new Date().toISOString() }
                ]);
            } else {
                callback(null, []);
            }
        })
    }
}));

// Now import the service after mocking
const TokenBillingService = require('../../../server/services/tokenBillingService');

describe('TokenBillingService - Ledger Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getOrgBalance', () => {
        it('should return organization balance and billing status', async () => {
            const result = await TokenBillingService.getOrgBalance('org-123');

            expect(result).toHaveProperty('balance', 10000);
            expect(result).toHaveProperty('billingStatus', 'TRIAL');
            expect(result).toHaveProperty('organizationType', 'TRIAL');
        });
    });

    describe('hasOrgSufficientBalance', () => {
        it('should allow call when balance is sufficient', async () => {
            const result = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(result.allowed).toBe(true);
            expect(result.balance).toBe(10000);
        });

        it('should deny call when trial balance is insufficient', async () => {
            // Override mock for this test
            const db = require('../../server/database').default;
            db.get.mockImplementationOnce((sql, params, callback) => {
                callback(null, { token_balance: 50, billing_status: 'TRIAL', organization_type: 'TRIAL' });
            });

            const result = await TokenBillingService.hasOrgSufficientBalance('org-123', 100);

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Trial token limit reached');
        });
    });

    describe('getLedger', () => {
        it('should return ledger entries for organization', async () => {
            const result = await TokenBillingService.getLedger('org-123');

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
            expect(result[0]).toHaveProperty('type', 'CREDIT');
            expect(result[1]).toHaveProperty('type', 'DEBIT');
        });
    });

    describe('getLedgerSummary', () => {
        it('should return aggregated ledger summary', async () => {
            const db = require('../../server/database').default;
            db.get.mockImplementationOnce((sql, params, callback) => {
                callback(null, { total_credits: 50000, total_debits: 1500, transaction_count: 15 });
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
            const db = require('../../server/database').default;

            const result = await TokenBillingService.creditOrganization('org-123', 10000, {
                userId: 'user-1',
                reason: 'Manual Credit',
                refType: 'GRANT'
            });

            expect(result).toHaveProperty('tokens', 10000);
            expect(result).toHaveProperty('orgId', 'org-123');
            expect(result).toHaveProperty('ledgerId');

            // Verify db.run was called for UPDATE and INSERT
            expect(db.run).toHaveBeenCalled();
        });
    });
});

describe('TokenBillingService - deductTokens with Ledger', () => {
    it('should create ledger entry when deducting from organization', async () => {
        const db = require('../../server/database').default;

        const result = await TokenBillingService.deductTokens('user-1', 500, 'platform', {
            organizationId: 'org-123',
            llmProvider: 'openai',
            modelUsed: 'gpt-4',
            multiplier: 1.0
        });

        expect(result).toHaveProperty('transactionId');
        expect(result).toHaveProperty('tokens');

        // Verify INSERT INTO token_ledger was called
        const insertCalls = db.run.mock.calls.filter(call =>
            call[0] && call[0].includes('token_ledger')
        );
        expect(insertCalls.length).toBeGreaterThan(0);
    });
});
