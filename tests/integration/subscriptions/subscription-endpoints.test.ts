import { describe, expect, it } from 'vitest';

import {
  CreateSubscriptionRequestSchema,
  UpdateSubscriptionRequestSchema,
} from '../../../server/src/validators/billing.validators.js';

describe('Subscription validators - REAL_CODE', () => {
  it('CreateSubscriptionRequestSchema defaults trialDays to 0', () => {
    const res = CreateSubscriptionRequestSchema.parse({
      organizationId: '00000000-0000-0000-0000-000000000000',
      planId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.trialDays).toBe(0);
  });

  it('UpdateSubscriptionRequestSchema allows cancelAtPeriodEnd boolean', () => {
    expect(UpdateSubscriptionRequestSchema.safeParse({ cancelAtPeriodEnd: true }).success).toBe(
      true
    );
  });
});
