import { describe, expect, it } from 'vitest';

import StatusMachine, {
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

// DEC-424 (P12): słownik 7 statusów. Graf przejść pochodzi z
// server/src/constants/initiativeStatuses.ts (VALID_TRANSITIONS) — StatusMachine
// jest tylko adapterem, nie drugim silnikiem.
describe('StatusMachine: initiative transitions', () => {
  it('allows DRAFT -> PENDING_APPROVAL (canonical transitions)', () => {
    expect(
      StatusMachine.canTransitionInitiative(
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.PENDING_APPROVAL
      )
    ).toBe(true);
  });

  it('disallows DRAFT -> APPROVED', () => {
    expect(
      StatusMachine.canTransitionInitiative(INITIATIVE_STATUSES.DRAFT, INITIATIVE_STATUSES.APPROVED)
    ).toBe(false);
  });

  it('exposes allowed transitions list for a status', () => {
    expect(StatusMachine.getAllowedInitiativeTransitions(INITIATIVE_STATUSES.PENDING_APPROVAL)).toEqual(
      expect.arrayContaining([
        INITIATIVE_STATUSES.APPROVED,
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.REJECTED,
      ])
    );
  });

  it('returns an empty list for terminal statuses', () => {
    expect(StatusMachine.getAllowedInitiativeTransitions(INITIATIVE_STATUSES.CLOSED)).toEqual([]);
    expect(StatusMachine.getAllowedInitiativeTransitions(INITIATIVE_STATUSES.REJECTED)).toEqual([]);
  });

  it('returns a clear reason for an impossible transition', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.DRAFT,
      INITIATIVE_STATUSES.IN_EXECUTION
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe(
      `Cannot transition from ${INITIATIVE_STATUSES.DRAFT} to ${INITIATIVE_STATUSES.IN_EXECUTION}`
    );
  });

  it('returns valid=true for allowed transition when no extra rules apply', () => {
    const res = StatusMachine.validateInitiativeTransition(
      INITIATIVE_STATUSES.PENDING_APPROVAL,
      INITIATIVE_STATUSES.APPROVED
    );
    expect(res).toEqual({ valid: true });
  });

  // Granica zgodności: dane zastane w starym słowniku 13 są normalizowane,
  // nie odrzucane (LEGACY_INITIATIVE_STATUS_MAP).
  it('normalizes legacy status names before checking the graph', () => {
    expect(StatusMachine.canTransitionInitiative('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(StatusMachine.canTransitionInitiative('EXECUTING', 'DONE')).toBe(true);
    expect(StatusMachine.canTransitionInitiative('SCHEDULED', 'EXECUTING')).toBe(true);
  });

  it('rejects statuses outside both the canonical and the legacy dictionary', () => {
    expect(StatusMachine.canTransitionInitiative('NIE_ISTNIEJE', INITIATIVE_STATUSES.DRAFT)).toBe(
      false
    );
    expect(StatusMachine.getAllowedInitiativeTransitions('NIE_ISTNIEJE')).toEqual([]);
  });
});
