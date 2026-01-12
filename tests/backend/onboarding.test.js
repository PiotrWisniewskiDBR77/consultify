import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../../server/database';

// Use require to match the backend style and ensure same module instance
const OnboardingService = require('../../server/services/onboardingService');
const AiService = require('../../server/services/aiService');
const sqliteAsync = require('../../server/db/sqliteAsync');

describe('Onboarding Service Verification', () => {
    const mockOrgId = 'org-123';
    const mockUserId = 'user-456';
    let runAsyncSpy, getAsyncSpy, aiSpy, withTxSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // Spy on async helpers
        runAsyncSpy = vi.spyOn(sqliteAsync, 'runAsync');
        getAsyncSpy = vi.spyOn(sqliteAsync, 'getAsync');
        withTxSpy = vi.spyOn(sqliteAsync, 'withTransaction');

        // Spy on AI Service
        aiSpy = vi.spyOn(AiService, 'generateFirstValuePlan');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('saveContext', () => {
        test('Should validate and update organization context', async () => {
            runAsyncSpy.mockResolvedValue({ changes: 1 });

            const context = { role: 'CTO', problems: 'Scaling', industry: 'Tech' };
            const result = await OnboardingService.saveContext(mockOrgId, context);

            expect(result.success).toBe(true);
            expect(result.status).toBe('IN_PROGRESS');
            expect(runAsyncSpy).toHaveBeenCalledWith(
                db,
                expect.stringContaining('UPDATE organizations'),
                expect.arrayContaining([expect.any(String), mockOrgId])
            );
        });

        test('Should reject context without required fields', async () => {
            await expect(OnboardingService.saveContext(mockOrgId, {}))
                .rejects.toThrow('Missing required field');
        });
    });

    describe('generatePlan', () => {
        test('Should fetch context and call AI Service', async () => {
            const mockContext = { role: 'CEO', industry: 'Tech', problems: 'Growth', urgency: 'High', targets: 'Revenue' };

            // Mock getAsync to return org with context
            getAsyncSpy.mockResolvedValue({
                transformation_context: JSON.stringify(mockContext),
                onboarding_plan_version: 0,
                organization_type: 'PAID'
            });

            // Mock runAsync for update
            runAsyncSpy.mockResolvedValue({ changes: 1 });

            // Mock AI return
            const mockPlan = {
                plan_title: 'Growth Plan',
                steps: [{ title: 'Step 1' }],
                suggested_initiatives: [{ title: 'Init 1' }]
            };
            aiSpy.mockResolvedValue(mockPlan);

            // Note: in refactored code, args are (orgId, userId)
            const result = await OnboardingService.generatePlan(mockOrgId, mockUserId);

            expect(getAsyncSpy).toHaveBeenCalled();
            expect(aiSpy).toHaveBeenCalledWith(mockContext, mockUserId);
            expect(result.plan).toBeDefined();
            expect(result.planVersion).toBe(1);
        });
    });

    describe('acceptPlan', () => {
        test('Should create initiatives with idempotency', async () => {
            const mockPlan = {
                suggested_initiatives: [
                    { id: 'init-0', title: 'Init 1', summary: 'S1', hypothesis: 'H1' },
                    { id: 'init-1', title: 'Init 2', summary: 'S2', hypothesis: 'H2' }
                ]
            };

            // Mock withTransaction to execute the function passed to it
            withTxSpy.mockImplementation(async (db, fn) => await fn());

            // Mock getAsync (for idempotency/status check)
            getAsyncSpy.mockResolvedValue({
                onboarding_plan_snapshot: JSON.stringify(mockPlan),
                onboarding_status: 'GENERATED',
                onboarding_accept_idempotency_key: null
            });

            // Mock runAsync for inserts
            runAsyncSpy.mockResolvedValue({ changes: 1 });

            const result = await OnboardingService.acceptPlan(mockOrgId, mockUserId, {
                acceptedInitiativeIds: ['init-0', 'init-1'],
                idempotencyKey: 'test-key-123'
            });

            expect(result.success).toBe(true);
            expect(result.createdCount).toBe(2);
            expect(result.idempotent).toBe(false);
        });

        test('Should be idempotent on duplicate request', async () => {
            withTxSpy.mockImplementation(async (db, fn) => await fn());

            getAsyncSpy.mockResolvedValue({
                onboarding_plan_snapshot: '{}',
                onboarding_status: 'GENERATED',
                onboarding_accept_idempotency_key: 'test-key-123' // Same key!
            });

            const result = await OnboardingService.acceptPlan(mockOrgId, mockUserId, {
                idempotencyKey: 'test-key-123'
            });

            expect(result.success).toBe(true);
            expect(result.idempotent).toBe(true);
            expect(result.createdCount).toBe(0);
        });
    });
});
