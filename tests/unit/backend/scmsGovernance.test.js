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

  // DEC-424 (P12): cykl życia to 7 statusów — PROPOSED · DRAFT ·
  // PENDING_APPROVAL · APPROVED · IN_EXECUTION · CLOSED · REJECTED.
  describe('Initiative Status Transitions', () => {
    it('should allow PROPOSED to DRAFT transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.PROPOSED, global.IS.DRAFT)).toBe(true);
    });

    it('should allow DRAFT to PENDING_APPROVAL transition', () => {
      expect(
        StatusMachine.canTransitionInitiative(global.IS.DRAFT, global.IS.PENDING_APPROVAL)
      ).toBe(true);
    });

    it('should allow PENDING_APPROVAL to APPROVED transition', () => {
      expect(
        StatusMachine.canTransitionInitiative(global.IS.PENDING_APPROVAL, global.IS.APPROVED)
      ).toBe(true);
    });

    it('should allow PENDING_APPROVAL back to DRAFT (send back)', () => {
      expect(
        StatusMachine.canTransitionInitiative(global.IS.PENDING_APPROVAL, global.IS.DRAFT)
      ).toBe(true);
    });

    it('should allow APPROVED to IN_EXECUTION transition', () => {
      expect(
        StatusMachine.canTransitionInitiative(global.IS.APPROVED, global.IS.IN_EXECUTION)
      ).toBe(true);
    });

    it('should allow IN_EXECUTION to CLOSED transition', () => {
      expect(StatusMachine.canTransitionInitiative(global.IS.IN_EXECUTION, global.IS.CLOSED)).toBe(
        true
      );
    });

    it('should normalize legacy EXECUTING to DONE onto IN_EXECUTION -> CLOSED', () => {
      expect(StatusMachine.canTransitionInitiative('EXECUTING', 'DONE')).toBe(true);
    });

    it('should disallow CLOSED to DRAFT transition', () => {
      expect(StatusMachine.canTransitionInitiative('CLOSED', 'DRAFT')).toBe(false);
    });

    it('should disallow invalid status transition', () => {
      // DRAFT -> CLOSED nie jest przejściem bezpośrednim
      expect(StatusMachine.canTransitionInitiative('DRAFT', 'CLOSED')).toBe(false);
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

  // DEC-424: wstrzymanie to flaga `on_hold`, nie status. Powodu wymaga REJECTED.
  describe('Rejection Reason Validation', () => {
    it('should require a reason for REJECTED initiative status', () => {
      const validation = StatusMachine.validateInitiativeTransition(
        'IN_EXECUTION',
        'REJECTED',
        {}
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('reason');
    });

    it('should accept REJECTED when a reason is provided', () => {
      const validation = StatusMachine.validateInitiativeTransition('IN_EXECUTION', 'REJECTED', {
        reason: 'Waiting for approval',
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
