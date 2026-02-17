import { describe, expect, it } from 'vitest';

import { CreateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('DateOnlyOrDateTimeString (via CreateInitiativeSchema)', () => {
  it('accepts YYYY-MM-DD strings', () => {
    const res = CreateInitiativeSchema.safeParse({
      title: 'T',
      plannedStartDate: '2026-02-16',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.plannedStartDate).toBe('2026-02-16');
    }
  });
});
