import { describe, expect, it } from 'vitest';

import { InitiativePriorityEnum } from '../../../../../server/src/validators/initiative.validators.js';

describe('InitiativePriorityEnum', () => {
  it('keeps allowed values and normalizes them to lowercase', () => {
    const res = InitiativePriorityEnum.safeParse('high');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBe('high');
    }
  });

  it('rejects unknown values', () => {
    const res = InitiativePriorityEnum.safeParse('urgent');
    expect(res.success).toBe(false);
  });
});
