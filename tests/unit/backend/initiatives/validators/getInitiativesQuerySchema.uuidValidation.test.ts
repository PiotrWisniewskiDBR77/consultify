import { describe, expect, it } from 'vitest';

import { GetInitiativesQuerySchema } from '../../../../../server/src/validators/initiative.validators.js';

describe('GetInitiativesQuerySchema', () => {
  it('requires projectId to be a UUID when present', () => {
    const res = GetInitiativesQuerySchema.safeParse({ projectId: 'not-a-uuid' });
    expect(res.success).toBe(false);
  });
});
