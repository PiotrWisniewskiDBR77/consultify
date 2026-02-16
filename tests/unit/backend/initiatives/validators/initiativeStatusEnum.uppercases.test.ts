import { describe, expect, it } from 'vitest';

import { InitiativeStatusEnum } from '../../../../../server/src/validators/initiative.validators.js';

describe('InitiativeStatusEnum', () => {
  it('uppercases valid status values', () => {
    const res = InitiativeStatusEnum.safeParse('draft');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBe('DRAFT');
    }
  });
});
