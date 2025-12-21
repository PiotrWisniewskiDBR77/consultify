/**
 * Integration Test: Onboarding to Initiatives Link (Phase E->F)
 * 
 * Verifies that created_from_plan_id is properly set when accepting an onboarding plan.
 */

const { describe, it, expect, beforeAll, afterAll, vi } = require('vitest');

// Mock database
const mockDb = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn()
};

// Mock the database module
vi.mock('../../server/database', () => mockDb);

// Mock sqliteAsync
vi.mock('../../server/db/sqliteAsync', () => ({
    runAsync: vi.fn().mockResolvedValue({ changes: 1 }),
    getAsync: vi.fn(),
    withTransaction: vi.fn(async (db, fn) => fn())
}));

// Mock AI Service
vi.mock('../../server/services/aiService', () => ({
    generateFirstValuePlan: vi.fn().mockResolvedValue({
        steps: [{ title: 'Step 1' }],
        suggested_initiatives: [
            { title: 'Initiative 1', summary: 'Summary 1', hypothesis: 'Hyp 1' },
            { title: 'Initiative 2', summary: 'Summary 2', hypothesis: 'Hyp 2' }
        ]
    })
}));

const { runAsync, getAsync } = require('../../server/db/sqliteAsync');

describe('Onboarding to Initiatives Link (Phase E->F)', () => {
    const testOrgId = 'org-test-123';
    const testUserId = 'user-test-456';

    beforeAll(() => {
        // Reset mocks
        vi.clearAllMocks();
    });

    describe('generatePlan', () => {
        it('should generate a plan with a stable planId', async () => {
            // Setup
            getAsync.mockResolvedValueOnce({
                transformation_context: JSON.stringify({ role: 'PM', problems: 'test' }),
                onboarding_plan_version: 1,
                onboarding_status: 'IN_PROGRESS'
            });

            const OnboardingService = require('../../server/services/onboardingService');

            // Execute
            const result = await OnboardingService.generatePlan(testOrgId, testUserId);

            // Assert
            expect(result.planId).toBeDefined();
            expect(result.planId).toMatch(/^onbplan-org-test-123-v\d+$/);
            expect(result.plan.planId).toBe(result.planId);
        });
    });

    describe('acceptPlan', () => {
        it('should create initiatives with created_from_plan_id set', async () => {
            // Setup - org with generated plan that has planId
            const mockPlan = {
                planId: 'onbplan-org-test-123-v2',
                steps: [],
                suggested_initiatives: [
                    { id: 'init-0', title: 'Initiative 1', summary: 'Sum 1', hypothesis: 'Hyp 1' }
                ]
            };

            getAsync.mockResolvedValueOnce({
                onboarding_plan_snapshot: JSON.stringify(mockPlan),
                onboarding_status: 'GENERATED',
                onboarding_accept_idempotency_key: null
            });

            // Track INSERT calls
            const insertCalls = [];
            runAsync.mockImplementation((db, sql, params) => {
                if (sql.includes('INSERT INTO initiatives')) {
                    insertCalls.push({ sql, params });
                }
                return Promise.resolve({ changes: 1 });
            });

            const OnboardingService = require('../../server/services/onboardingService');

            // Execute
            const result = await OnboardingService.acceptPlan(testOrgId, testUserId, {});

            // Assert
            expect(result.success).toBe(true);
            expect(result.createdCount).toBe(1);

            // Verify INSERT included created_from_plan_id
            expect(insertCalls.length).toBeGreaterThan(0);
            const initiativeInsert = insertCalls.find(c => c.sql.includes('INSERT INTO initiatives'));
            expect(initiativeInsert).toBeDefined();
            expect(initiativeInsert.sql).toContain('created_from_plan_id');
            expect(initiativeInsert.params).toContain('onbplan-org-test-123-v2');
        });

        it('should use fallback planId if plan.planId is missing', async () => {
            // Setup - legacy plan without planId
            const mockPlan = {
                steps: [],
                suggested_initiatives: [
                    { id: 'init-0', title: 'Legacy Init', summary: 'Sum', hypothesis: 'Hyp' }
                ]
            };

            getAsync.mockResolvedValueOnce({
                onboarding_plan_snapshot: JSON.stringify(mockPlan),
                onboarding_status: 'GENERATED',
                onboarding_accept_idempotency_key: null
            });

            const insertCalls = [];
            runAsync.mockImplementation((db, sql, params) => {
                if (sql.includes('INSERT INTO initiatives')) {
                    insertCalls.push({ sql, params });
                }
                return Promise.resolve({ changes: 1 });
            });

            const OnboardingService = require('../../server/services/onboardingService');

            // Execute
            const result = await OnboardingService.acceptPlan(testOrgId, testUserId, {
                idempotencyKey: 'test-key-fallback'
            });

            // Assert - should use fallback format
            expect(result.success).toBe(true);
            const initiativeInsert = insertCalls.find(c => c.sql.includes('INSERT INTO initiatives'));
            expect(initiativeInsert.params).toContain(`onbplan-${testOrgId}-unknown`);
        });
    });

    describe('End-to-End: Plan Generation -> Acceptance -> Initiative Linkage', () => {
        it('should maintain created_from_plan_id through full flow', async () => {
            // This test validates the contract:
            // generatePlan produces planId -> acceptPlan uses it -> initiatives have it

            // 1. Generate Plan
            getAsync.mockResolvedValueOnce({
                transformation_context: JSON.stringify({ role: 'PM', problems: 'test' }),
                onboarding_plan_version: 5,
                onboarding_status: 'IN_PROGRESS'
            });

            const OnboardingService = require('../../server/services/onboardingService');
            const genResult = await OnboardingService.generatePlan(testOrgId, testUserId);

            expect(genResult.planId).toBe('onbplan-org-test-123-v6');
            expect(genResult.plan.planId).toBe('onbplan-org-test-123-v6');

            // 2. Accept Plan (simulating it was saved)
            getAsync.mockResolvedValueOnce({
                onboarding_plan_snapshot: JSON.stringify(genResult.plan),
                onboarding_status: 'GENERATED',
                onboarding_accept_idempotency_key: null
            });

            const insertCalls = [];
            runAsync.mockImplementation((db, sql, params) => {
                if (sql.includes('INSERT INTO initiatives')) {
                    insertCalls.push(params);
                }
                return Promise.resolve({ changes: 1 });
            });

            const accResult = await OnboardingService.acceptPlan(testOrgId, testUserId, {});

            // 3. Verify linkage
            expect(accResult.success).toBe(true);

            // Every created initiative should have the planId
            for (const params of insertCalls) {
                expect(params).toContain('onbplan-org-test-123-v6');
            }
        });
    });
});
