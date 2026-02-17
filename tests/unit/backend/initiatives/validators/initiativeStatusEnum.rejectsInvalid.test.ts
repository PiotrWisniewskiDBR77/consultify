import { describe, expect, it } from 'vitest';

import { InitiativeStatusEnum } from '../../../../../server/src/validators/initiative.validators.js';

describe('InitiativeStatusEnum', () => {
  it('rejects values that are not in the central status machine', () => {
    const res = InitiativeStatusEnum.safeParse('not_a_status');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe('Invalid initiative status');
    }
  });
});
