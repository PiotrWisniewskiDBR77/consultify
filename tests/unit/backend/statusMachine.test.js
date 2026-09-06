import { describe, it, expect, vi } from 'vitest';
import StatusMachine from '../../../server/src/services/statusMachine.js';

describe('StatusMachine', () => {
  describe('canTransitionInitiative', () => {
    it('should allow valid transition', () => {
      // DEC-424: DRAFT -> PENDING_APPROVAL to pierwsze przejście cyklu życia
      const result = StatusMachine.canTransitionInitiative(
        StatusMachine.INITIATIVE_STATUSES.DRAFT,
        StatusMachine.INITIATIVE_STATUSES.PENDING_APPROVAL
      );
      expect(result).toBe(true);
    });

    it('should block invalid transition', () => {
      // DRAFT -> IN_EXECUTION nie jest przejściem bezpośrednim
      const result = StatusMachine.canTransitionInitiative(
        StatusMachine.INITIATIVE_STATUSES.DRAFT,
        StatusMachine.INITIATIVE_STATUSES.IN_EXECUTION
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
      const result = StatusMachine.validateInitiativeTransition('DRAFT', 'PENDING_APPROVAL');
      expect(result.valid).toBe(true);
    });

    it('should require reason for rejection', () => {
      // DEC-424: BLOCKED to flaga on_hold, nie status. REJECTED wymaga powodu.
      const result = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'REJECTED');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('requires a reason');
    });

    it('should allow rejection with reason', () => {
      const result = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'REJECTED', {
        reason: 'Wait for resources',
      });
      expect(result.valid).toBe(true);
    });

    it('should prevent completion if pending tasks exist', () => {
      // Wejścia w starym słowniku (EXECUTING/DONE) są normalizowane.
      const result = StatusMachine.validateInitiativeTransition('EXECUTING', 'DONE', {
        pendingTasks: 5,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tasks still pending');
    });

    it('should prevent approved state if governance failed', () => {
      const result = StatusMachine.validateInitiativeTransition('PENDING_APPROVAL', 'APPROVED', {
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
