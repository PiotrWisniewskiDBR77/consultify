import { describe, expect, it } from 'vitest';

import { CreateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('DateOnlyOrDateTimeString (via CreateInitiativeSchema)', () => {
  it('accepts ISO datetime strings', () => {
    const iso = '2026-02-16T12:34:56.000Z';
    const res = CreateInitiativeSchema.safeParse({
      title: 'T',
      plannedEndDate: iso,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.plannedEndDate).toBe(iso);
    }
  });
});
