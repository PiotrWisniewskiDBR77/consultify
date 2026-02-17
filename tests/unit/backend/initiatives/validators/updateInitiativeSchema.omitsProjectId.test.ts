import { describe, expect, it } from 'vitest';

import { UpdateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('UpdateInitiativeSchema', () => {
  it('strips projectId from input (explicitly omitted)', () => {
    const res = UpdateInitiativeSchema.safeParse({
      projectId: 'should-not-survive',
      title: 'New title',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect((res.data as any).projectId).toBeUndefined();
      expect(res.data.title).toBe('New title');
    }
  });
});
