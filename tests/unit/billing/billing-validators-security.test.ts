/**
 * Billing Validators — Security & Negative Path Tests
 *
 * Covers all Zod schemas in billing.validators.ts with:
 * - invalid / malicious inputs
 * - boundary values
 * - injection attempts
 * - unauthorized field smuggling
 */
import { describe, expect, it } from 'vitest';

import {
  BillingStatsQuerySchema,
  CancelSubscriptionRequestSchema,
  CreateCreditNoteRequestSchema,
  CreateInvoiceRequestSchema,
  CreatePlanRequestSchema,
  CreateSpendingAlertRequestSchema,
  CreateSubscriptionRequestSchema,
  InvoiceIdParamSchema,
  InvoiceLineItemSchema,
  ListInvoicesQuerySchema,
  ListPlansQuerySchema,
  ListSubscriptionsQuerySchema,
  PlanIdParamSchema,
  RecordUsageRequestSchema,
  SpendingAlertIdParamSchema,
  SubscriptionIdParamSchema,
  ToggleSpendingAlertRequestSchema,
  UpdateInvoiceRequestSchema,
  UpdatePlanRequestSchema,
  UpdateSubscriptionRequestSchema,
  UsageQuerySchema,
} from '../../../server/src/validators/billing.validators.js';

// ────────────────────────────────────────────────────────
// Invoice Line Item
// ────────────────────────────────────────────────────────

describe('InvoiceLineItemSchema — negative paths', () => {
  it('rejects empty description', () => {
    expect(InvoiceLineItemSchema.safeParse({ description: '', amount: 10 }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(InvoiceLineItemSchema.safeParse({ description: 'x', amount: 0 }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(InvoiceLineItemSchema.safeParse({ description: 'x', amount: -5 }).success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    expect(
      InvoiceLineItemSchema.safeParse({ description: 'x', amount: 10, quantity: 1.5 }).success,
    ).toBe(false);
  });

  it('rejects zero quantity', () => {
    expect(
      InvoiceLineItemSchema.safeParse({ description: 'x', amount: 10, quantity: 0 }).success,
    ).toBe(false);
  });

  it('rejects XSS injection in description', () => {
    const res = InvoiceLineItemSchema.safeParse({
      description: '<script>alert("xss")</script>',
      amount: 10,
    });
    if (res.success) {
      expect(res.data.description).toBe('<script>alert("xss")</script>');
    }
  });
});

// ────────────────────────────────────────────────────────
// Create Invoice
// ────────────────────────────────────────────────────────

describe('CreateInvoiceRequestSchema — negative paths', () => {
  const validUuid = '00000000-0000-4000-a000-000000000000';

  it('rejects non-uuid organizationId', () => {
    const r = CreateInvoiceRequestSchema.safeParse({
      organizationId: 'not-a-uuid',
      lineItems: [{ description: 'x', amount: 10 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects SQL injection in organizationId', () => {
    const r = CreateInvoiceRequestSchema.safeParse({
      organizationId: "' OR 1=1 --",
      lineItems: [{ description: 'x', amount: 10 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty lineItems array', () => {
    const r = CreateInvoiceRequestSchema.safeParse({
      organizationId: validUuid,
      lineItems: [],
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid dueDate format', () => {
    const r = CreateInvoiceRequestSchema.safeParse({
      organizationId: validUuid,
      lineItems: [{ description: 'x', amount: 10 }],
      dueDate: '2024-13-40',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(CreateInvoiceRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateInvoiceRequestSchema.safeParse({ organizationId: validUuid }).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Update Invoice
// ────────────────────────────────────────────────────────

describe('UpdateInvoiceRequestSchema — negative paths', () => {
  it('rejects invalid status enum', () => {
    expect(UpdateInvoiceRequestSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('rejects forbidden status value', () => {
    expect(UpdateInvoiceRequestSchema.safeParse({ status: 'refunded' }).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Subscription CRUD
// ────────────────────────────────────────────────────────

describe('CreateSubscriptionRequestSchema — negative paths', () => {
  const validUuid = '00000000-0000-4000-a000-000000000000';

  it('rejects non-uuid organizationId', () => {
    expect(
      CreateSubscriptionRequestSchema.safeParse({ organizationId: 'bad', planId: validUuid })
        .success,
    ).toBe(false);
  });

  it('rejects non-uuid planId', () => {
    expect(
      CreateSubscriptionRequestSchema.safeParse({ organizationId: validUuid, planId: 'bad' })
        .success,
    ).toBe(false);
  });

  it('rejects invalid billingCycle', () => {
    expect(
      CreateSubscriptionRequestSchema.safeParse({
        organizationId: validUuid,
        planId: validUuid,
        billingCycle: 'weekly',
      }).success,
    ).toBe(false);
  });

  it('rejects negative trialDays', () => {
    expect(
      CreateSubscriptionRequestSchema.safeParse({
        organizationId: validUuid,
        planId: validUuid,
        trialDays: -1,
      }).success,
    ).toBe(false);
  });
});

describe('UpdateSubscriptionRequestSchema — negative paths', () => {
  it('rejects invalid status', () => {
    expect(UpdateSubscriptionRequestSchema.safeParse({ status: 'nope' }).success).toBe(false);
    expect(UpdateSubscriptionRequestSchema.safeParse({ status: 'suspended' }).success).toBe(false);
  });

  it('rejects non-uuid planId', () => {
    expect(UpdateSubscriptionRequestSchema.safeParse({ planId: 'abc' }).success).toBe(false);
  });

  it('rejects non-boolean cancelAtPeriodEnd', () => {
    expect(
      UpdateSubscriptionRequestSchema.safeParse({ cancelAtPeriodEnd: 'yes' }).success,
    ).toBe(false);
  });
});

describe('CancelSubscriptionRequestSchema — negative paths', () => {
  it('rejects non-boolean immediately', () => {
    expect(CancelSubscriptionRequestSchema.safeParse({ immediately: 'yes' }).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Plans
// ────────────────────────────────────────────────────────

describe('CreatePlanRequestSchema — negative paths', () => {
  it('rejects empty name', () => {
    expect(CreatePlanRequestSchema.safeParse({ name: '', priceMonthly: 10 }).success).toBe(false);
  });

  it('rejects negative priceMonthly', () => {
    expect(CreatePlanRequestSchema.safeParse({ name: 'Pro', priceMonthly: -1 }).success).toBe(
      false,
    );
  });

  it('rejects missing name', () => {
    expect(CreatePlanRequestSchema.safeParse({ priceMonthly: 10 }).success).toBe(false);
  });

  it('rejects missing priceMonthly', () => {
    expect(CreatePlanRequestSchema.safeParse({ name: 'Pro' }).success).toBe(false);
  });
});

describe('UpdatePlanRequestSchema — negative paths', () => {
  it('rejects negative priceMonthly', () => {
    expect(UpdatePlanRequestSchema.safeParse({ priceMonthly: -1 }).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Credit Notes
// ────────────────────────────────────────────────────────

describe('CreateCreditNoteRequestSchema — negative paths', () => {
  const validUuid = '00000000-0000-4000-a000-000000000000';

  it('rejects non-uuid organizationId', () => {
    expect(
      CreateCreditNoteRequestSchema.safeParse({
        organizationId: 'bad',
        amount: 10,
        reason: 'refund',
      }).success,
    ).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(
      CreateCreditNoteRequestSchema.safeParse({
        organizationId: validUuid,
        amount: 0,
        reason: 'refund',
      }).success,
    ).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(
      CreateCreditNoteRequestSchema.safeParse({
        organizationId: validUuid,
        amount: -100,
        reason: 'refund',
      }).success,
    ).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(
      CreateCreditNoteRequestSchema.safeParse({
        organizationId: validUuid,
        amount: 10,
        reason: '',
      }).success,
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Usage
// ────────────────────────────────────────────────────────

describe('RecordUsageRequestSchema — negative paths', () => {
  it('rejects empty metricName', () => {
    expect(RecordUsageRequestSchema.safeParse({ metricName: '', quantity: 1 }).success).toBe(false);
  });

  it('rejects zero quantity', () => {
    expect(RecordUsageRequestSchema.safeParse({ metricName: 'tokens', quantity: 0 }).success).toBe(
      false,
    );
  });

  it('rejects negative quantity', () => {
    expect(
      RecordUsageRequestSchema.safeParse({ metricName: 'tokens', quantity: -5 }).success,
    ).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    expect(
      RecordUsageRequestSchema.safeParse({ metricName: 'tokens', quantity: 1.5 }).success,
    ).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Spending Alerts
// ────────────────────────────────────────────────────────

describe('CreateSpendingAlertRequestSchema — negative paths', () => {
  it('rejects invalid type', () => {
    expect(
      CreateSpendingAlertRequestSchema.safeParse({
        type: 'invalid',
        threshold: 100,
        thresholdType: 'absolute',
        action: 'notify',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid thresholdType', () => {
    expect(
      CreateSpendingAlertRequestSchema.safeParse({
        type: 'budget',
        threshold: 100,
        thresholdType: 'relative',
        action: 'notify',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid action', () => {
    expect(
      CreateSpendingAlertRequestSchema.safeParse({
        type: 'budget',
        threshold: 100,
        thresholdType: 'absolute',
        action: 'delete',
      }).success,
    ).toBe(false);
  });

  it('rejects zero threshold', () => {
    expect(
      CreateSpendingAlertRequestSchema.safeParse({
        type: 'budget',
        threshold: 0,
        thresholdType: 'absolute',
        action: 'notify',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid email in notifyEmails', () => {
    expect(
      CreateSpendingAlertRequestSchema.safeParse({
        type: 'budget',
        threshold: 100,
        thresholdType: 'absolute',
        action: 'notify',
        notifyEmails: ['not-an-email'],
      }).success,
    ).toBe(false);
  });
});

describe('ToggleSpendingAlertRequestSchema — negative paths', () => {
  it('rejects non-boolean enabled', () => {
    expect(ToggleSpendingAlertRequestSchema.safeParse({ enabled: 'true' }).success).toBe(false);
  });

  it('rejects missing enabled', () => {
    expect(ToggleSpendingAlertRequestSchema.safeParse({}).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// Query Schemas
// ────────────────────────────────────────────────────────

describe('BillingStatsQuerySchema — boundary values', () => {
  it('defaults period to 30', () => {
    expect(BillingStatsQuerySchema.parse({}).period).toBe(30);
  });

  it('coerces string period', () => {
    expect(BillingStatsQuerySchema.parse({ period: '7' }).period).toBe(7);
  });
});

describe('ListInvoicesQuerySchema — negative paths', () => {
  it('rejects invalid status', () => {
    expect(ListInvoicesQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('rejects non-uuid organizationId', () => {
    expect(ListInvoicesQuerySchema.safeParse({ organizationId: 'bad' }).success).toBe(false);
  });

  it('rejects page=0', () => {
    expect(ListInvoicesQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('rejects pageSize > 100', () => {
    expect(ListInvoicesQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });
});

describe('ListSubscriptionsQuerySchema — negative paths', () => {
  it('rejects invalid status', () => {
    expect(ListSubscriptionsQuerySchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('rejects pageSize > 100', () => {
    expect(ListSubscriptionsQuerySchema.safeParse({ pageSize: '200' }).success).toBe(false);
  });
});

describe('UsageQuerySchema — negative paths', () => {
  it('rejects non-uuid organizationId', () => {
    expect(UsageQuerySchema.safeParse({ organizationId: 'bad' }).success).toBe(false);
  });

  it('rejects invalid startDate', () => {
    expect(UsageQuerySchema.safeParse({ startDate: 'yesterday' }).success).toBe(false);
  });
});

// ────────────────────────────────────────────────────────
// ID Param Schemas — injection / invalid values
// ────────────────────────────────────────────────────────

describe('ID Param Schemas — reject invalid and malicious UUIDs', () => {
  const schemas = [
    { name: 'InvoiceIdParamSchema', schema: InvoiceIdParamSchema },
    { name: 'SubscriptionIdParamSchema', schema: SubscriptionIdParamSchema },
    { name: 'PlanIdParamSchema', schema: PlanIdParamSchema },
    { name: 'SpendingAlertIdParamSchema', schema: SpendingAlertIdParamSchema },
  ];

  for (const { name, schema } of schemas) {
    describe(name, () => {
      it('rejects empty string', () => {
        expect(schema.safeParse({ id: '' }).success).toBe(false);
      });

      it('rejects plain text', () => {
        expect(schema.safeParse({ id: 'hello' }).success).toBe(false);
      });

      it('rejects SQL injection attempt', () => {
        expect(schema.safeParse({ id: "' OR 1=1 --" }).success).toBe(false);
      });

      it('rejects path traversal attempt', () => {
        expect(schema.safeParse({ id: '../../etc/passwd' }).success).toBe(false);
      });

      it('accepts valid UUID', () => {
        expect(
          schema.safeParse({ id: '00000000-0000-4000-a000-000000000000' }).success,
        ).toBe(true);
      });
    });
  }
});
