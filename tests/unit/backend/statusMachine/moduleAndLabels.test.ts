import { describe, expect, it } from 'vitest';

import StatusMachine, {
  EXECUTION_STAGES,
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

describe('StatusMachine: modules, labels, stages', () => {
  it('maps DRAFT to INITIATIVE_MANAGEMENT module label', () => {
    expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.DRAFT)).toBe(
      'INITIATIVE_MANAGEMENT'
    );
  });

  it('maps IN_EXECUTION to EXECUTION and CLOSED to BENEFITS', () => {
    expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.IN_EXECUTION)).toBe('EXECUTION');
    expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.CLOSED)).toBe('BENEFITS');
  });

  it('returns UNKNOWN for a status outside both dictionaries', () => {
    expect(StatusMachine.getInitiativeModule('NIE_ISTNIEJE')).toBe('UNKNOWN');
  });

  it('detects module transition across module boundaries', () => {
    expect(
      StatusMachine.isModuleTransition(
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.IN_EXECUTION
      )
    ).toEqual({
      crossesModule: true,
      fromModule: 'INITIATIVE_MANAGEMENT',
      toModule: 'EXECUTION',
    });
  });

  it('does not report a module transition inside one module', () => {
    expect(
      StatusMachine.isModuleTransition(
        INITIATIVE_STATUSES.DRAFT,
        INITIATIVE_STATUSES.PENDING_APPROVAL
      ).crossesModule
    ).toBe(false);
  });

  it('returns stable status labels for the 7 canonical statuses', () => {
    expect(StatusMachine.getStatusLabel(INITIATIVE_STATUSES.CLOSED)).toBe('Closed');
    expect(StatusMachine.getStatusLabel(INITIATIVE_STATUSES.IN_EXECUTION)).toBe('In Execution');
    // Legacy nazwy zwijają się do etykiety statusu kanonicznego.
    expect(StatusMachine.getStatusLabel('DONE')).toBe('Closed');
    expect(StatusMachine.getStatusLabel('NIE_ISTNIEJE')).toBe('NIE_ISTNIEJE');
  });

  it('blocks DELIVERY stage when pendingReviews > 0', () => {
    const res = StatusMachine.validateStageTransition(
      EXECUTION_STAGES.REVIEW,
      EXECUTION_STAGES.DELIVERY,
      {
        pendingReviews: 1,
      }
    );
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('Cannot deliver: 1 reviews still pending');
  });
});
