/**
 * AI Action Executor Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests AI action execution, approval workflow, and governance integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AIActionExecutor', () => {
    let mockDb;
    let mockRegulatoryModeGuard;
    let mockAIRoleGuard;
    let mockAIPolicyEngine;
    let AIActionExecutor;

    beforeEach(() => {
        vi.resetModules();
        
        mockDb = createMockDb();
        
        // Create mocks for dependencies
        mockRegulatoryModeGuard = {
            enforceRegulatoryMode: vi.fn().mockResolvedValue({ blocked: false })
        };
        
        mockAIRoleGuard = {
            isActionBlocked: vi.fn().mockResolvedValue({ blocked: false, requiresApproval: false })
        };
        
        mockAIPolicyEngine = {
            canPerformAction: vi.fn().mockResolvedValue({ allowed: true })
        };

        // Mock dependencies before importing
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));
        
        // Import service
        AIActionExecutor = require('../../../server/services/aiActionExecutor.js');
        
        // Inject dependencies
        AIActionExecutor.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            RegulatoryModeGuard: mockRegulatoryModeGuard,
            AIRoleGuard: mockAIRoleGuard,
            AIPolicyEngine: mockAIPolicyEngine
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('requestAction()', () => {
        it('should create action request successfully', async () => {
            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(true);
            // When no approval required, status is APPROVED directly
            expect(result.status).toBe(AIActionExecutor.ACTION_STATUS.APPROVED);
            expect(mockDb.run).toHaveBeenCalled();
        });
        
        it('should create pending action when approval required', async () => {
            // Mock AIRoleGuard to require approval
            mockAIRoleGuard.isActionBlocked.mockResolvedValue({ 
                blocked: false, 
                requiresApproval: true 
            });

            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const result = await AIActionExecutor.requestAction(
                actionType,
                payload,
                userId,
                orgId,
                projectId
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe(AIActionExecutor.ACTION_STATUS.PENDING);
            expect(result.requiresApproval).toBe(true);
        });

        it('should block action when regulatory mode is enabled', async () => {
            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
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
            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
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
            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
            const payload = { title: 'Test Task' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: false,
                requiresApproval: true
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1, lastID: 1 }, null);
            });

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
            const actionType = AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK;
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
            const actionType = AIActionExecutor.ACTION_TYPES.EXPLAIN_CONTEXT;
            const payload = { context: 'test' };
            const userId = testUsers.user.id;
            const orgId = testOrganizations.org1.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1, lastID: 1 }, null);
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: actionId,
                    status: AIActionExecutor.ACTION_STATUS.PENDING,
                    action_type: AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK,
                    payload: JSON.stringify({ title: 'Test Task' })
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIActionExecutor.approveAction(actionId, userId);

            expect(result.success).toBe(true);
            expect(result.status).toBe(AIActionExecutor.ACTION_STATUS.APPROVED);
        });

        it('should reject approval for non-pending action', async () => {
            const actionId = 'action-123';
            const userId = testUsers.admin.id;

            // Mock that no rows are updated (action not in PENDING status)
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

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

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: actionId,
                    status: AIActionExecutor.ACTION_STATUS.PENDING
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIActionExecutor.rejectAction(actionId, userId, reason);

            expect(result.success).toBe(true);
            expect(result.status).toBe(AIActionExecutor.ACTION_STATUS.REJECTED);
        });
    });

    describe('executeAction()', () => {
        it('should execute approved action', async () => {
            const actionId = 'action-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: actionId,
                    status: AIActionExecutor.ACTION_STATUS.APPROVED,
                    action_type: AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK,
                    payload: JSON.stringify({ title: 'Test Task' }),
                    draft_content: JSON.stringify({ title: 'Test Task', description: 'Description' }),
                    project_id: testProjects.project1.id,
                    user_id: testUsers.user.id
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIActionExecutor.executeAction(actionId);

            expect(result.success).toBe(true);
            expect(result.actionId).toBe(actionId);
        });

        it('should reject execution of non-approved action', async () => {
            const actionId = 'action-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: actionId,
                    status: AIActionExecutor.ACTION_STATUS.PENDING
                });
            });

            const result = await AIActionExecutor.executeAction(actionId);
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('PENDING');
        });
    });

    describe('getAction()', () => {
        it('should return action by ID', async () => {
            const actionId = 'action-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: actionId,
                    status: AIActionExecutor.ACTION_STATUS.PENDING,
                    action_type: AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK
                });
            });

            const action = await AIActionExecutor.getAction(actionId);

            expect(action.id).toBe(actionId);
            expect(action.status).toBe(AIActionExecutor.ACTION_STATUS.PENDING);
        });

        it('should return null for non-existent action', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const action = await AIActionExecutor.getAction('non-existent');
            expect(action).toBeNull();
        });
    });

    describe('listActions()', () => {
        it('should return list of actions', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'action-1',
                        status: AIActionExecutor.ACTION_STATUS.PENDING,
                        action_type: AIActionExecutor.ACTION_TYPES.CREATE_DRAFT_TASK
                    },
                    {
                        id: 'action-2',
                        status: AIActionExecutor.ACTION_STATUS.APPROVED,
                        action_type: AIActionExecutor.ACTION_TYPES.GENERATE_REPORT
                    }
                ]);
            });

            const actions = await AIActionExecutor.listActions(projectId);

            expect(actions).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([projectId]),
                expect.any(Function)
            );
        });
    });
});
