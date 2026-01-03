/**
 * Regulatory Mode Guard Unit Tests
 * Tests for strict compliance mode enforcement
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import RegulatoryModeGuard from '../../../server/services/regulatoryModeGuard.js';

describe('Regulatory Mode Guard', () => {
    const mockDb = {
        get: vi.fn(),
        run: vi.fn(),
        all: vi.fn()
    };

    const mockAIAuditLogger = {
        logInteraction: vi.fn().mockResolvedValue({ id: 'audit-1' })
    };

    beforeEach(() => {
        vi.clearAllMocks();
        RegulatoryModeGuard.setDependencies({
            db: mockDb,
            AIAuditLogger: mockAIAuditLogger
        });
    });

    describe('Action Classification', () => {
        describe('ALLOWED_ACTIONS', () => {
            it('should include all advisory-only actions', () => {
                expect(RegulatoryModeGuard.ALLOWED_ACTIONS).toContain('EXPLAIN_CONTEXT');
                expect(RegulatoryModeGuard.ALLOWED_ACTIONS).toContain('ANALYZE_RISKS');
                expect(RegulatoryModeGuard.ALLOWED_ACTIONS).toContain('EDUCATE');
                expect(RegulatoryModeGuard.ALLOWED_ACTIONS).toContain('WARN');
                expect(RegulatoryModeGuard.ALLOWED_ACTIONS).toContain('DESCRIBE');
            });
        });

        describe('BLOCKED_ACTIONS', () => {
            it('should include all mutation actions', () => {
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('CREATE_DRAFT_TASK');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('CREATE_DRAFT_INITIATIVE');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('SUGGEST_ROADMAP_CHANGE');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('EXECUTE_ACTION');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('UPDATE_STATUS');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('MODIFY_ENTITY');
                expect(RegulatoryModeGuard.BLOCKED_ACTIONS).toContain('DELETE_ENTITY');
            });
        });
    });

    describe('isActionAllowed', () => {
        it('should allow EXPLAIN_CONTEXT in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('EXPLAIN_CONTEXT')).toBe(true);
        });

        it('should allow ANALYZE_RISKS in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('ANALYZE_RISKS')).toBe(true);
        });

        it('should allow EDUCATE in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('EDUCATE')).toBe(true);
        });

        it('should BLOCK CREATE_DRAFT_TASK in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('CREATE_DRAFT_TASK')).toBe(false);
        });

        it('should BLOCK CREATE_DRAFT_INITIATIVE in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('CREATE_DRAFT_INITIATIVE')).toBe(false);
        });

        it('should BLOCK UPDATE_STATUS in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('UPDATE_STATUS')).toBe(false);
        });

        it('should BLOCK EXECUTE_ACTION in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('EXECUTE_ACTION')).toBe(false);
        });

        it('should BLOCK MODIFY_ENTITY in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('MODIFY_ENTITY')).toBe(false);
        });

        it('should BLOCK DELETE_ENTITY in regulatory mode', () => {
            expect(RegulatoryModeGuard.isActionAllowed('DELETE_ENTITY')).toBe(false);
        });

        it('should block actions containing mutation keywords', () => {
            expect(RegulatoryModeGuard.isActionAllowed('create_something')).toBe(false);
            expect(RegulatoryModeGuard.isActionAllowed('update_record')).toBe(false);
            expect(RegulatoryModeGuard.isActionAllowed('delete_item')).toBe(false);
            expect(RegulatoryModeGuard.isActionAllowed('execute_command')).toBe(false);
            expect(RegulatoryModeGuard.isActionAllowed('modify_data')).toBe(false);
        });

        it('should allow actions without mutation keywords', () => {
            expect(RegulatoryModeGuard.isActionAllowed('view_data')).toBe(true);
            expect(RegulatoryModeGuard.isActionAllowed('read_record')).toBe(true);
            expect(RegulatoryModeGuard.isActionAllowed('list_items')).toBe(true);
        });

        it('should handle null/undefined action gracefully', () => {
            expect(RegulatoryModeGuard.isActionAllowed(null)).toBe(true);
            expect(RegulatoryModeGuard.isActionAllowed(undefined)).toBe(true);
        });
    });

    describe('Regulatory Mode Prompt', () => {
        it('should contain prohibition statements', () => {
            const prompt = RegulatoryModeGuard.getRegulatoryPrompt();
            expect(prompt).toContain('COMPLIANCE MODE');
            expect(prompt).toContain('PROHIBITIONS');
            expect(prompt).toContain('Do NOT');
        });

        it('should forbid action verbs', () => {
            const prompt = RegulatoryModeGuard.getRegulatoryPrompt();
            expect(prompt).toContain('create');
            expect(prompt).toContain('execute');
            expect(prompt).toContain('update');
            expect(prompt).toContain('delete');
        });

        it('should require advisory language', () => {
            const prompt = RegulatoryModeGuard.getRegulatoryPrompt();
            expect(prompt).toContain('consider');
            expect(prompt).toContain('may want to');
            expect(prompt).toContain('recommend');
        });
    });

    describe('enforceRegulatoryMode', () => {
        it('should block CREATE_DRAFT_TASK when regulatory mode is enabled', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { regulatory_mode_enabled: 1 }));

            const context = { userId: 'user1', organizationId: 'org1', projectId: 'project1' };
            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');

            expect(result.blocked).toBe(true);
            expect(mockAIAuditLogger.logInteraction).toHaveBeenCalled();
        });

        it('should NOT block actions when regulatory mode is disabled', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { regulatory_mode_enabled: 0 }));

            const context = { userId: 'user1', organizationId: 'org1', projectId: 'project1' };
            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');

            expect(result.blocked).toBe(false);
        });

        it('should NOT block when no projectId is provided', async () => {
            const context = { userId: 'user1', organizationId: 'org1' };
            const result = await RegulatoryModeGuard.enforceRegulatoryMode(context, 'CREATE_DRAFT_TASK');

            expect(result.blocked).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return full status object when enabled', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { regulatory_mode_enabled: 1 }));

            const status = await RegulatoryModeGuard.getStatus('project1');

            expect(status.enabled).toBe(true);
            expect(status.description).toContain('advisory-only');
        });

        it('should return full status object when disabled', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { regulatory_mode_enabled: 0 }));

            const status = await RegulatoryModeGuard.getStatus('project1');

            expect(status.enabled).toBe(false);
            expect(status.description).toContain('normal');
        });
    });

    describe('Fail-Safe Behavior', () => {
        it('should default to blocking when database error occurs', async () => {
            mockDb.get.mockImplementation((sql, params, cb) => cb(new Error('DB Error')));

            const isEnabled = await RegulatoryModeGuard.isEnabled('proj-1');
            expect(isEnabled).toBe(true); // Fail-safe: secure by default
        });
    });
});
