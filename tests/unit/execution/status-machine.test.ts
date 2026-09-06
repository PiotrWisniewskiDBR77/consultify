/**
 * Status Machine — Unit Tests (REAL CODE)
 *
 * Tests server/src/services/statusMachine.ts
 */
import { describe, expect, it } from 'vitest';

import StatusMachine from '../../../server/src/services/statusMachine.js';
import { INITIATIVE_STATUSES } from '../../../server/src/services/statusMachine.js';

describe('StatusMachine (REAL)', () => {
  describe('canTransitionInitiative', () => {
    it('allows DRAFT → PENDING_APPROVAL', () => {
      expect(
        StatusMachine.canTransitionInitiative(INITIATIVE_STATUSES.DRAFT, INITIATIVE_STATUSES.PENDING_APPROVAL),
      ).toBe(true);
    });

    it('denies invalid transition', () => {
      expect(
        StatusMachine.canTransitionInitiative(INITIATIVE_STATUSES.CLOSED, INITIATIVE_STATUSES.DRAFT),
      ).toBe(false);
    });

    it('returns false for unknown from status', () => {
      expect(StatusMachine.canTransitionInitiative('UNKNOWN', INITIATIVE_STATUSES.DRAFT)).toBe(false);
    });
  });

  describe('validateInitiativeTransition', () => {
    it('returns valid for allowed transition', () => {
      const r = StatusMachine.validateInitiativeTransition(
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.PENDING_APPROVAL,
      );
      expect(r.valid).toBe(true);
    });

    it('returns invalid for disallowed transition', () => {
      const r = StatusMachine.validateInitiativeTransition(
        INITIATIVE_STATUSES.CLOSED,
        INITIATIVE_STATUSES.DRAFT,
      );
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('Cannot transition');
    });

    it('requires a reason when transitioning to REJECTED', () => {
      const r = StatusMachine.validateInitiativeTransition(
        INITIATIVE_STATUSES.IN_EXECUTION,
        INITIATIVE_STATUSES.REJECTED,
        {},
      );
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('Rejection requires a reason');
    });

    it('allows REJECTED when a reason is provided', () => {
      const r = StatusMachine.validateInitiativeTransition(
        INITIATIVE_STATUSES.IN_EXECUTION,
        INITIATIVE_STATUSES.REJECTED,
        { reason: 'Waiting for approval' },
      );
      expect(r.valid).toBe(true);
    });

    it('rejects CLOSED when pendingTasks > 0', () => {
      const r = StatusMachine.validateInitiativeTransition(
        INITIATIVE_STATUSES.IN_EXECUTION,
        INITIATIVE_STATUSES.CLOSED,
        { pendingTasks: 3 },
      );
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('tasks still pending');
    });
  });

  describe('getAllowedInitiativeTransitions', () => {
    it('returns array for DRAFT', () => {
      const allowed = StatusMachine.getAllowedInitiativeTransitions(INITIATIVE_STATUSES.DRAFT);
      expect(Array.isArray(allowed)).toBe(true);
    });

    it('returns empty for unknown status', () => {
      const allowed = StatusMachine.getAllowedInitiativeTransitions('UNKNOWN');
      expect(allowed).toEqual([]);
    });
  });

  describe('canTransitionTask', () => {
    it('allows TODO → IN_PROGRESS', () => {
      expect(
        StatusMachine.canTransitionTask('TODO', 'IN_PROGRESS'),
      ).toBe(true);
    });

    it('denies invalid task transition', () => {
      expect(StatusMachine.canTransitionTask('DONE', 'TODO')).toBe(false);
    });
  });

  describe('validateTaskTransition', () => {
    it('requires blockedReason when transitioning to BLOCKED', () => {
      const r = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {});
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('Blocked status requires a reason');
    });

    it('requires blockerType when transitioning to BLOCKED', () => {
      const r = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {
        blockedReason: 'Waiting',
      });
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('blocker type');
    });

    it('allows BLOCKED when both required', () => {
      const r = StatusMachine.validateTaskTransition('IN_PROGRESS', 'BLOCKED', {
        blockedReason: 'Waiting',
        blockerType: 'dependency',
      });
      expect(r.valid).toBe(true);
    });
  });

  describe('canTransitionExecutionStage', () => {
    it('allows KICKOFF → IN_PROGRESS', () => {
      expect(StatusMachine.canTransitionExecutionStage('KICKOFF', 'IN_PROGRESS')).toBe(true);
    });

    it('denies invalid stage transition', () => {
      expect(StatusMachine.canTransitionExecutionStage('DELIVERY', 'KICKOFF')).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('returns label for DRAFT', () => {
      expect(StatusMachine.getStatusLabel(INITIATIVE_STATUSES.DRAFT)).toBe('Draft');
    });

    it('returns status for unknown', () => {
      expect(StatusMachine.getStatusLabel('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('getInitiativeModule', () => {
    it('returns INITIATIVE_MANAGEMENT for DRAFT', () => {
      expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.DRAFT)).toBe(
        'INITIATIVE_MANAGEMENT',
      );
    });

    it('returns EXECUTION for IN_EXECUTION', () => {
      expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.IN_EXECUTION)).toBe('EXECUTION');
    });
  });
});
