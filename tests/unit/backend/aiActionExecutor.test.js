import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';

// Mock dependencies before importing the service
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

const mockAIPolicyEngine = {
    canPerformAction: vi.fn()
};

const mockAIRoleGuard = {
    isActionBlocked: vi.fn()
};

const mockRegulatoryModeGuard = {
    enforceRegulatoryMode: vi.fn()
};

// Import after mocks
import AIActionExecutor from '../../../server/services/aiActionExecutor.js';

describe('AIActionExecutor', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Inject deterministic dependencies for unit tests
        AIActionExecutor.setDependencies({
            db: mockDb,
            uuidv4: () => 'test-uuid-1234',
            AIPolicyEngine: mockAIPolicyEngine,
            AIRoleGuard: mockAIRoleGuard,
            RegulatoryModeGuard: mockRegulatoryModeGuard
        });

        // Default mock behaviors
        mockRegulatoryModeGuard.enforceRegulatoryMode.mockResolvedValue({ blocked: false });
        mockAIRoleGuard.isActionBlocked.mockResolvedValue({ blocked: false, requiresApproval: false });
        mockAIPolicyEngine.canPerformAction.mockResolvedValue({
            allowed: true,
            requiresApproval: false,
            requiredLevel: 'STANDARD',
            currentLevel: 'STANDARD'
        });

        // Default DB mock
        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb.call({ changes: 1, lastID: 1 }, null);
            }
        });

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, null);
            }
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, []);
            }
        });
    });

    describe('ACTION_TYPES', () => {
        it('should export all action types', () => {
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('CREATE_DRAFT_TASK');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('CREATE_DRAFT_INITIATIVE');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('SUGGEST_ROADMAP_CHANGE');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('GENERATE_REPORT');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('PREPARE_DECISION_SUMMARY');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('EXPLAIN_CONTEXT');
            expect(AIActionExecutor.ACTION_TYPES).toHaveProperty('ANALYZE_RISKS');
        });
    });

    describe('ACTION_STATUS', () => {
        it('should export all action statuses', () => {
            expect(AIActionExecutor.ACTION_STATUS).toHaveProperty('PENDING');
            expect(AIActionExecutor.ACTION_STATUS).toHaveProperty('APPROVED');
            expect(AIActionExecutor.ACTION_STATUS).toHaveProperty('REJECTED');
            expect(AIActionExecutor.ACTION_STATUS).toHaveProperty('EXECUTED');
        });
    });

    describe('requestAction', () => {
        it('should block action when regulatory mode is enabled', async () => {
            mockRegulatoryModeGuard.enforceRegulatoryMode.mockResolvedValue({
                blocked: true,
                message: 'Regulatory Mode active',
                reason: 'Compliance lock'
            });

            const result = await AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.success).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.regulatoryModeEnabled).toBe(true);
        });

        it('should block action when AI role does not permit', async () => {
            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: true,
                reason: 'Role does not permit this action',
                currentRole: 'ADVISOR',
                roleRequired: 'OPERATOR',
                suggestion: 'Change AI role to OPERATOR'
            });

            const result = await AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.success).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.currentRole).toBe('ADVISOR');
        });

        it('should block action when policy does not allow', async () => {
            mockAIPolicyEngine.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Upgrade required'
            });

            const result = await AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1'
            );

            expect(result.success).toBe(false);
            expect(result.requiresUpgrade).toBe(true);
        });

        it('should create action with PENDING status when approval required', async () => {
            mockAIPolicyEngine.canPerformAction.mockResolvedValue({
                allowed: true,
                requiresApproval: true,
                requiredLevel: 'STANDARD',
                currentLevel: 'STANDARD'
            });

            const result = await AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1'
            );

            expect(result.success).toBe(true);
            expect(result.requiresApproval).toBe(true);
            expect(result.status).toBe('PENDING');
        });

        it('should create action with APPROVED status when no approval needed', async () => {
            const result = await AIActionExecutor.requestAction(
                'EXPLAIN_CONTEXT',
                { context: 'Test' },
                'user-1',
                'org-1'
            );

            expect(result.success).toBe(true);
            expect(result.requiresApproval).toBe(false);
            expect(result.status).toBe('APPROVED');
        });

        it('should force approval when AI role is MANAGER', async () => {
            mockAIRoleGuard.isActionBlocked.mockResolvedValue({
                blocked: false,
                requiresApproval: true
            });

            const result = await AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.requiresApproval).toBe(true);
        });

        it('should handle database error', async () => {
            mockDb.run.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(new Error('Database error'));
                }
            });

            await expect(AIActionExecutor.requestAction(
                'CREATE_DRAFT_TASK',
                { title: 'Test' },
                'user-1',
                'org-1'
            )).rejects.toThrow('Database error');
        });
    });

    describe('createDraft', () => {
        it('should create task draft with proper action type', async () => {
            const result = await AIActionExecutor.createDraft(
                'task',
                { title: 'New Task', description: 'Test description' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should create initiative draft with proper action type', async () => {
            const result = await AIActionExecutor.createDraft(
                'initiative',
                { name: 'New Initiative', description: 'Test' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.success).toBe(true);
        });

        it('should store draft content after creation', async () => {
            const result = await AIActionExecutor.createDraft(
                'task',
                { title: 'Test Task' },
                'user-1',
                'org-1',
                'project-1'
            );

            expect(result.success).toBe(true);
            // Second db.run call should update draft_content
            expect(mockDb.run).toHaveBeenCalledTimes(2);
        });
    });

    describe('approveAction', () => {
        it('should approve pending action', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 1 }, null);
                }
            });

            const result = await AIActionExecutor.approveAction('action-1', 'approver-1');

            expect(result.success).toBe(true);
            expect(result.status).toBe('APPROVED');
        });

        it('should fail when action not found or already processed', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 0 }, null);
                }
            });

            const result = await AIActionExecutor.approveAction('action-1', 'approver-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found or already processed');
        });

        it('should handle database error', async () => {
            mockDb.run.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(new Error('DB error'));
                }
            });

            await expect(AIActionExecutor.approveAction('action-1', 'user-1'))
                .rejects.toThrow('DB error');
        });
    });

    describe('rejectAction', () => {
        it('should reject pending action', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 1 }, null);
                }
            });

            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { organization_id: 'org-1', project_id: 'proj-1', action_type: 'CREATE_DRAFT_TASK' });
                }
            });

            const result = await AIActionExecutor.rejectAction('action-1', 'user-1', 'Not needed');

            expect(result.success).toBe(true);
            expect(result.status).toBe('REJECTED');
        });

        it('should fail when action not found', async () => {
            mockDb.run.mockImplementation(function (...args) {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb.call({ changes: 0 }, null);
                }
            });

            const result = await AIActionExecutor.rejectAction('action-1', 'user-1');

            expect(result.success).toBe(false);
        });
    });

    describe('executeAction', () => {
        it('should return error when action not found', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, null);
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Action not found');
        });

        it('should return error when action is not APPROVED', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { id: 'action-1', status: 'PENDING' });
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(false);
            expect(result.error).toContain('PENDING, not APPROVED');
        });

        it('should execute CREATE_DRAFT_TASK action', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        id: 'action-1',
                        status: 'APPROVED',
                        action_type: 'CREATE_DRAFT_TASK',
                        project_id: 'proj-1',
                        user_id: 'user-1',
                        payload: '{}',
                        draft_content: JSON.stringify({
                            title: 'Test Task',
                            description: 'Desc',
                            assigneeId: 'user-2',
                            dueDate: '2024-12-31'
                        })
                    });
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(true);
            expect(result.result.taskId).toBeDefined();
            expect(result.result.created).toBe(true);
        });

        it('should execute CREATE_DRAFT_INITIATIVE action', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        id: 'action-1',
                        status: 'APPROVED',
                        action_type: 'CREATE_DRAFT_INITIATIVE',
                        project_id: 'proj-1',
                        user_id: 'user-1',
                        payload: '{}',
                        draft_content: JSON.stringify({
                            name: 'Test Initiative',
                            description: 'Desc',
                            ownerId: 'user-2',
                            priority: 'HIGH'
                        })
                    });
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(true);
            expect(result.result.initiativeId).toBeDefined();
            expect(result.result.created).toBe(true);
        });

        it('should execute GENERATE_REPORT action', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        id: 'action-1',
                        status: 'APPROVED',
                        action_type: 'GENERATE_REPORT',
                        payload: '{}',
                        draft_content: JSON.stringify({ reportData: 'data' })
                    });
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(true);
            expect(result.result.reportGenerated).toBe(true);
        });

        it('should handle default action type', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        id: 'action-1',
                        status: 'APPROVED',
                        action_type: 'EXPLAIN_CONTEXT',
                        payload: '{}'
                    });
                }
            });

            const result = await AIActionExecutor.executeAction('action-1', 'user-1');

            expect(result.success).toBe(true);
            expect(result.result.executed).toBe(true);
        });
    });

    describe('getPendingActions', () => {
        it('should return empty array when no pending actions', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, []);
                }
            });

            const result = await AIActionExecutor.getPendingActions('user-1');

            expect(result).toEqual([]);
        });

        it('should return parsed pending actions', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        {
                            id: 'action-1',
                            payload: JSON.stringify({ title: 'Test' }),
                            draft_content: JSON.stringify({ content: 'Draft' })
                        }
                    ]);
                }
            });

            const result = await AIActionExecutor.getPendingActions('user-1');

            expect(result).toHaveLength(1);
            expect(result[0].payload.title).toBe('Test');
            expect(result[0].draftContent.content).toBe('Draft');
        });

        it('should filter by projectId and organizationId', async () => {
            await AIActionExecutor.getPendingActions('user-1', 'project-1', 'org-1');

            const callArgs = mockDb.all.mock.calls[0];
            expect(callArgs[0]).toContain('user_id');
            expect(callArgs[0]).toContain('project_id');
            expect(callArgs[0]).toContain('organization_id');
        });

        it('should handle malformed JSON gracefully', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        {
                            id: 'action-1',
                            payload: 'not-json',
                            draft_content: null
                        }
                    ]);
                }
            });

            // Should not throw
            const result = await AIActionExecutor.getPendingActions();
            expect(result).toHaveLength(1);
        });
    });

    describe('_logAudit', () => {
        it('should create audit log entry', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        organization_id: 'org-1',
                        project_id: 'proj-1',
                        action_type: 'CREATE_DRAFT_TASK',
                        current_policy_level: 'STANDARD'
                    });
                }
            });

            const result = await AIActionExecutor._logAudit('action-1', 'user-1', 'APPROVED');

            expect(result.auditId).toBeDefined();
            expect(mockDb.run).toHaveBeenCalled();
        });
    });
});
