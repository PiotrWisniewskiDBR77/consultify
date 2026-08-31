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

  it('does not infer drift from distinct raw and portfolio vocabularies', () => {
    expect(
      hasInitiativeStatusReadDrift({ status: 'OLD', displayStatus: 'EXECUTING' })
    ).toBe(false);
  });
});
