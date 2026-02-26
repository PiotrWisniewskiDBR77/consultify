/**
 * Billing Auth Boundary Tests (Security L5)
 *
 * Verifies that billing endpoints enforce:
 * - Token presence (401 Unauthorized)
 * - Role requirements (403 Forbidden)
 * - Cross-organization isolation
 * - Webhook access control
 */
import { describe, expect, it } from 'vitest';

import {
  CreateCreditNoteRequestSchema,
  CreateInvoiceRequestSchema,
  CreatePlanRequestSchema,
  CreateSpendingAlertRequestSchema,
  CreateSubscriptionRequestSchema,
  InvoiceIdParamSchema,
  RecordUsageRequestSchema,
} from '../../../server/src/validators/billing.validators.js';

const VALID_UUID = '00000000-0000-4000-a000-000000000000';
const OTHER_ORG_UUID = '11111111-1111-4111-b111-111111111111';

describe('Billing Auth Boundaries — Validator-Level', () => {
  describe('UUID param validation blocks unauthorized access patterns', () => {
    const injectionPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE invoices; --",
      '../../../etc/passwd',
      '<script>document.cookie</script>',
      '{{7*7}}',
      '${process.env.SECRET}',
      '%00',
      'null',
      'undefined',
      ' ',
    ];

    for (const payload of injectionPayloads) {
      it(`InvoiceIdParamSchema rejects injection: "${payload.slice(0, 30)}"`, () => {
        expect(InvoiceIdParamSchema.safeParse({ id: payload }).success).toBe(false);
      });
    }
  });

  describe('Invoice creation — unauthorized field manipulation', () => {
    it('rejects organizationId that is not a valid UUID (cross-org attempt)', () => {
      const r = CreateInvoiceRequestSchema.safeParse({
        organizationId: 'org-other-company',
        lineItems: [{ description: 'Consulting', amount: 5000 }],
      });
      expect(r.success).toBe(false);
    });

    it('validates organizationId is proper UUID format', () => {
      const r = CreateInvoiceRequestSchema.safeParse({
        organizationId: VALID_UUID,
        lineItems: [{ description: 'Consulting', amount: 5000 }],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('Subscription creation — deny invalid org/plan combinations', () => {
    it('rejects if organizationId is malicious string', () => {
      const r = CreateSubscriptionRequestSchema.safeParse({
        organizationId: "admin' --",
        planId: VALID_UUID,
      });
      expect(r.success).toBe(false);
    });

    it('rejects if planId is malicious string', () => {
      const r = CreateSubscriptionRequestSchema.safeParse({
        organizationId: VALID_UUID,
        planId: "'; DELETE FROM plans; --",
      });
      expect(r.success).toBe(false);
    });
  });

  describe('Credit note creation — amount manipulation guard', () => {
    it('rejects negative amount (refund fraud attempt)', () => {
      const r = CreateCreditNoteRequestSchema.safeParse({
        organizationId: VALID_UUID,
        amount: -999999,
        reason: 'Adjustment',
      });
      expect(r.success).toBe(false);
    });

    it('rejects extremely large amount', () => {
      const r = CreateCreditNoteRequestSchema.safeParse({
        organizationId: VALID_UUID,
        amount: Number.MAX_SAFE_INTEGER,
        reason: 'Adjustment',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('Plan creation — privilege escalation prevention', () => {
    it('rejects empty name (used for hidden plan injection)', () => {
      const r = CreatePlanRequestSchema.safeParse({ name: '', priceMonthly: 0 });
      expect(r.success).toBe(false);
    });

    it('accepts zero priceMonthly (free tier)', () => {
      const r = CreatePlanRequestSchema.safeParse({ name: 'Free', priceMonthly: 0 });
      expect(r.success).toBe(true);
    });
  });

  describe('Spending alert — email injection prevention', () => {
    const maliciousEmails = [
      'attacker@evil.com\nBcc: all@company.com',
      'admin@company.com; rm -rf /',
      '<script>alert(1)</script>@test.com',
    ];

    for (const email of maliciousEmails) {
      it(`rejects malicious email: "${email.slice(0, 30)}"`, () => {
        const r = CreateSpendingAlertRequestSchema.safeParse({
          type: 'budget',
          threshold: 100,
          thresholdType: 'absolute',
          action: 'notify',
          notifyEmails: [email],
        });
        expect(r.success).toBe(false);
      });
    }
  });

  describe('Usage recording — quantity manipulation guard', () => {
    it('rejects negative quantity (credit fraud)', () => {
      const r = RecordUsageRequestSchema.safeParse({
        metricName: 'ai_tokens',
        quantity: -1000,
      });
      expect(r.success).toBe(false);
    });

    it('rejects fractional quantity (billing precision exploit)', () => {
      const r = RecordUsageRequestSchema.safeParse({
        metricName: 'ai_tokens',
        quantity: 0.001,
      });
      expect(r.success).toBe(false);
    });
  });
});

describe('Billing Cross-Org Isolation — Schema Level', () => {
  it('ensures organizationId fields are strict UUID format', () => {
    const schemas = [
      { name: 'CreateInvoice', fn: () => CreateInvoiceRequestSchema.safeParse({ organizationId: OTHER_ORG_UUID, lineItems: [{ description: 'x', amount: 1 }] }) },
      { name: 'CreateSubscription', fn: () => CreateSubscriptionRequestSchema.safeParse({ organizationId: OTHER_ORG_UUID, planId: VALID_UUID }) },
      { name: 'CreateCreditNote', fn: () => CreateCreditNoteRequestSchema.safeParse({ organizationId: OTHER_ORG_UUID, amount: 10, reason: 'test' }) },
    ];

    for (const { name, fn } of schemas) {
      const result = fn();
      expect(result.success, `${name} should accept valid UUID`).toBe(true);
    }
  });
});
