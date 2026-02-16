import { describe, expect, it } from 'vitest';

import {
  CancelSubscriptionRequestSchema,
  CreateSubscriptionRequestSchema,
  UpdateSubscriptionRequestSchema,
} from '../../../server/src/validators/billing.validators.js';

describe('Payments/subscriptions validators - REAL_CODE', () => {
  it('CancelSubscriptionRequestSchema defaults immediately=false', () => {
    expect(CancelSubscriptionRequestSchema.parse({}).immediately).toBe(false);
  });

  it('CreateSubscriptionRequestSchema validates uuids and defaults billingCycle', () => {
    const ok = CreateSubscriptionRequestSchema.safeParse({
      organizationId: '00000000-0000-0000-0000-000000000000',
      planId: '00000000-0000-0000-0000-000000000000',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.billingCycle).toBe('monthly');
  });

  it('UpdateSubscriptionRequestSchema rejects invalid status', () => {
    expect(UpdateSubscriptionRequestSchema.safeParse({ status: 'nope' as any }).success).toBe(
      false
    );
  });
});
