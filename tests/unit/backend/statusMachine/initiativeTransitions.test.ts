import { describe, expect, it } from 'vitest';

import StatusMachine, {
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

describe('StatusMachine: initiative transitions', () => {
  it('allows DRAFT -> PENDING_REVIEW (canonical transitions)', () => {
    expect(
      StatusMachine.canTransitionInitiative(
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.PENDING_REVIEW
      )
    ).toBe(true);
  });

  it('disallows DRAFT -> APPROVED', () => {
    expect(
      StatusMachine.canTransitionInitiative(INITIATIVE_STATUSES.DRAFT, INITIATIVE_STATUSES.APPROVED)
    ).toBe(false);
  });

  it('exposes allowed transitions list for a status', () => {
    const allowed = StatusMachine.getAllowedInitiativeTransitions(INITIATIVE_STATUSES.DRAFT);
    expect(allowed).toEqual(
      expect.arrayContaining([INITIATIVE_STATUSES.PENDING_REVIEW, INITIATIVE_STATUSES.CANCELLED])
    );
  });

  it('returns a clear reason for an impossible transition', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.DRAFT,
      INITIATIVE_STATUSES.EXECUTING
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(
      `Cannot transition from ${INITIATIVE_STATUSES.DRAFT} to ${INITIATIVE_STATUSES.EXECUTING}`
    );
  });

  it('returns valid=true for allowed transition when no extra rules apply', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.PENDING_REVIEW,
      INITIATIVE_STATUSES.REVIEW
    );
    expect(res).toEqual({ valid: true });
  });
});
