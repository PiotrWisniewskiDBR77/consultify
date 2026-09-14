import { describe, expect, it } from 'vitest';

import { isInitiativesWorkloadEnabled } from '../initiativesWorkloadFlag';

describe('isInitiativesWorkloadEnabled', () => {
  it('keeps the workload surface OFF unless explicitly enabled', () => {
    expect(isInitiativesWorkloadEnabled({})).toBe(false);
    expect(isInitiativesWorkloadEnabled({ VITE_INITIATIVES_WORKLOAD: 'false' })).toBe(false);
    expect(isInitiativesWorkloadEnabled({ VITE_INITIATIVES_WORKLOAD: 'true' })).toBe(true);
  });
});
