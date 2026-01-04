/**
 * AI Action Executor Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests AI action execution, approval workflow, and governance integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('AIActionExecutor', () => {
    let mockDb;
    let mockRegulatoryModeGuard;
    let mockAIRoleGuard;
    let mockAIPolicyEngine;
    let AIActionExecutor;

    beforeEach(async () => {
        vi.resetModules();

        // Create mocks for DbPromise
        mockDb = {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn(),
        };
        // Also export a default object to match DbPromise structure if needed, 
        // though named exports are what's being used.
        mockDb.default = mockDb;

        // Mock dependencies
        mockRegulatoryModeGuard = {
            enforceRegulatoryMode: vi.fn().mockResolvedValue({ blocked: false })
        };

        mockAIRoleGuard = {
            isActionBlocked: vi.fn().mockResolvedValue({ blocked: false, requiresApproval: false })
        };

        mockAIPolicyEngine = {
            canPerformAction: vi.fn().mockResolvedValue({ allowed: true })
        };

        // Mock DbPromise
        vi.doMock('../../../server/src/utils/DbPromise.ts', () => ({
            ...mockDb,
            default: mockDb
        }));

        // Mock other lazy-loaded dependencies if possible, or we rely on them being imported?
        // aiActionExecutor uses lazy import() for guards. We can mock those modules too if needed.
        // But for now let's focus on DB.

        // Import service
        try {
            // We need to handle the lazy imports inside the service. 
            // Since they use import(), we should mock the module paths they use.
            vi.doMock('../../../server/src/services/aiRoleGuard.js', () => ({ default: mockAIRoleGuard }));
            vi.doMock('../../../server/src/services/regulatoryModeGuard.js', () => ({ default: mockRegulatoryModeGuard }));
            vi.doMock('../../../server/src/services/aiPolicyEngine.js', () => ({ default: mockAIPolicyEngine }));
            // Note: Paths depend on where aiActionExecutor tries to import them from. 
            // It uses './aiRoleGuard.js', so relative to server/src/services/.
            // Test file is in tests/unit/backend which is deep. 
            // Ideally we mock the absolute path or careful relative path.
            // But let's try just importing the service first.

            const module = await import('../../../server/src/services/aiActionExecutor.ts');
            AIActionExecutor = module.default || module;
            console.log('Imported AIActionExecutor keys:', Object.keys(AIActionExecutor || {}));
        } catch (e) {
            console.error("Failed to import AIActionExecutor", e);
            throw e;
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/src/utils/DbPromise.ts');
        vi.doUnmock('../../../server/src/services/aiRoleGuard.js');
        vi.doUnmock('../../../server/src/services/regulatoryModeGuard.js');
        vi.doUnmock('../../../server/src/services/aiPolicyEngine.js');
    });

    describe('requestAction()', () => {
        it('should create action request successfully', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockDb.run.mockResolvedValue({ changes: 1, lastID: 1, success: true });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(true);
            // When no approval required, status is APPROVED directly
            expect(result.status).toBe('APPROVED');
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should create pending action when approval required', async () => {
            // Mock AIRoleGuard to require approval
            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: false,
                requiresApproval: true
            });

            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockDb.run.mockResolvedValue({ changes: 1, lastID: 1, success: true });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('PENDING');
            expect(result.requiresApproval).toBe(true);
        });

        it('should block action when regulatory mode is enabled', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockRegulatoryModeGuard.enforceRegulatoryMode.mockResolvedValue({
                blocked: true,
                reason: 'REGULATORY_MODE',
                message: 'Action blocked by Regulatory Mode'
            });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.regulatoryModeEnabled).toBe(true);
            expect(result.reason).toBe('REGULATORY_MODE');
        });

        it('should block action when AI role guard blocks it', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: true,
                currentRole: 'ADVISOR',
                roleRequired: 'MANAGER',
                reason: 'Action requires MANAGER role',
                suggestion: 'Change project AI role'
            });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.currentRole).toBe('ADVISOR');
            expect(result.requiredRole).toBe('MANAGER');
        });

        it('should require approval for MANAGER role actions', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: false,
                requiresApproval: true
            });

            mockDb.run.mockResolvedValue({ changes: 1, lastID: 1, success: true });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.requiresApproval).toBe(true);
        });

        it('should block action when policy engine denies it', async () => {
            const actionType = 'CREATE_DRAFT_TASK';
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockAIPolicyEngine.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Action not allowed by policy'
            });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(false);
            expect(result.requiresUpgrade).toBe(true);
        });

        it('should allow action without projectId', async () => {
            const actionType = 'EXPLAIN_CONTEXT';
            const payload = { context: 'test' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.run.mockResolvedValue({ changes: 1, lastID: 1, success: true });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                null
            );

            expect(result.success).toBe(true);
            // Should not check regulatory mode or role guard without projectId
            expect(mockRegulatoryModeGuard.enforceRegulatoryMode).not.toHaveBeenCalled();
            expect(mockAIRoleGuard.isActionBlocked).not.toHaveBeenCalled();
        });
    });

    describe('approveAction()', () => {
        it('should approve pending action', async () => {
            const actionId = 'action-123';
            const userId = testUsers.admin.id;

            mockDb.get.mockResolvedValue({
                id: actionId,
                status: 'PENDING',
                action_type: 'CREATE_DRAFT_TASK',
                payload: JSON.stringify({ title: 'Test Task' })
            });

            mockDb.run.mockResolvedValue({ changes: 1, lastID: 1, success: true });

            const result = await AIActionExecutor.approveAction(actionId, userId);

            expect(result.success).toBe(true);
            expect(result.status).toBe('APPROVED');
        });

        it('should reject approval for non-pending action', async () => {
            const actionId = 'action-123';
            const userId = testUsers.admin.id;

            // Mock that no rows are updated (action not in PENDING status)
            mockDb.run.mockResolvedValue({ changes: 0, success: true });

            const result = await AIActionExecutor.approveAction(actionId, userId);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('rejectAction()', () => {
        it('should reject pending action', async () => {
            const actionId = 'action-123';
            const userId = testUsers.admin.id;
            const reason = 'Not needed';

            mockDb.get.mockResolvedValue({
                id: actionId,
                status: 'PENDING'
            });

            mockDb.run.mockResolvedValue({ changes: 1, success: true });

            const result = await AIActionExecutor.rejectAction(actionId, userId, reason);

            expect(result.success).toBe(true);
            expect(result.status).toBe('REJECTED');
        });
    });

    describe('executeAction()', () => {
        it('should execute approved action', async () => {
            const actionId = 'action-123';

            mockDb.get.mockResolvedValue({
                id: actionId,
                status: 'APPROVED',
                action_type: 'CREATE_DRAFT_TASK',
                payload: JSON.stringify({ title: 'Test Task' }),
                draft_content: JSON.stringify({ title: 'Test Task', description: 'Description' }),
                project_id: testProjects.project1.id,
                user_id: testUsers.user.id
            });

            mockDb.run.mockResolvedValue({ changes: 1, success: true });

            const result = await AIActionExecutor.executeAction(actionId);

            expect(result.success).toBe(true);
            expect(result.actionId).toBe(actionId);
        });

        it('should reject execution of non-approved action', async () => {
            const actionId = 'action-123';

            mockDb.get.mockResolvedValue({
                id: actionId,
                status: 'PENDING'
            });

            const result = await AIActionExecutor.executeAction(actionId);

            expect(result.success).toBe(false);
            expect(result.error).toContain('PENDING');
        });
    });

    describe('getAction()', () => {
        it('should return action by ID', async () => {
            const actionId = 'action-123';

            mockDb.get.mockResolvedValue({
                id: actionId,
                status: 'PENDING',
                action_type: 'CREATE_DRAFT_TASK'
            });

            const action = await AIActionExecutor.getAction(actionId);

            expect(action.id).toBe(actionId);
            expect(action.status).toBe('PENDING');
        });

        it('should return null for non-existent action', async () => {
            mockDb.get.mockResolvedValue(null);

            const action = await AIActionExecutor.getAction('non-existent');
            expect(action).toBeNull();
        });
    });

    describe('listActions()', () => {
        it('should return list of actions', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockResolvedValue([
                {
                    id: 'action-1',
                    status: 'PENDING',
                    action_type: 'CREATE_DRAFT_TASK'
                },
                {
                    id: 'action-2',
                    status: 'APPROVED',
                    action_type: 'GENERATE_REPORT'
                }
            ]);

            const actions = await AIActionExecutor.listActions(projectId);

            expect(actions).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([projectId])
            );
        });
    });
});
