/**
 * AI Role Guard Unit Tests
 * Tests for AI Roles Model enforcement (ADVISOR < MANAGER < OPERATOR)
 */

const AIRoleGuard = require('../../server/services/aiRoleGuard');

describe('AI Role Guard', () => {
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
                // Mock getProjectRole to return ADVISOR
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('ADVISOR');

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXPLAIN_CONTEXT');
                expect(result.allowed).toBe(true);
                expect(result.role).toBe('ADVISOR');

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });

            it('should block draft creation', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('ADVISOR');

                const result = await AIRoleGuard.canPerformAction('test-project', 'CREATE_DRAFT_TASK');
                expect(result.allowed).toBe(false);
                expect(result.requiredCapability).toBe('canCreateDrafts');

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });

            it('should block execution actions', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('ADVISOR');

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(false);

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });
        });

        describe('MANAGER Role', () => {
            it('should allow draft creation with approval required', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('MANAGER');

                const result = await AIRoleGuard.canPerformAction('test-project', 'CREATE_DRAFT_TASK');
                expect(result.allowed).toBe(true);
                expect(result.requiresApproval).toBe(true);

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });

            it('should block execution actions', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('MANAGER');

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(false);

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });
        });

        describe('OPERATOR Role', () => {
            it('should allow execution actions', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('OPERATOR');

                const result = await AIRoleGuard.canPerformAction('test-project', 'EXECUTE_TASK_UPDATE');
                expect(result.allowed).toBe(true);
                expect(result.requiresApproval).toBe(false);

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });

            it('should allow entity modifications', async () => {
                const originalGetProjectRole = AIRoleGuard.getProjectRole;
                AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('OPERATOR');

                const result = await AIRoleGuard.canPerformAction('test-project', 'UPDATE_ENTITY');
                expect(result.allowed).toBe(true);

                AIRoleGuard.getProjectRole = originalGetProjectRole;
            });
        });
    });

    describe('Mutation Validation', () => {
        it('should block all mutations for ADVISOR', async () => {
            const originalGetProjectRole = AIRoleGuard.getProjectRole;
            AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('ADVISOR');

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('ADVISOR');

            AIRoleGuard.getProjectRole = originalGetProjectRole;
        });

        it('should allow mutations as drafts for MANAGER', async () => {
            const originalGetProjectRole = AIRoleGuard.getProjectRole;
            AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('MANAGER');

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(true);
            expect(result.requiresApproval).toBe(true);

            AIRoleGuard.getProjectRole = originalGetProjectRole;
        });

        it('should allow direct mutations for OPERATOR', async () => {
            const originalGetProjectRole = AIRoleGuard.getProjectRole;
            AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('OPERATOR');

            const result = await AIRoleGuard.validateMutation('test-project', 'create');
            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(false);

            AIRoleGuard.getProjectRole = originalGetProjectRole;
        });
    });

    describe('isActionBlocked', () => {
        it('should return blocked with required role for insufficient permissions', async () => {
            const originalGetProjectRole = AIRoleGuard.getProjectRole;
            AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('ADVISOR');

            const result = await AIRoleGuard.isActionBlocked('test-project', 'CREATE_DRAFT_TASK');
            expect(result.blocked).toBe(true);
            expect(result.currentRole).toBe('ADVISOR');
            expect(result.roleRequired).toBe('MANAGER');
            expect(result.suggestion).toContain('Project Settings');

            AIRoleGuard.getProjectRole = originalGetProjectRole;
        });

        it('should return not blocked for allowed actions', async () => {
            const originalGetProjectRole = AIRoleGuard.getProjectRole;
            AIRoleGuard.getProjectRole = jest.fn().mockResolvedValue('MANAGER');

            const result = await AIRoleGuard.isActionBlocked('test-project', 'CREATE_DRAFT_TASK');
            expect(result.blocked).toBe(false);

            AIRoleGuard.getProjectRole = originalGetProjectRole;
        });
    });
});
