import { describe, expect, it } from 'vitest';

import {
  CreateInvoiceRequestSchema,
  InvoiceLineItemSchema,
  UpdateInvoiceRequestSchema,
} from '../../../server/src/validators/billing.validators.js';

describe('Invoice validators - REAL_CODE', () => {
  it('InvoiceLineItemSchema requires positive amount', () => {
    expect(InvoiceLineItemSchema.safeParse({ description: 'x', amount: 0 }).success).toBe(false);
    expect(InvoiceLineItemSchema.safeParse({ description: 'x', amount: 1 }).success).toBe(true);
  });

  it('CreateInvoiceRequestSchema requires at least one line item', () => {
    expect(
      CreateInvoiceRequestSchema.safeParse({
        organizationId: '00000000-0000-0000-0000-000000000000',
        lineItems: [],
      }).success
    ).toBe(false);
  });

  it('UpdateInvoiceRequestSchema validates status enum', () => {
    expect(UpdateInvoiceRequestSchema.safeParse({ status: 'paid' }).success).toBe(true);
    expect(UpdateInvoiceRequestSchema.safeParse({ status: 'nope' as any }).success).toBe(false);
  });
});
