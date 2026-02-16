import { describe, expect, it } from 'vitest';

import StatusMachine, {
  EXECUTION_STAGES,
  INITIATIVE_STATUSES,
} from '../../../../server/src/services/statusMachine.ts';

describe('StatusMachine: modules, labels, stages', () => {
  it('maps DRAFT to ASSESSMENT module label', () => {
    expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.DRAFT)).toBe('ASSESSMENT');
  });

  it('maps REVIEW to INITIATIVE_MANAGEMENT module label', () => {
    expect(StatusMachine.getInitiativeModule(INITIATIVE_STATUSES.REVIEW)).toBe(
      'INITIATIVE_MANAGEMENT'
    );
  });

  it('detects module transition across module boundaries', () => {
    const res = StatusMachine.isModuleTransition(
      INITIATIVE_STATUSES.DRAFT,
      INITIATIVE_STATUSES.REVIEW
    );
    expect(res).toEqual({
      crossesModule: true,
      fromModule: 'ASSESSMENT',
      toModule: 'INITIATIVE_MANAGEMENT',
    });
  });

  it('returns stable status labels for known statuses', () => {
    expect(StatusMachine.getStatusLabel(INITIATIVE_STATUSES.DONE)).toBe('Done');
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
