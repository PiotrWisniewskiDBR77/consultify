import { describe, expect, it } from 'vitest';

import {
  getWorkflowStatusForInitiative,
  hasInitiativeStatusReadDrift,
} from '../initiativeWorkflowStatus';

describe('initiative workflow status coherence', () => {
  it('uses the normalized lifecycle when it is available', () => {
    expect(
      getWorkflowStatusForInitiative({ status: 'EXECUTING', displayStatus: 'IN_EXECUTION' })
    ).toBe('IN_EXECUTION');
  });

  it('does not treat two intentional status vocabularies as schema drift', () => {
    expect(
      hasInitiativeStatusReadDrift({
        status: 'EXECUTING',
        displayStatus: 'IN_EXECUTION',
        statusReadDrift: false,
      })
    ).toBe(false);
  });

  it('surfaces the explicit backend drift signal', () => {
    expect(
      hasInitiativeStatusReadDrift({
        status: 'UNKNOWN_LEGACY_STATUS',
        displayStatus: 'REGISTERED_DRAFT',
        statusReadDrift: true,
      })
    ).toBe(true);
  });
});
