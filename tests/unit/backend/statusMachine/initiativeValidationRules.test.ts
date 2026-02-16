import { describe, expect, it } from 'vitest';

import StatusMachine, {
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

describe('StatusMachine: initiative validation rules', () => {
  it('requires blockedReason when transitioning to BLOCKED', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.EXECUTING,
      INITIATIVE_STATUSES.BLOCKED,
      {}
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Blocked status requires a reason');
  });

  it('rejects DONE when pendingTasks > 0', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.EXECUTING,
      INITIATIVE_STATUSES.DONE,
      { pendingTasks: 2 }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot complete: 2 tasks still pending');
  });

  it('rejects DONE when there are blocking decisions', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.EXECUTING,
      INITIATIVE_STATUSES.DONE,
      { hasBlockingDecisions: true }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot complete: Open blocking decisions exist');
  });

  it('rejects REVIEW -> PROMOTED when charterCompleteness is below 60', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.REVIEW,
      INITIATIVE_STATUSES.PROMOTED,
      { charterCompleteness: 59 }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Charter completeness too low (59%). Minimum 60% required.');
  });

  it('rejects APPROVED -> SCHEDULED when requiresScheduling=true but isScheduled=false', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.APPROVED,
      INITIATIVE_STATUSES.SCHEDULED,
      { requiresScheduling: true, isScheduled: false }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Initiative must be scheduled in roadmap before scheduling');
  });
});
