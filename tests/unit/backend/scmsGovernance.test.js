// SCMS Governance Service Tests
// Tests for StatusMachine - Updated to new status names

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
  default: {
    get: vi.fn((sql, params, callback) => callback(null, null)),
    run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
    all: vi.fn((sql, params, callback) => callback(null, [])),
  },
}));

describe('StatusMachine', () => {
  let StatusMachine;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../../server/src/services/statusMachine.js');
    StatusMachine = mod.default;
    const { InitiativeStatus } =
      await import('../../../server/src/constants/initiativeStatuses.js');

    // Add to scope for tests
    global.IS = InitiativeStatus;
  });

  describe('Initiative Status Transitions', () => {
    it('should allow DRAFT to PENDING_REVIEW transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.DRAFT, global.IS.PENDING_REVIEW)).toBe(
        true
      );
    });

    it('should allow PENDING_REVIEW to REVIEW transition', () => {
      expect(
        StatusMachine.canTransitionInitiative(global.IS.PENDING_REVIEW, global.IS.REVIEW)
      ).toBe(true);
    });

    it('should allow REVIEW to PROMOTED transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.REVIEW, global.IS.PROMOTED)).toBe(
        true
      );
    });

    it('should allow PROMOTED to PLANNING transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.PROMOTED, global.IS.PLANNING)).toBe(
        true
      );
    });

    it('should allow PLANNING to APPROVED transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.PLANNING, global.IS.APPROVED)).toBe(
        true
      );
    });

    it('should allow APPROVED to SCHEDULED transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.APPROVED, global.IS.SCHEDULED)).toBe(
        true
      );
    });

    it('should allow EXECUTING to BLOCKED transition', () => {
      // Updated from IN_EXECUTION to EXECUTING
      expect(StatusMachine.canTransitionInitiative('EXECUTING', 'BLOCKED')).toBe(true);
    });

    it('should allow EXECUTING to DONE transition', () => {
      // Updated from COMPLETED to DONE
      expect(StatusMachine.canTransitionInitiative('EXECUTING', 'DONE')).toBe(true);
    });

    it('should disallow DONE to DRAFT transition', () => {
      // Updated from COMPLETED to DONE
      expect(StatusMachine.canTransitionInitiative('DONE', 'DRAFT')).toBe(false);
    });

    it('should disallow invalid status transition', () => {
      // DRAFT -> DONE is not a valid direct transition
      expect(StatusMachine.canTransitionInitiative('DRAFT', 'DONE')).toBe(false);
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
      // Updated from IN_EXECUTION to EXECUTING
      const validation = StatusMachine.validateInitiativeTransition('EXECUTING', 'BLOCKED', {});
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('reason');
    });

    it('should accept blocked reason for BLOCKED status', () => {
      // Updated from IN_EXECUTION to EXECUTING
      const validation = StatusMachine.validateInitiativeTransition('EXECUTING', 'BLOCKED', {
        blockedReason: 'Waiting for approval',
      });
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
