import { afterEach, describe, expect, it } from 'vitest';

import { isInitiativesWorkloadEnabled, loadFeatureFlags } from '../FeatureFlags.js';

describe('ENABLE_INITIATIVES_WORKLOAD', () => {
  afterEach(() => delete process.env.ENABLE_INITIATIVES_WORKLOAD);

  it('is OFF by default and requires the literal true opt-in', () => {
    delete process.env.ENABLE_INITIATIVES_WORKLOAD;
    expect(loadFeatureFlags().ENABLE_INITIATIVES_WORKLOAD).toBe(false);
    expect(isInitiativesWorkloadEnabled()).toBe(false);
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'false';
    expect(loadFeatureFlags().ENABLE_INITIATIVES_WORKLOAD).toBe(false);
    expect(isInitiativesWorkloadEnabled()).toBe(false);
    process.env.ENABLE_INITIATIVES_WORKLOAD = 'true';
    expect(loadFeatureFlags().ENABLE_INITIATIVES_WORKLOAD).toBe(true);
    expect(isInitiativesWorkloadEnabled()).toBe(true);
  });
});
