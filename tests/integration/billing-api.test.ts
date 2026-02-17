import { describe, expect, it } from 'vitest';

import {
  BillingStatsQuerySchema,
  CreateInvoiceRequestSchema,
  CreatePlanRequestSchema,
  InvoiceLineItemSchema,
  ListPlansQuerySchema,
} from '../../server/src/validators/billing.validators.js';

describe('Billing API validators - REAL_CODE', () => {
  it('coerces BillingStatsQuerySchema.period from string and defaults to 30', () => {
    expect(BillingStatsQuerySchema.parse({}).period).toBe(30);
    expect(BillingStatsQuerySchema.parse({ period: '7' }).period).toBe(7);
  });

  it('defaults InvoiceLineItemSchema.quantity to 1', () => {
    const item = InvoiceLineItemSchema.parse({ description: 'X', amount: 1 });
    expect(item.quantity).toBe(1);
  });

  it('rejects CreateInvoiceRequestSchema when organizationId is not a uuid', () => {
    const res = CreateInvoiceRequestSchema.safeParse({
      organizationId: 'not-a-uuid',
      lineItems: [{ description: 'X', amount: 10 }],
    });
    expect(res.success).toBe(false);
  });

  it('applies CreatePlanRequestSchema defaults (currency, isPublic, trialDays)', () => {
    const plan = CreatePlanRequestSchema.parse({
      name: 'Pro',
      priceMonthly: 0,
    });
    expect(plan.currency).toBe('USD');
    expect(plan.isPublic).toBe(true);
    expect(plan.trialDays).toBe(0);
  });

  it('transforms ListPlansQuerySchema.includeInactive to boolean', () => {
    expect(ListPlansQuerySchema.parse({}).includeInactive).toBe(false);
    expect(ListPlansQuerySchema.parse({ includeInactive: 'true' }).includeInactive).toBe(true);
  });
});
