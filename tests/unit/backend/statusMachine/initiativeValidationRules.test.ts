import { describe, expect, it } from 'vitest';

import StatusMachine, {
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

// DEC-424 (P12): BLOCKED przestał być statusem (jest flagą `on_hold`), DONE/
// TRACKING/ARCHIVED zwinęły się w CLOSED, CANCELLED w REJECTED. Reguły
// kontekstowe zmapowane odpowiednio.
describe('StatusMachine: initiative validation rules', () => {
  it('requires a reason when transitioning to REJECTED', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.IN_EXECUTION,
      INITIATIVE_STATUSES.REJECTED,
      {}
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Rejection requires a reason');
  });

  it('accepts REJECTED when a reason is provided', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.IN_EXECUTION,
      INITIATIVE_STATUSES.REJECTED,
      { reason: 'Sponsor wycofał finansowanie' }
    );
    expect(res).toEqual({ valid: true });
  });

  it('rejects CLOSED when pendingTasks > 0', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.IN_EXECUTION,
      INITIATIVE_STATUSES.CLOSED,
      { pendingTasks: 2 }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot complete: 2 tasks still pending');
  });

  it('rejects CLOSED when there are blocking decisions', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.IN_EXECUTION,
      INITIATIVE_STATUSES.CLOSED,
      { hasBlockingDecisions: true }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot complete: Open blocking decisions exist');
  });

  it('rejects PENDING_APPROVAL -> APPROVED when governance approval is missing', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.PENDING_APPROVAL,
      INITIATIVE_STATUSES.APPROVED,
      { requiresApproval: true, isApproved: false }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Governance approval required for this transition');
  });

  it('rejects PENDING_APPROVAL -> APPROVED when reviews are still pending', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.PENDING_APPROVAL,
      INITIATIVE_STATUSES.APPROVED,
      { pendingReviews: 3 }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot approve: 3 reviews still pending');
  });

  // Wstrzymanie inicjatywy to operacja na fladze `on_hold` (INITIATIVE_FLAG_RULES.HOLD),
  // a nie przejście statusu — legacy 'BLOCKED' zwija się do IN_EXECUTION.
  it('does not treat legacy BLOCKED as a status transition', () => {
    const res = StatusMachine.validateInitiativeTransition('EXECUTING', 'BLOCKED', {});
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot transition from EXECUTING to BLOCKED');
  });
});
