/**
 * Billing Spending Alerts — Component Test
 *
 * Verifies that spending-alert related validators produce
 * correct defaults and reject invalid configurations.
 * Acts as a component-level boundary test for the billing UI layer.
 */
import { describe, expect, it } from 'vitest';

import {
  CreateSpendingAlertRequestSchema,
  ToggleSpendingAlertRequestSchema,
  UpdateSpendingAlertRequestSchema,
} from '../../../server/src/validators/billing.validators.js';

describe('Billing Spending Alerts — component validation', () => {
  describe('CreateSpendingAlertRequestSchema', () => {
    const validAlert = {
      type: 'budget' as const,
      threshold: 500,
      thresholdType: 'absolute' as const,
      action: 'notify' as const,
      notifyEmails: ['admin@company.com'],
      isActive: true,
    };

    it('accepts valid spending alert configuration', () => {
      const r = CreateSpendingAlertRequestSchema.safeParse(validAlert);
      expect(r.success).toBe(true);
    });

    it('defaults isActive to true', () => {
      const { isActive, ...rest } = validAlert;
      const r = CreateSpendingAlertRequestSchema.parse(rest);
      expect(r.isActive).toBe(true);
    });

    it('defaults notifyEmails to empty array', () => {
      const { notifyEmails, ...rest } = validAlert;
      const r = CreateSpendingAlertRequestSchema.parse(rest);
      expect(r.notifyEmails).toEqual([]);
    });

    it('supports all alert types', () => {
      for (const type of ['budget', 'usage', 'threshold'] as const) {
        const r = CreateSpendingAlertRequestSchema.safeParse({ ...validAlert, type });
        expect(r.success, `type=${type}`).toBe(true);
      }
    });

    it('supports all threshold types', () => {
      for (const thresholdType of ['absolute', 'percentage'] as const) {
        const r = CreateSpendingAlertRequestSchema.safeParse({ ...validAlert, thresholdType });
        expect(r.success, `thresholdType=${thresholdType}`).toBe(true);
      }
    });

    it('supports all actions', () => {
      for (const action of ['notify', 'suspend', 'limit'] as const) {
        const r = CreateSpendingAlertRequestSchema.safeParse({ ...validAlert, action });
        expect(r.success, `action=${action}`).toBe(true);
      }
    });

    it('validates email addresses in notifyEmails', () => {
      const r = CreateSpendingAlertRequestSchema.safeParse({
        ...validAlert,
        notifyEmails: ['valid@email.com', 'invalid-email'],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateSpendingAlertRequestSchema', () => {
    it('accepts partial updates', () => {
      expect(UpdateSpendingAlertRequestSchema.safeParse({ threshold: 200 }).success).toBe(true);
    });

    it('accepts empty update (all optional)', () => {
      expect(UpdateSpendingAlertRequestSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('ToggleSpendingAlertRequestSchema', () => {
    it('accepts true', () => {
      expect(ToggleSpendingAlertRequestSchema.safeParse({ enabled: true }).success).toBe(true);
    });

    it('accepts false', () => {
      expect(ToggleSpendingAlertRequestSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    it('rejects missing enabled', () => {
      expect(ToggleSpendingAlertRequestSchema.safeParse({}).success).toBe(false);
    });
  });
});
