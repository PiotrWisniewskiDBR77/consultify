import { describe, it, expect, vi } from 'vitest';
import StatusMachine from '../../../server/src/services/statusMachine.js';

describe('StatusMachine', () => {
  describe('canTransitionInitiative', () => {
    it('should allow valid transition', () => {
      // DRAFT -> PENDING_REVIEW is the correct first transition now
      const result = StatusMachine.canTransitionInitiative(
        StatusMachine.INITIATIVE_STATUSES.DRAFT,
        StatusMachine.INITIATIVE_STATUSES.PENDING_REVIEW
      );
      expect(result).toBe(true);
    });

    it('should block invalid transition', () => {
      // DRAFT -> EXECUTING is not allowed directly
      const result = StatusMachine.canTransitionInitiative(
        StatusMachine.INITIATIVE_STATUSES.DRAFT,
        StatusMachine.INITIATIVE_STATUSES.EXECUTING
      );
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
      // Updated to valid canonical transition
      const result = StatusMachine.validateInitiativeTransition('DRAFT', 'PENDING_REVIEW');
      expect(result.valid).toBe(true);
    });

    it('should require reason for blocking', () => {
      // Updated: EXECUTING is the new name for IN_EXECUTION
      const result = StatusMachine.validateInitiativeTransition('EXECUTING', 'BLOCKED');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('requires a reason');
    });

    it('should allow blocking with reason', () => {
      const result = StatusMachine.validateInitiativeTransition('EXECUTING', 'BLOCKED', {
        blockedReason: 'Wait for resources',
      });
      expect(result.valid).toBe(true);
    });

    it('should prevent completion if pending tasks exist', () => {
      // Updated: DONE is the new name for COMPLETED
      const result = StatusMachine.validateInitiativeTransition('EXECUTING', 'DONE', {
        pendingTasks: 5,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tasks still pending');
    });

    it('should prevent approved state if governance failed', () => {
      // Canonical transition: PLANNING -> APPROVED requires governance approval
      const result = StatusMachine.validateInitiativeTransition('PLANNING', 'APPROVED', {
        requiresApproval: true,
        isApproved: false,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Governance approval required');
    });
  });

  describe('validateTaskTransition', () => {
    it('should validate blocker type', () => {
      const result = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {
        blockedReason: 'Test',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('requires a blocker type');
    });

    it('should pass with full blocking info', () => {
      const result = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {
        blockedReason: 'Test',
        blockerType: 'TECHNICAL',
      });
      expect(result.valid).toBe(true);
    });
  });
});
