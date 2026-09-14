import { afterEach, describe, expect, it } from 'vitest';

import { isInitiativesPlanEnabled } from '../initiativesPlanFlag.js';

const saved = process.env.ENABLE_INITIATIVES_PLAN;

afterEach(() => {
  if (saved === undefined) delete process.env.ENABLE_INITIATIVES_PLAN;
  else process.env.ENABLE_INITIATIVES_PLAN = saved;
});

describe('ENABLE_INITIATIVES_PLAN', () => {
  it('fails closed unless the value is exactly true', () => {
    delete process.env.ENABLE_INITIATIVES_PLAN;
    expect(isInitiativesPlanEnabled()).toBe(false);
    process.env.ENABLE_INITIATIVES_PLAN = 'false';
    expect(isInitiativesPlanEnabled()).toBe(false);
    process.env.ENABLE_INITIATIVES_PLAN = 'true';
    expect(isInitiativesPlanEnabled()).toBe(true);
  });
});
