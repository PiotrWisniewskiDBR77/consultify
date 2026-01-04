/**
 * Budget Management Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations, testUsers } from '../../fixtures/testData.js';
import BudgetManagementService from '../../../server/src/services/budgetManagementService.js';

describe('BudgetManagementService', () => {
    let mockDb;
    let mockUuid;

    beforeEach(() => {
        mockDb = createMockDb();
        let counter = 0;
        mockUuid = () => {
            counter++;
            return counter.toString();
        };

        BudgetManagementService.setDependencies({
            db: mockDb,
            uuidv4: mockUuid
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('setUserBudget()', () => {
        it('should set user budget with correct values', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.admin.id;
            const budget = {
                monthlyTokenBudget: 50000,
                monthlyStorageBudgetGb: 10,
                monthlyCostBudgetUsd: 100,
                hardLimitEnabled: true
            };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO user_budgets');
                expect(params[0]).toBe('budget-user-1');
                expect(params[1]).toBe(orgId);
                expect(params[2]).toBe(userId);
                expect(params[3]).toBe(budget.monthlyTokenBudget);
                callback.call({ changes: 1 }, null);
            });

            const result = await BudgetManagementService.setUserBudget(orgId, userId, budget);
            expect(result.id).toBe('budget-user-1');
        });
    });

    describe('checkBudgetLimit()', () => {
        it('should allow if no budget is set', async () => {
            const orgId = 'org1';
            const userId = 'user1';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null); // No budget found
            });

            const result = await BudgetManagementService.checkBudgetLimit(orgId, userId, null, 'tokens', 100);
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('No budget set');
        });

        it('should allow if within limit', async () => {
            const orgId = 'org1';
            const userId = 'user1';
            const budget = {
                monthly_token_budget: 1000,
                tokens_used_this_month: 500,
                hard_limit_enabled: 1
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, budget);
            });

            const result = await BudgetManagementService.checkBudgetLimit(orgId, userId, null, 'tokens', 100);
            expect(result.allowed).toBe(true);
            expect(result.usagePercent).toBe('60.00');
        });

        it('should block if over limit and hard limit enabled', async () => {
            const orgId = 'org1';
            const userId = 'user1';
            const budget = {
                monthly_token_budget: 1000,
                tokens_used_this_month: 950,
                hard_limit_enabled: 1
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, budget);
            });

            const result = await BudgetManagementService.checkBudgetLimit(orgId, userId, null, 'tokens', 100);
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Budget limit exceeded');
        });
    });

    describe('getBudgetStatus()', () => {
        it('should calculate usage percentages correctly', async () => {
            const orgId = 'org1';
            const userId = 'user1';
            const budget = {
                monthly_token_budget: 1000,
                tokens_used_this_month: 750,
                monthly_storage_budget_gb: 10,
                storage_used_this_month_gb: 2
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, budget);
            });

            const result = await BudgetManagementService.getBudgetStatus(orgId, userId);
            expect(result.tokenUsagePercent).toBe('75.00');
            expect(result.storageUsagePercent).toBe('20.00');
        });
    });
});
