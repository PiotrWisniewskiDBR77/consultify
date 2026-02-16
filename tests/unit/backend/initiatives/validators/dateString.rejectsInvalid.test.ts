import { describe, expect, it } from 'vitest';

import { CreateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('DateOnlyOrDateTimeString (via CreateInitiativeSchema)', () => {
  it('rejects non-date strings', () => {
    const res = CreateInitiativeSchema.safeParse({
      title: 'T',
      plannedStartDate: '16/02/2026',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain('Invalid date format');
    }
  });
});
