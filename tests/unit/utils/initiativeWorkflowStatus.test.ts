import { describe, expect, it } from 'vitest';

import {
  getWorkflowStatusForInitiative,
  hasInitiativeStatusReadDrift,
} from '@/utils/initiativeWorkflowStatus';

describe('initiativeWorkflowStatus', () => {
  it('prefers displayStatus over raw status', () => {
    expect(
      getWorkflowStatusForInitiative({ status: 'GARBAGE', displayStatus: 'REVIEW' })
    ).toBe('REVIEW');
  });

  it('detects drift from statusReadDrift flag', () => {
    expect(hasInitiativeStatusReadDrift({ statusReadDrift: true })).toBe(true);
  });

  it('detects drift when raw and display disagree', () => {
    expect(
      hasInitiativeStatusReadDrift({ status: 'OLD', displayStatus: 'EXECUTING' })
    ).toBe(true);
  });
});
