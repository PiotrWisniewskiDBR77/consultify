import { describe, expect, it } from 'vitest';

import {
  GateType,
  InitiativeStatus,
  Role,
  canExecuteGate,
  getGateForTransition,
  validateTransition,
} from '../../../../server/src/constants/initiativeStatuses.ts';

describe('initiativeStatuses: gates + transition validation', () => {
  it('allows ADMIN to execute any gate (technical override)', () => {
    expect(canExecuteGate(Role.ADMIN, GateType.ACCEPT)).toBe(true);
  });

  it('restricts CONSULTANT to SUBMIT_FOR_REVIEW only', () => {
    expect(canExecuteGate(Role.CONSULTANT, GateType.SUBMIT_FOR_REVIEW)).toBe(true);
    expect(canExecuteGate(Role.CONSULTANT, GateType.ACCEPT)).toBe(false);
  });

  it('finds the gate required for a transition', () => {
    expect(getGateForTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)).toBe(
      GateType.SUBMIT_FOR_REVIEW
    );
    expect(getGateForTransition(InitiativeStatus.REVIEW, InitiativeStatus.PROMOTED)).toBe(
      GateType.ACCEPT
    );
  });

  it('rejects a transition when user role cannot execute its gate and returns requiredRoles', () => {
    const res = validateTransition(InitiativeStatus.REVIEW, InitiativeStatus.PROMOTED, {
      userRole: Role.TEAM_MEMBER,
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('cannot execute gate');
    expect(res.requiredRoles).toEqual(
      expect.arrayContaining([Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE])
    );
  });

  it('rejects BLOCKED -> EXECUTING when escalation is red and role is not Steering', () => {
    const res = validateTransition(InitiativeStatus.BLOCKED, InitiativeStatus.EXECUTING, {
      // Must be a role that can execute UNBLOCK gate, otherwise gate permission check fails first.
      userRole: Role.PROJECT_SPONSOR,
      escalationLevel: 'red',
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Escalated (red) blocks require Steering Committee decision');
    expect(res.requiredRoles).toEqual([Role.STEERING_COMMITTEE]);
  });
});
