import { describe, expect, it } from 'vitest';

import { isInitiativesPlanEnabled } from '../initiativesPlanFlag';

describe('isInitiativesPlanEnabled', () => {
  it('fails closed unless VITE_INITIATIVES_PLAN is exactly true', () => {
    expect(isInitiativesPlanEnabled({})).toBe(false);
    expect(isInitiativesPlanEnabled({ VITE_INITIATIVES_PLAN: 'false' })).toBe(false);
    expect(isInitiativesPlanEnabled({ VITE_INITIATIVES_PLAN: 'TRUE' })).toBe(false);
    expect(isInitiativesPlanEnabled({ VITE_INITIATIVES_PLAN: 'true' })).toBe(true);
  });
});
