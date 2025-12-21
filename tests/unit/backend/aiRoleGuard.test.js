/**
 * AI Role Guard Tests
 * 
 * CRITICAL SECURITY SERVICE - Must have 95%+ coverage
 * Tests AI role enforcement, action blocking, and mutation validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const AIRoleGuard = require('../../../server/services/aiRoleGuard.js');

describe('AIRoleGuard', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getProjectRole()', () => {
        it('should return ADVISOR as default for null projectId', async () => {
            const role = await AIRoleGuard.getProjectRole(null);
            expect(role).toBe('ADVISOR');
        });

        it('should return project AI role from database', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const role = await AIRoleGuard.getProjectRole(projectId);
            
            expect(role).toBe('MANAGER');
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT ai_role FROM projects'),
                [projectId],
                expect.any(Function)
            );
        });

        it('should default to ADVISOR when project not found', async () => {
            const projectId = 'non-existent';
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const role = await AIRoleGuard.getProjectRole(projectId);
            
            expect(role).toBe('ADVISOR');
        });

        it('should default to ADVISOR on database error', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            const role = await AIRoleGuard.getProjectRole(projectId);
            
            expect(role).toBe('ADVISOR');
        });
    });

    describe('setProjectRole()', () => {
        it('should set project AI role', async () => {
            const projectId = testProjects.project1.id;
            const newRole = 'OPERATOR';
            const userId = 'user-123';

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIRoleGuard.setProjectRole(projectId, newRole, userId);

            expect(result.updated).toBe(true);
            expect(result.projectId).toBe(projectId);
            expect(result.role).toBe(newRole);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE projects SET ai_role'),
                [newRole, projectId],
                expect.any(Function)
            );
        });

        it('should reject invalid role', async () => {
            const projectId = testProjects.project1.id;

            await expect(
                AIRoleGuard.setProjectRole(projectId, 'INVALID_ROLE', 'user-123')
            ).rejects.toThrow('Invalid AI role');
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'));
            });

            await expect(
                AIRoleGuard.setProjectRole(projectId, 'MANAGER', 'user-123')
            ).rejects.toThrow('DB Error');
        });
    });

    describe('canPerformAction()', () => {
        it('should allow EXPLAIN_CONTEXT for ADVISOR', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'ADVISOR' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'EXPLAIN_CONTEXT');

            expect(result.allowed).toBe(true);
            expect(result.role).toBe('ADVISOR');
        });

        it('should block CREATE_DRAFT_TASK for ADVISOR', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'ADVISOR' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'CREATE_DRAFT_TASK');

            expect(result.allowed).toBe(false);
            expect(result.role).toBe('ADVISOR');
            expect(result.reason).toContain('canCreateDrafts');
        });

        it('should allow CREATE_DRAFT_TASK for MANAGER', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'CREATE_DRAFT_TASK');

            expect(result.allowed).toBe(true);
            expect(result.requiresApproval).toBe(true);
            expect(result.role).toBe('MANAGER');
        });

        it('should allow EXECUTE_TASK_UPDATE for OPERATOR', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'OPERATOR' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'EXECUTE_TASK_UPDATE');

            expect(result.allowed).toBe(true);
            expect(result.requiresApproval).toBe(false);
            expect(result.role).toBe('OPERATOR');
        });

        it('should block EXECUTE_TASK_UPDATE for MANAGER', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'EXECUTE_TASK_UPDATE');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('canExecuteActions');
        });

        it('should allow unknown action types (default allow)', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'ADVISOR' });
            });

            const result = await AIRoleGuard.canPerformAction(projectId, 'UNKNOWN_ACTION');

            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('Action type not restricted');
        });
    });

    describe('isActionBlocked()', () => {
        it('should return blocked=false for allowed actions', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const result = await AIRoleGuard.isActionBlocked(projectId, 'CREATE_DRAFT_TASK');

            expect(result.blocked).toBe(false);
            expect(result.requiresApproval).toBe(true);
        });

        it('should return blocked=true with details for blocked actions', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'ADVISOR' });
            });

            const result = await AIRoleGuard.isActionBlocked(projectId, 'CREATE_DRAFT_TASK');

            expect(result.blocked).toBe(true);
            expect(result.currentRole).toBe('ADVISOR');
            expect(result.roleRequired).toBe('MANAGER');
            expect(result.reason).toContain('requires MANAGER role');
            expect(result.suggestion).toBeDefined();
        });
    });

    describe('validateMutation()', () => {
        it('should block all mutations for ADVISOR', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'ADVISOR' });
            });

            const result = await AIRoleGuard.validateMutation(projectId, 'create');

            expect(result.allowed).toBe(false);
            expect(result.asDraft).toBe(false);
            expect(result.reason).toContain('ADVISOR mode');
        });

        it('should allow mutations as drafts for MANAGER', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const result = await AIRoleGuard.validateMutation(projectId, 'create');

            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(true);
            expect(result.requiresApproval).toBe(true);
            expect(result.reason).toContain('MANAGER mode');
        });

        it('should allow mutations for OPERATOR', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'OPERATOR' });
            });

            const result = await AIRoleGuard.validateMutation(projectId, 'update');

            expect(result.allowed).toBe(true);
            expect(result.asDraft).toBe(false);
            expect(result.requiresApproval).toBe(false);
            expect(result.reason).toContain('OPERATOR mode');
        });

        it('should fail-safe to ADVISOR for unknown role', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'UNKNOWN' });
            });

            const result = await AIRoleGuard.validateMutation(projectId, 'create');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Unknown AI role');
        });
    });

    describe('getRoleCapabilities()', () => {
        it('should return capabilities for ADVISOR', () => {
            const caps = AIRoleGuard.getRoleCapabilities('ADVISOR');
            expect(caps.canExplain).toBe(true);
            expect(caps.canCreateDrafts).toBe(false);
            expect(caps.canExecuteActions).toBe(false);
        });

        it('should return capabilities for MANAGER', () => {
            const caps = AIRoleGuard.getRoleCapabilities('MANAGER');
            expect(caps.canCreateDrafts).toBe(true);
            expect(caps.requiresApproval).toBe(true);
            expect(caps.canExecuteActions).toBe(false);
        });

        it('should return capabilities for OPERATOR', () => {
            const caps = AIRoleGuard.getRoleCapabilities('OPERATOR');
            expect(caps.canExecuteActions).toBe(true);
            expect(caps.canModifyEntities).toBe(true);
            expect(caps.requiresApproval).toBe(false);
        });

        it('should default to ADVISOR for unknown role', () => {
            const caps = AIRoleGuard.getRoleCapabilities('UNKNOWN');
            expect(caps.canExplain).toBe(true);
            expect(caps.canCreateDrafts).toBe(false);
        });
    });

    describe('getRoleConfig()', () => {
        it('should return full role configuration', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { ai_role: 'MANAGER' });
            });

            const config = await AIRoleGuard.getRoleConfig(projectId);

            expect(config.activeRole).toBe('MANAGER');
            expect(config.capabilities).toBeDefined();
            expect(config.roleDescription).toBeDefined();
            expect(config.roleHierarchy).toEqual(['ADVISOR', 'MANAGER', 'OPERATOR']);
            expect(config.roleIndex).toBe(1);
        });
    });
});
