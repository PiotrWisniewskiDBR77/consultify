import { describe, it, expect, vi, beforeEach } from 'vitest';
import AIRoleGuard from '../../../server/src/services/aiRoleGuard.js';

describe('AI Role Guard', () => {
    const mockDb = {
        get: vi.fn(),
        run: vi.fn(),
        all: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        AIRoleGuard.setDependencies({
            db: mockDb
        });
    });

    describe('Role Definitions', () => {
        it('should define three roles in correct hierarchy', () => {
            expect(AIRoleGuard.AI_PROJECT_ROLES.ADVISOR).toBe('ADVISOR');
            expect(AIRoleGuard.AI_PROJECT_ROLES.MANAGER).toBe('MANAGER');
            expect(AIRoleGuard.AI_PROJECT_ROLES.OPERATOR).toBe('OPERATOR');

            expect(AIRoleGuard.ROLE_HIERARCHY).toEqual(['ADVISOR', 'MANAGER', 'OPERATOR']);
        });

        it('should define capabilities for each role', () => {
            const advisorCaps = AIRoleGuard.getRoleCapabilities('ADVISOR');
            expect(advisorCaps.canExplain).toBe(true);
            expect(advisorCaps.canCreateDrafts).toBe(false);
            expect(advisorCaps.canExecuteActions).toBe(false);
            expect(advisorCaps.canModifyEntities).toBe(false);

            const managerCaps = AIRoleGuard.getRoleCapabilities('MANAGER');
            expect(managerCaps.canExplain).toBe(true);
            expect(managerCaps.canCreateDrafts).toBe(true);
            expect(managerCaps.canExecuteActions).toBe(false);
            expect(managerCaps.requiresApproval).toBe(true);

            const operatorCaps = AIRoleGuard.getRoleCapabilities('OPERATOR');
            expect(operatorCaps.canExplain).toBe(true);
            expect(operatorCaps.canCreateDrafts).toBe(true);
            expect(operatorCaps.canExecuteActions).toBe(true);
            expect(operatorCaps.canModifyEntities).toBe(true);
        });
    });

    describe('Role Descriptions', () => {
        it('should return correct description for each role', () => {
            expect(AIRoleGuard.getRoleDescription('ADVISOR')).toContain('explains');
            expect(AIRoleGuard.getRoleDescription('MANAGER')).toContain('drafts');
            expect(AIRoleGuard.getRoleDescription('OPERATOR')).toContain('executes');
        });

        it('should default to ADVISOR description for unknown role', () => {
            expect(AIRoleGuard.getRoleDescription('UNKNOWN')).toContain('explains');
        });
    });

    describe('Action Capability Checks', () => {
        describe('ADVISOR Role', () => {
            it('should allow explain actions', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'ADVISOR' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXPLAIN_CONTEXT');
                expect(result.allowed).toBe(true);
                expect(result.role).toBe('ADVISOR');
            });

            it('should block draft creation', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'ADVISOR' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'CREATE_DRAFT_TASK');
                expect(result.allowed).toBe(false);
                expect(result.requiredCapability).toBe('canCreateDrafts');
            });

            it('should block execution actions', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'ADVISOR' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(false);
            });
        });

        describe('MANAGER Role', () => {
            it('should allow draft creation with approval required', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'MANAGER' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'CREATE_DRAFT_TASK');
                expect(result.allowed).toBe(true);
                expect(result.requiresApproval).toBe(true);
            });

            it('should block execution actions', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'MANAGER' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(false);
            });
        });

        describe('OPERATOR Role', () => {
            it('should allow execution actions', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'OPERATOR' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(true);
                expect(result.requiresApproval).toBe(false);
            });

            it('should allow entity modifications', async () => {
                mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'OPERATOR' }));

                const result = await AIRoleGuard.canPerformAction('test-project', 'UPDATE_ENTITY');
                expect(result.allowed).toBe(true);
            });
        });
    });

    describe('Mutation Validation', () => {
        it('should block all mutations for ADVISOR', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'ADVISOR' }));

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ADVISOR');
        });

        it('should allow mutations as drafts for MANAGER', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'MANAGER' }));

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(true);
            expect(result.requiresApproval).toBe(true);
        });

        it('should allow direct mutations for OPERATOR', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'OPERATOR' }));

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(false);
        });
    });

    describe('isActionBlocked', () => {
        it('should return blocked with required role for insufficient permissions', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'ADVISOR' }));

            const result = await AIRoleGuard.isActionBlocked('test-project', 'CREATE_DRAFT_TASK');
            expect(result.blocked).toBe(true);
            expect(result.currentRole).toBe('ADVISOR');
            expect(result.roleRequired).toBe('MANAGER');
            expect(result.suggestion).toContain('Project Settings');
        });

        it('should return not blocked for allowed actions', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { ai_role: 'MANAGER' }));

            const result = await AIRoleGuard.isActionBlocked('test-project', 'CREATE_DRAFT_TASK');
            expect(result.blocked).toBe(false);
        });
    });
});
