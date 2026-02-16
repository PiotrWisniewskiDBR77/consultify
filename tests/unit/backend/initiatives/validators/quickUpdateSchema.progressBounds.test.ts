import { describe, expect, it } from 'vitest';

import { QuickUpdateInitiativeSchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('QuickUpdateInitiativeSchema', () => {
  it('rejects progress < 0', () => {
    const res = QuickUpdateInitiativeSchema.safeParse({ progress: -1 });
    expect(res.success).toBe(false);
  });

  it('rejects progress > 100', () => {
    const res = QuickUpdateInitiativeSchema.safeParse({ progress: 101 });
    expect(res.success).toBe(false);
  });
});
