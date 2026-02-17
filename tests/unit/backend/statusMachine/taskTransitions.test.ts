import { describe, expect, it } from 'vitest';

import StatusMachine, { TASK_STATUSES } from '../../../../server/src/services/statusMachine.ts';

describe('StatusMachine: task transitions', () => {
  it('allows TODO -> IN_PROGRESS', () => {
    expect(StatusMachine.canTransitionTask(TASK_STATUSES.TODO, TASK_STATUSES.IN_PROGRESS)).toBe(
      true
    );
  });

  it('requires blockedReason when transitioning to BLOCKED', () => {
    const res = StatusMachine.validateTaskTransition(
      TASK_STATUSES.IN_PROGRESS,
      TASK_STATUSES.BLOCKED,
      {
        blockerType: 'dependency',
      }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Blocked status requires a reason');
  });

  it('requires blockerType when transitioning to BLOCKED', () => {
    const res = StatusMachine.validateTaskTransition(
      TASK_STATUSES.IN_PROGRESS,
      TASK_STATUSES.BLOCKED,
      {
        blockedReason: 'waiting',
      }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Blocked status requires a blocker type');
  });

  it('accepts IN_PROGRESS -> BLOCKED when blockedReason + blockerType exist', () => {
    const res = StatusMachine.validateTaskTransition(
      TASK_STATUSES.IN_PROGRESS,
      TASK_STATUSES.BLOCKED,
      {
        blockedReason: 'Waiting on vendor',
        blockerType: 'external',
      }
    );
    expect(res).toEqual({ valid: true });
  });

  it('exposes allowed transitions for DONE', () => {
    const allowed = StatusMachine.getAllowedTaskTransitions(TASK_STATUSES.DONE);
    expect(allowed).toEqual([TASK_STATUSES.IN_PROGRESS]);
  });
});
