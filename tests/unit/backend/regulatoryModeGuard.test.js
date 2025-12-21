/**
 * Regulatory Mode Guard Tests
 * 
 * CRITICAL SECURITY SERVICE - Must have 95%+ coverage
 * Tests regulatory mode enforcement, action blocking, and compliance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const RegulatoryModeGuard = require('../../../server/services/regulatoryModeGuard.js');

describe('RegulatoryModeGuard', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        // Mock AIAuditLogger
        vi.mock('../../../server/services/aiAuditLogger', () => ({
            default: {
                logInteraction: vi.fn().mockResolvedValue({ success: true })
            }
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isEnabled()', () => {
        it('should return false for null projectId', async () => {
            const result = await RegulatoryModeGuard.isEnabled(null);
            expect(result).toBe(false);
        });

        it('should return true when regulatory mode is enabled', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 1 });
            });

            const result = await RegulatoryModeGuard.isEnabled(projectId);
            
            expect(result).toBe(true);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT regulatory_mode_enabled'),
                [projectId],
                expect.any(Function)
            );
        });

        it('should return false when regulatory mode is disabled', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 0 });
            });

            const result = await RegulatoryModeGuard.isEnabled(projectId);
            
            expect(result).toBe(false);
        });

        it('should default to enabled (fail-safe) when column is null', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: null });
            });

            const result = await RegulatoryModeGuard.isEnabled(projectId);
            
            expect(result).toBe(true);
        });

        it('should default to enabled on database error (fail-safe)', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            const result = await RegulatoryModeGuard.isEnabled(projectId);
            
            expect(result).toBe(true);
        });
    });

    describe('setEnabled()', () => {
        it('should enable regulatory mode', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await RegulatoryModeGuard.setEnabled(projectId, true);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE projects SET regulatory_mode_enabled'),
                [1, projectId],
                expect.any(Function)
            );
        });

        it('should disable regulatory mode', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await RegulatoryModeGuard.setEnabled(projectId, false);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE projects SET regulatory_mode_enabled'),
                [0, projectId],
                expect.any(Function)
            );
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.run.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'));
            });

            await expect(
                RegulatoryModeGuard.setEnabled(projectId, true)
            ).rejects.toThrow('DB Error');
        });
    });

    describe('isActionAllowed()', () => {
        it('should allow EXPLAIN_CONTEXT action', () => {
            const result = RegulatoryModeGuard.isActionAllowed('EXPLAIN_CONTEXT');
            expect(result).toBe(true);
        });

        it('should allow ANALYZE_RISKS action', () => {
            const result = RegulatoryModeGuard.isActionAllowed('ANALYZE_RISKS');
            expect(result).toBe(true);
        });

        it('should block CREATE_DRAFT_TASK action', () => {
            const result = RegulatoryModeGuard.isActionAllowed('CREATE_DRAFT_TASK');
            expect(result).toBe(false);
        });

        it('should block EXECUTE_ACTION action', () => {
            const result = RegulatoryModeGuard.isActionAllowed('EXECUTE_ACTION');
            expect(result).toBe(false);
        });

        it('should block actions with mutation keywords', () => {
            const result = RegulatoryModeGuard.isActionAllowed('CREATE_SOMETHING');
            expect(result).toBe(false);
        });

        it('should allow null/undefined action (fail-safe)', () => {
            const result1 = RegulatoryModeGuard.isActionAllowed(null);
            const result2 = RegulatoryModeGuard.isActionAllowed(undefined);
            expect(result1).toBe(true);
            expect(result2).toBe(true);
        });
    });

    describe('enforceRegulatoryMode()', () => {
        it('should not block when projectId is null', async () => {
            const context = { userId: 'user-1', organizationId: 'org-1' };
            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');
            
            expect(result.blocked).toBe(false);
        });

        it('should not block when regulatory mode is disabled', async () => {
            const projectId = testProjects.project1.id;
            const context = { userId: 'user-1', organizationId: 'org-1', projectId };
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 0 });
            });

            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');
            
            expect(result.blocked).toBe(false);
        });

        it('should block mutation actions when regulatory mode is enabled', async () => {
            const projectId = testProjects.project1.id;
            const context = { userId: 'user-1', organizationId: 'org-1', projectId };
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 1 });
            });

            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');
            
            expect(result.blocked).toBe(true);
            expect(result.reason).toBe('REGULATORY_MODE');
            expect(result.message).toContain('Regulatory Mode is enabled');
        });

        it('should allow EXPLAIN_CONTEXT even when regulatory mode is enabled', async () => {
            const projectId = testProjects.project1.id;
            const context = { userId: 'user-1', organizationId: 'org-1', projectId };
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 1 });
            });

            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'EXPLAIN_CONTEXT');
            
            expect(result.blocked).toBe(false);
        });

        it('should log blocked attempts', async () => {
            const projectId = testProjects.project1.id;
            const context = { userId: 'user-1', organizationId: 'org-1', projectId };
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 1 });
            });

            const AIAuditLogger = await import('../../../server/services/aiAuditLogger.js');
            
            await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');
            
            expect(AIAuditLogger.default.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    actionType: 'AI_ACTION_BLOCKED',
                    actionDescription: expect.stringContaining('Blocked action'),
                    contextSnapshot: expect.objectContaining({
                        attemptedAction: 'CREATE_DRAFT_TASK',
                        reason: 'REGULATORY_MODE'
                    })
                })
            );
        });
    });

    describe('getRegulatoryPrompt()', () => {
        it('should return regulatory mode prompt constraints', () => {
            const prompt = RegulatoryModeGuard.getRegulatoryPrompt();
            
            expect(prompt).toContain('REGULATORY COMPLIANCE MODE');
            expect(prompt).toContain('ABSOLUTE PROHIBITIONS');
            expect(prompt).toContain('REQUIRED BEHAVIOR');
            expect(prompt).toContain('create');
            expect(prompt).toContain('consider');
        });
    });

    describe('getStatus()', () => {
        it('should return status when enabled', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 1 });
            });

            const status = await RegulatoryModeGuard.getStatus(projectId);
            
            expect(status.enabled).toBe(true);
            expect(status.allowedActions).toEqual(RegulatoryModeGuard.ALLOWED_ACTIONS);
            expect(status.blockedActions).toEqual(RegulatoryModeGuard.BLOCKED_ACTIONS);
            expect(status.description).toContain('advisory-only mode');
        });

        it('should return status when disabled', async () => {
            const projectId = testProjects.project1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { regulatory_mode_enabled: 0 });
            });

            const status = await RegulatoryModeGuard.getStatus(projectId);
            
            expect(status.enabled).toBe(false);
            expect(status.description).toContain('normal policy-based');
        });
    });
});

