/**
 * Usage Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests token/storage usage tracking, quota enforcement, and overage calculation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb, createMockUuid } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('UsageService', () => {
    let mockDb;
    let UsageService;
    let mockUuid;
    let mockBillingService;

    beforeEach(() => {
        mockDb = createMockDb();
        // Mock UUID that returns just the counter (service adds 'usage-' prefix)
        let counter = 0;
        mockUuid = () => {
            counter++;
            return counter.toString();
        };
        mockBillingService = {
            getOrganizationBilling: vi.fn(),
            getPlanById: vi.fn()
        };

        UsageService = require('../../../server/services/usageService.js');
        UsageService._setDependencies({
            db: mockDb,
            uuidv4: mockUuid,
            billingService: mockBillingService
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('recordTokenUsage()', () => {
        it('should record token usage', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.admin.id;
            const tokens = 1000;
            const action = 'ai_chat';
            const metadata = { model: 'gpt-4', provider: 'openai' };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO usage_records');
                expect(query).toContain("'token'"); // Type is hardcoded in SQL
                expect(params[0]).toBe('usage-1'); // UUID
                expect(params[1]).toBe(orgId);
                expect(params[2]).toBe(userId);
                expect(params[3]).toBe(tokens);
                expect(params[4]).toBe(action);
                callback.call({ changes: 1 }, null);
            });

            const result = await UsageService.recordTokenUsage(orgId, userId, tokens, action, metadata);

            expect(result.id).toBe('usage-1');
            expect(result.tokens).toBe(tokens);
        });

        it('should handle database errors', async () => {
            const orgId = testOrganizations.org1.id;
            const dbError = new Error('Database error');

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(
                UsageService.recordTokenUsage(orgId, testUsers.admin.id, 100, 'action')
            ).rejects.toThrow('Database error');
        });
    });

    describe('recordStorageUsage()', () => {
        it('should record storage usage', async () => {
            const orgId = testOrganizations.org1.id;
            const bytes = 1024 * 1024; // 1MB
            const action = 'upload';
            const metadata = { filename: 'test.pdf' };

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain("'storage'"); // Type is hardcoded in SQL
                expect(params[0]).toBe('usage-1'); // UUID
                expect(params[1]).toBe(orgId);
                expect(params[2]).toBe(null); // user_id is NULL for storage
                expect(params[3]).toBe(bytes);
                callback.call({ changes: 1 }, null);
            });

            const result = await UsageService.recordStorageUsage(orgId, bytes, action, metadata);

            expect(result.id).toBe('usage-1');
            expect(result.bytes).toBe(bytes);
        });
    });

    describe('getCurrentUsage()', () => {
        it('should return current usage with token and storage limits', async () => {
            const orgId = testOrganizations.org1.id;
            const mockBilling = {
                subscription_plan_id: 'plan-123',
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };
            const mockPlan = {
                id: 'plan-123',
                name: 'Professional',
                token_limit: 10000,
                storage_limit_gb: 10
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue(mockBilling);
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 5000,
                    storage_bytes: 5 * 1024 * 1024 * 1024 // 5GB
                });
            });

            const result = await UsageService.getCurrentUsage(orgId);

            expect(result.tokens.used).toBe(5000);
            expect(result.tokens.limit).toBe(10000);
            expect(result.tokens.remaining).toBe(5000);
            expect(result.tokens.percentage).toBe(50);
            expect(result.storage.usedGB).toBe(5);
            expect(result.storage.limitGB).toBe(10);
            expect(result.plan).toBe('Professional');
        });

        it('should handle organizations without plan', async () => {
            const orgId = testOrganizations.org1.id;

            mockBillingService.getOrganizationBilling.mockResolvedValue(null);
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 0,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.getCurrentUsage(orgId);

            expect(result.tokens.limit).toBe(0);
            expect(result.storage.limitGB).toBe(0);
            expect(result.plan).toBe('Free');
        });

        it('should calculate storage percentage correctly', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                storage_limit_gb: 10
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 0,
                    storage_bytes: 7.5 * 1024 * 1024 * 1024 // 7.5GB out of 10GB
                });
            });

            const result = await UsageService.getCurrentUsage(orgId);

            expect(result.storage.percentage).toBe(75);
        });

        it('should ensure storage never goes below 0', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                storage_limit_gb: 10
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 0,
                    storage_bytes: -1000 // Negative value (data anomaly)
                });
            });

            const result = await UsageService.getCurrentUsage(orgId);

            expect(result.storage.used).toBeGreaterThanOrEqual(0);
            expect(result.storage.remaining).toBeGreaterThanOrEqual(0);
        });
    });

    describe('checkQuota()', () => {
        it('should allow when quota available', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                token_overage_rate: 0
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 5000,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.checkQuota(orgId, 'token');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5000);
        });

        it('should deny when quota exceeded and overage disabled', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                token_overage_rate: 0
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 10000,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.checkQuota(orgId, 'token');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should allow when overage enabled even if quota exceeded', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                token_overage_rate: 0.01 // Overage enabled
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 15000, // Over limit
                    storage_bytes: 0
                });
            });

            const result = await UsageService.checkQuota(orgId, 'token');

            expect(result.allowed).toBe(true);
            expect(result.overageEnabled).toBe(true);
        });

        it('should allow unlimited when limit is 0', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 0, // Unlimited
                token_overage_rate: 0
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 999999,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.checkQuota(orgId, 'token');

            expect(result.allowed).toBe(true);
        });
    });

    describe('calculateOverage()', () => {
        it('should calculate overage charges correctly', async () => {
            const orgId = testOrganizations.org1.id;
            const periodStart = new Date('2024-01-01');
            const periodEnd = new Date('2024-01-31');
            const mockPlan = {
                token_limit: 10000,
                token_overage_rate: 0.01, // $0.01 per 1K tokens
                storage_limit_gb: 10,
                storage_overage_rate: 0.10 // $0.10 per GB
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 15000, // 5K over limit
                    storage_peak: 12 * 1024 * 1024 * 1024 // 12GB (2GB over)
                });
            });

            const result = await UsageService.calculateOverage(orgId, periodStart, periodEnd);

            expect(result.tokenOverageAmount).toBe(5000);
            expect(result.tokenOverage).toBeGreaterThan(0);
            expect(result.storageOverageGB).toBe(2);
            expect(result.storageOverage).toBeGreaterThan(0);
            expect(result.totalOverage).toBeGreaterThan(0);
        });

        it('should return zero overage when within limits', async () => {
            const orgId = testOrganizations.org1.id;
            const mockPlan = {
                token_limit: 10000,
                storage_limit_gb: 10
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 5000,
                    storage_peak: 5 * 1024 * 1024 * 1024
                });
            });

            const result = await UsageService.calculateOverage(
                orgId,
                new Date('2024-01-01'),
                new Date('2024-01-31')
            );

            expect(result.tokenOverageAmount).toBe(0);
            expect(result.storageOverageGB).toBe(0);
            expect(result.totalOverage).toBe(0);
        });
    });

    describe('updateUsageSummary()', () => {
        it('should create or update usage summary', async () => {
            const orgId = testOrganizations.org1.id;
            const periodStart = new Date('2024-01-01');
            const mockPlan = {
                token_limit: 10000,
                storage_limit_gb: 10
            };

            mockBillingService.getOrganizationBilling.mockResolvedValue({
                subscription_plan_id: 'plan-123'
            });
            mockBillingService.getPlanById.mockResolvedValue(mockPlan);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 5000,
                    storage_peak: 5 * 1024 * 1024 * 1024
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('INSERT INTO usage_summaries');
                expect(query).toContain('ON CONFLICT');
                callback.call({ changes: 1 }, null);
            });

            const result = await UsageService.updateUsageSummary(orgId, periodStart);

            expect(result.id).toBeDefined();
        });
    });

    describe('getUsageHistory()', () => {
        it('should retrieve usage history', async () => {
            const orgId = testOrganizations.org1.id;
            const mockHistory = [
                { id: 'summary-1', period_start: '2024-01-01', tokens_used: 5000 },
                { id: 'summary-2', period_start: '2024-02-01', tokens_used: 6000 }
            ];

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT * FROM usage_summaries');
                expect(params[0]).toBe(orgId);
                expect(params[1]).toBe(12); // default limit
                callback(null, mockHistory);
            });

            const result = await UsageService.getUsageHistory(orgId);

            expect(result).toEqual(mockHistory);
        });

        it('should respect limit parameter', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(params[1]).toBe(6); // custom limit
                callback(null, []);
            });

            await UsageService.getUsageHistory(orgId, 6);
        });
    });

    describe('getGlobalUsageStats()', () => {
        it('should return global usage statistics', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    total_tokens: 1000000,
                    total_storage: 100 * 1024 * 1024 * 1024, // 100GB
                    active_orgs: 10
                });
            });

            const result = await UsageService.getGlobalUsageStats();

            expect(result.totalTokensThisMonth).toBe(1000000);
            expect(result.totalStorageGB).toBe(100);
            expect(result.activeOrganizations).toBe(10);
            expect(result.periodStart).toBeDefined();
        });
    });

    describe('checkProjectQuota()', () => {
        it('should check project storage quota', async () => {
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    storage_limit_gb: 5,
                    storage_used_bytes: 2 * 1024 * 1024 * 1024 // 2GB used
                });
            });

            const result = await UsageService.checkProjectQuota(projectId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBeGreaterThan(0);
            expect(result.percentage).toBeLessThan(100);
        });

        it('should allow unlimited when limit is null', async () => {
            const projectId = testProjects.project1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    storage_limit_gb: null,
                    storage_used_bytes: 100 * 1024 * 1024 * 1024
                });
            });

            const result = await UsageService.checkProjectQuota(projectId);

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(Infinity);
        });

        it('should reject when project not found', async () => {
            const projectId = 'nonexistent';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                UsageService.checkProjectQuota(projectId)
            ).rejects.toThrow('Project not found');
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should filter usage by organization_id', async () => {
            const orgId = testOrganizations.org1.id;

            mockBillingService.getOrganizationBilling.mockResolvedValue(null);
            mockDb.get.mockImplementation((query, params, callback) => {
                expect(query).toContain('WHERE organization_id = ?');
                expect(params).toContain(orgId);
                callback(null, { tokens_used: 0, storage_bytes: 0 });
            });

            await UsageService.getCurrentUsage(orgId);
        });
    });
});

