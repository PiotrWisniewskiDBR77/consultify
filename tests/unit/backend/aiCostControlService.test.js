import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import AICostControlService from '../../../server/services/aiCostControlService.js';

describe('AICostControlService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default DB mocks
        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb.call({ changes: 1, lastID: 1 }, null);
            }
        });

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, null); // No budget found by default
            }
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, []);
            }
        });
    });

    describe('setGlobalBudget', () => {
        it('should set global budget', async () => {
            const result = await AICostControlService.setGlobalBudget(1000, true);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE INTO ai_budgets'),
                expect.arrayContaining(['global', 'global', 1000]),
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            mockDb.run.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') cb(new Error('DB Error'));
            });

            await expect(AICostControlService.setGlobalBudget(1000)).rejects.toThrow('DB Error');
        });
    });

    describe('setTenantBudget', () => {
        it('should set tenant budget', async () => {
            const result = await AICostControlService.setTenantBudget('org-1', 500);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE INTO ai_budgets'),
                expect.arrayContaining(['organization', 'org-1', 500]),
                expect.any(Function)
            );
        });
    });

    describe('setProjectBudget', () => {
        it('should set project budget', async () => {
            const result = await AICostControlService.setProjectBudget('proj-1', 100);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE INTO ai_budgets'),
                expect.arrayContaining(['project', 'proj-1', 100]),
                expect.any(Function)
            );
        });
    });

    describe('getBudget', () => {
        it('should return budget when found', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        scope_type: 'project',
                        scope_id: 'proj-1',
                        monthly_limit_usd: 100,
                        current_usage_usd: 50,
                        auto_downgrade: 1
                    });
                }
            });

            const result = await AICostControlService.getBudget('project', 'proj-1');

            expect(result.monthly_limit_usd).toBe(100);
            expect(result.current_usage_usd).toBe(50);
        });

        it('should return null when not found', async () => {
            const result = await AICostControlService.getBudget('project', 'missing');
            expect(result).toBeNull();
        });
    });

    describe('checkBudget', () => {
        it('should allow action when no limits set', async () => {
            // No budgets found
            const result = await AICostControlService.checkBudget('org-1', 'proj-1', 0.1);

            expect(result.allowed).toBe(true);
            expect(result.shouldDowngrade).toBe(false);
        });

        it('should allow action when within budget', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    // Organization budget
                    cb(null, {
                        monthly_limit_usd: 100,
                        current_usage_usd: 10,
                        auto_downgrade: 1
                    });
                }
            });

            const result = await AICostControlService.checkBudget('org-1', null, 5);

            expect(result.allowed).toBe(true);
            expect(result.remainingBudget).toBe(85); // 100 - 10 - 5
        });

        it('should block action when exceeding budget without auto-downgrade', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        monthly_limit_usd: 100,
                        current_usage_usd: 99,
                        auto_downgrade: 0 // Disabled
                    });
                }
            });

            const result = await AICostControlService.checkBudget('org-1', null, 2);

            expect(result.allowed).toBe(false);
            expect(result.shouldDowngrade).toBe(false);
        });

        it('should trigger downgrade when exceeding budget with auto-downgrade enabled', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        monthly_limit_usd: 100,
                        current_usage_usd: 99,
                        auto_downgrade: 1 // Enabled
                    });
                }
            });

            const result = await AICostControlService.checkBudget('org-1', null, 2);

            expect(result.allowed).toBe(true); // Still allowed but with downgrade needed
            expect(result.shouldDowngrade).toBe(true);
        });

        it('should check project budget limit', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('project')) {
                        cb(null, {
                            monthly_limit_usd: 50,
                            current_usage_usd: 49,
                            auto_downgrade: 0
                        });
                    } else {
                        cb(null, null); // No org budget
                    }
                }
            });

            const result = await AICostControlService.checkBudget('org-1', 'proj-1', 2);

            expect(result.allowed).toBe(false);
        });
    });

    describe('estimateCost', () => {
        it('should calculate cost for known models', () => {
            const cost = AICostControlService.estimateCost('gpt-4', 1000, 1000);

            // GPT-4: $30/1M input, $60/1M output (example prices used in implementation)
            // 1k in = $0.03, 1k out = $0.06 => Total $0.09
            expect(cost).toBeGreaterThan(0);
        });

        it('should fallback to default for unknown models', () => {
            const cost = AICostControlService.estimateCost('unknown-model', 1000, 1000);
            expect(cost).toBeGreaterThan(0);
        });
    });

    describe('logUsage', () => {
        it('should log usage and update budgets', async () => {
            const params = {
                organizationId: 'org-1',
                projectId: 'proj-1',
                userId: 'user-1',
                modelUsed: 'gpt-4',
                modelCategory: 'reasoning',
                actionType: 'CHAT',
                inputTokens: 1000,
                outputTokens: 500
            };

            const result = await AICostControlService.logUsage(params);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledTimes(2); // Log usage + Update budget
        });

        it('should handle updates without project', async () => {
            const params = {
                organizationId: 'org-1',
                userId: 'user-1',
                modelUsed: 'gpt-4',
                inputTokens: 1000,
                outputTokens: 500
            };

            const result = await AICostControlService.logUsage(params);
            expect(result.success).toBe(true);
        });
    });

    describe('resetMonthlyUsage', () => {
        it('should reset usage for all scopes if unspecified', async () => {
            const result = await AICostControlService.resetMonthlyUsage();

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE ai_budgets SET current_usage_usd = 0'),
                expect.any(Function)
            );
        });

        it('should reset usage for specific scope', async () => {
            await AICostControlService.resetMonthlyUsage('project');

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('WHERE scope_type = ?'),
                ['project'],
                expect.any(Function)
            );
        });
    });

    describe('Model Selection', () => {
        it('should return correct category for action', () => {
            expect(AICostControlService.getCategoryForAction('ANALYZE_RISKS')).toBe(AICostControlService.MODEL_CATEGORIES.REASONING);
            expect(AICostControlService.getCategoryForAction('CHAT')).toBe(AICostControlService.MODEL_CATEGORIES.CHAT);
        });

        it('should fallback to CHAT for unknown action', () => {
            expect(AICostControlService.getCategoryForAction('UNKNOWN')).toBe(AICostControlService.MODEL_CATEGORIES.CHAT);
        });

        it('should prioritize role if present', () => {
            expect(AICostControlService.getCategoryForAction(null, 'CONSULTANT')).toBe(AICostControlService.MODEL_CATEGORIES.EXECUTION);
        });
    });

    describe('getTierForBudget', () => {
        it('should return tier 1 for non-downgraded reasoning', () => {
            const status = { shouldDowngrade: false };
            const tier = AICostControlService.getTierForBudget(status, AICostControlService.MODEL_CATEGORIES.REASONING);
            expect(tier).toBe(1);
        });

        it('should downgrade premium to standard when budget constrained', () => {
            const status = { shouldDowngrade: true };
            const tier = AICostControlService.getTierForBudget(status, AICostControlService.MODEL_CATEGORIES.REASONING);
            expect(tier).toBe(2);
        });

        it('should downgrade standard to budget when constrained', () => {
            const status = { shouldDowngrade: true };
            const tier = AICostControlService.getTierForBudget(status, AICostControlService.MODEL_CATEGORIES.EXECUTION);
            expect(tier).toBe(3);
        });

        it('should keep budget tier at 3 even when constrained', () => {
            const status = { shouldDowngrade: true };
            const tier = AICostControlService.getTierForBudget(status, AICostControlService.MODEL_CATEGORIES.CHAT);
            expect(tier).toBe(3);
        });
    });

    describe('Analytics', () => {
        it('should return usage summary', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: '1', usage: 100 }]);
                }
            });

            const result = await AICostControlService.getUsageSummary('org-1');
            expect(result).toHaveLength(1);
        });

        it('should return user usage', async () => {
            const result = await AICostControlService.getUserUsage('user-1', 'org-1');
            expect(mockDb.run).not.toHaveBeenCalled(); // Read-only
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should return all budgets', async () => {
            const result = await AICostControlService.getAllBudgets();
            expect(result).toHaveLength(1);
        });
    });
});
