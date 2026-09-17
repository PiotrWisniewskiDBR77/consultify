import { describe, expect, it } from 'vitest';

import { isInitiativesStages12Enabled } from '../initiativesStages12Flag';

describe('VITE_INITIATIVES_STAGES_12', () => {
  it('is fail-closed and enables only exact true', () => {
    expect(isInitiativesStages12Enabled({})).toBe(false);
    expect(isInitiativesStages12Enabled({ VITE_INITIATIVES_STAGES_12: '' })).toBe(false);
    expect(isInitiativesStages12Enabled({ VITE_INITIATIVES_STAGES_12: 'false' })).toBe(false);
    expect(isInitiativesStages12Enabled({ VITE_INITIATIVES_STAGES_12: 'TRUE' })).toBe(false);
    expect(isInitiativesStages12Enabled({ VITE_INITIATIVES_STAGES_12: 'true' })).toBe(true);
  });
});
