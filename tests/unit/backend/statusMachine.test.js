import { describe, it, expect, vi } from 'vitest';
import StatusMachine from '../../../server/services/statusMachine.js';

describe('StatusMachine', () => {
    describe('canTransitionInitiative', () => {
        it('should allow valid transition', () => {
            const result = StatusMachine.canTransitionInitiative('DRAFT', 'PLANNED');
            expect(result).toBe(true);
        });

        it('should block invalid transition', () => {
            // DRAFT -> IN_EXECUTION is not allowed directly (must be PLANNED -> APPROVED)
            // Checking map: DRAFT -> [PLANNED, CANCELLED]
            const result = StatusMachine.canTransitionInitiative('DRAFT', 'IN_EXECUTION');
            expect(result).toBe(false);
        });
    });

    describe('canTransitionTask', () => {
        it('should allow valid transition', () => {
            const result = StatusMachine.canTransitionTask('TODO', 'IN_PROGRESS');
            expect(result).toBe(true);
        });

        it('should allow flow back', () => {
            const result = StatusMachine.canTransitionTask('IN_PROGRESS', 'TODO');
            expect(result).toBe(true);
        });
    });

    describe('validateInitiativeTransition', () => {
        it('should return valid for simple allowed transition', () => {
            const result = StatusMachine.validateInitiativeTransition('DRAFT', 'PLANNED');
            expect(result.valid).toBe(true);
        });

        it('should require reason for blocking', () => {
            const result = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'BLOCKED');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('requires a reason');
        });

        it('should allow blocking with reason', () => {
            const result = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'BLOCKED', { blockedReason: 'Wait for resources' });
            expect(result.valid).toBe(true);
        });

        it('should prevent completion if pending tasks exist', () => {
            const result = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'COMPLETED', { pendingTasks: 5 });
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('tasks still pending');
        });

        it('should prevent approved state if governance failed', () => {
            const result = StatusMachine.validateInitiativeTransition('PLANNED', 'APPROVED', { requiresApproval: true, isApproved: false });
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Governance approval required');
        });
    });

    describe('validateTaskTransition', () => {
        it('should validate blocker type', () => {
            const result = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', { blockedReason: 'Test' });
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('requires a blocker type');
        });

        it('should pass with full blocking info', () => {
            const result = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', { blockedReason: 'Test', blockerType: 'TECHNICAL' });
            expect(result.valid).toBe(true);
        });
    });
});
