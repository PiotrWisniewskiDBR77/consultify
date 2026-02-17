import { describe, expect, it } from 'vitest';

import { CreateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('DateOnlyOrDateTimeString (via CreateInitiativeSchema)', () => {
  it('trims whitespace and accepts empty strings as "not provided"', () => {
    const res = CreateInitiativeSchema.safeParse({
      title: 'T',
      plannedStartDate: '   ',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.plannedStartDate).toBe('');
    }
  });
});
