import { describe, expect, it } from 'vitest';

import { GateType, InitiativeStatus, Role, canExecuteGate, getGateForTransition, validateTransition } from '../../../../server/src/constants/initiativeStatuses.ts';

describe('DEC-424 gates and conditions', () => {
  it('allows ADMIN to bypass roles, not content conditions', () => {
    expect(canExecuteGate(Role.ADMIN, GateType.APPROVE)).toBe(true);
    expect(validateTransition(InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.APPROVED, { userRole: Role.ADMIN, hasCurrentGoDecision: false }).valid).toBe(false);
  });

  it('restricts draft submission to its configured role and author', () => {
    expect(canExecuteGate(Role.CONSULTANT, GateType.SUBMIT_FOR_REVIEW)).toBe(true);
    expect(validateTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL, { userRole: Role.CONSULTANT, isAuthor: false, hasRequiredArtefacts: true }).valid).toBe(false);
  });

  it('maps the pivotal transitions to their gates', () => {
    expect(getGateForTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL)).toBe(GateType.SUBMIT_FOR_REVIEW);
    expect(getGateForTransition(InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.APPROVED)).toBe(GateType.APPROVE);
    expect(getGateForTransition(InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION)).toBe(GateType.START);
  });

  it('requires a reason for rejection', () => {
    expect(validateTransition(InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.REJECTED, { userRole: Role.PROJECT_SPONSOR, reason: '' }).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.REJECTED, { userRole: Role.PROJECT_SPONSOR, reason: 'Brak uzasadnienia biznesowego' }).valid).toBe(true);
  });

  it('requires no open work before closure', () => {
    expect(validateTransition(InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED, { userRole: Role.INITIATIVE_OWNER, pendingTasks: 1 }).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED, { userRole: Role.INITIATIVE_OWNER, pendingTasks: 0, hasBlockingDecisions: false }).valid).toBe(true);
  });
});
