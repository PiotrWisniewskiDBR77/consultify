import { describe, expect, it } from 'vitest';

import { CreateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('CreateInitiativeSchema', () => {
  it('defaults status to DRAFT when omitted', () => {
    const res = CreateInitiativeSchema.safeParse({ title: 'My initiative' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe('DRAFT');
    }
  });
});
