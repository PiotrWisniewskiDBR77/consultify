// SCMS Governance Service Tests
// Tests for StatusMachine

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        get: vi.fn((sql, params, callback) => callback(null, null)),
        run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
        all: vi.fn((sql, params, callback) => callback(null, []))
    }
}));

describe('StatusMachine', () => {
    let StatusMachine;

    beforeEach(async () => {
        vi.clearAllMocks();
        StatusMachine = (await import('../../../server/services/statusMachine.js')).default;
    });

    describe('Initiative Status Transitions', () => {
        it('should allow DRAFT to PLANNED transition', () => {
            expect(StatusMachine.canTransitionInitiative('DRAFT', 'PLANNED')).toBe(true);
        });

        it('should allow PLANNED to APPROVED transition', () => {
            expect(StatusMachine.canTransitionInitiative('PLANNED', 'APPROVED')).toBe(true);
        });

        it('should allow APPROVED to IN_EXECUTION transition', () => {
            expect(StatusMachine.canTransitionInitiative('APPROVED', 'IN_EXECUTION')).toBe(true);
        });

        it('should allow IN_EXECUTION to BLOCKED transition', () => {
            expect(StatusMachine.canTransitionInitiative('IN_EXECUTION', 'BLOCKED')).toBe(true);
        });

        it('should allow IN_EXECUTION to COMPLETED transition', () => {
            expect(StatusMachine.canTransitionInitiative('IN_EXECUTION', 'COMPLETED')).toBe(true);
        });

        it('should disallow COMPLETED to DRAFT transition', () => {
            expect(StatusMachine.canTransitionInitiative('COMPLETED', 'DRAFT')).toBe(false);
        });

        it('should disallow invalid status transition', () => {
            expect(StatusMachine.canTransitionInitiative('DRAFT', 'COMPLETED')).toBe(false);
        });
    });

    describe('Task Status Transitions', () => {
        it('should allow TODO to IN_PROGRESS transition', () => {
            expect(StatusMachine.canTransitionTask('TODO', 'IN_PROGRESS')).toBe(true);
        });

        it('should allow IN_PROGRESS to DONE transition', () => {
            expect(StatusMachine.canTransitionTask('IN_PROGRESS', 'DONE')).toBe(true);
        });

        it('should allow IN_PROGRESS to BLOCKED transition', () => {
            expect(StatusMachine.canTransitionTask('IN_PROGRESS', 'BLOCKED')).toBe(true);
        });

        it('should allow BLOCKED to IN_PROGRESS transition', () => {
            expect(StatusMachine.canTransitionTask('BLOCKED', 'IN_PROGRESS')).toBe(true);
        });

        it('should disallow direct DONE to TODO transition', () => {
            expect(StatusMachine.canTransitionTask('DONE', 'TODO')).toBe(false);
        });
    });

    describe('Blocked Status Validation', () => {
        it('should require blocked reason for BLOCKED initiative status', () => {
            const validation = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'BLOCKED', {});
            expect(validation.valid).toBe(false);
            expect(validation.reason).toContain('reason');
        });

        it('should accept blocked reason for BLOCKED status', () => {
            const validation = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'BLOCKED', { blockedReason: 'Waiting for approval' });
            expect(validation.valid).toBe(true);
        });
    });

    describe('Status Constants', () => {
        it('should export INITIATIVE_STATUSES', () => {
            expect(StatusMachine.INITIATIVE_STATUSES).toBeDefined();
            expect(StatusMachine.INITIATIVE_STATUSES.DRAFT).toBe('DRAFT');
        });

        it('should export TASK_STATUSES', () => {
            expect(StatusMachine.TASK_STATUSES).toBeDefined();
            expect(StatusMachine.TASK_STATUSES.TODO).toBe('TODO');
        });

        it('should export DECISION_STATUSES', () => {
            expect(StatusMachine.DECISION_STATUSES).toBeDefined();
            expect(StatusMachine.DECISION_STATUSES.PENDING).toBe('PENDING');
        });
    });
});
