/**
 * Billing Schemas
 * Enterprise SaaS Architecture - Billing & Payment Validation
 */

import { z } from 'zod';

// ==========================================
// SUBSCRIPTION
// ==========================================

export const SubscribeToPlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  paymentMethodId: z.string().optional(),
  couponCode: z.string().max(50).optional(),
});

export type SubscribeToPlanInput = z.infer<typeof SubscribeToPlanSchema>;

export const ChangePlanSchema = z.object({
  newPlanId: z.string().min(1, 'New plan ID is required'),
  prorate: z.boolean().optional().default(true),
});

export type ChangePlanInput = z.infer<typeof ChangePlanSchema>;

// ==========================================
// PAYMENT METHOD
// ==========================================

export const AddPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  setAsDefault: z.boolean().optional().default(false),
});

export type AddPaymentMethodInput = z.infer<typeof AddPaymentMethodSchema>;

// ==========================================
// BILLING ALERTS
// ==========================================

export const UpdateBillingAlertsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  usageAlertThreshold: z.number().min(0).max(100).optional(),
  budgetAlertThreshold: z.number().min(0).optional(),
  invoiceReminders: z.boolean().optional(),
  paymentFailureAlerts: z.boolean().optional(),
});

export type UpdateBillingAlertsInput = z.infer<typeof UpdateBillingAlertsSchema>;

// ==========================================
// TAX SETTINGS
// ==========================================

export const UpdateTaxSettingsSchema = z.object({
  taxId: z.string().max(50).optional(),
  taxIdType: z.enum(['vat', 'gst', 'ein', 'other']).optional(),
  businessName: z.string().max(255).optional(),
  address: z
    .object({
      line1: z.string().max(255),
      line2: z.string().max(255).optional(),
      city: z.string().max(100),
      state: z.string().max(100).optional(),
      postalCode: z.string().max(20),
      country: z.string().length(2), // ISO country code
    })
    .optional(),
  exemptFromTax: z.boolean().optional(),
});

export type UpdateTaxSettingsInput = z.infer<typeof UpdateTaxSettingsSchema>;

// ==========================================
// DISCOUNT CODE
// ==========================================

export const ValidateDiscountCodeSchema = z.object({
  code: z.string().min(1).max(50),
  planId: z.string().optional(),
});

export type ValidateDiscountCodeInput = z.infer<typeof ValidateDiscountCodeSchema>;

// ==========================================
// SEAT MANAGEMENT
// ==========================================

export const PurchaseSeatsSchema = z.object({
  quantity: z.number().int().min(1).max(1000),
  paymentMethodId: z.string().optional(),
});

export type PurchaseSeatsInput = z.infer<typeof PurchaseSeatsSchema>;

export const AutoAddSeatsSchema = z.object({
  enabled: z.boolean(),
  threshold: z.number().int().min(1).max(100).optional(),
  maxAutoAdd: z.number().int().min(1).max(100).optional(),
});

export type AutoAddSeatsInput = z.infer<typeof AutoAddSeatsSchema>;

// ==========================================
// BUDGET
// ==========================================

export const SetBudgetSchema = z.object({
  monthlyLimit: z.number().min(0).max(1000000).optional(),
  hardLimit: z.boolean().optional().default(false),
  alertThresholds: z.array(z.number().min(0).max(100)).max(5).optional(),
  notifyUsers: z.array(z.string().uuid()).optional(),
  currency: z.string().length(3).optional().default('USD'),
});

export type SetBudgetInput = z.infer<typeof SetBudgetSchema>;

// ==========================================
// TOKEN PURCHASE
// ==========================================

export const PurchaseTokensSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  paymentMethodId: z.string().optional(),
});

export type PurchaseTokensInput = z.infer<typeof PurchaseTokensSchema>;

// ==========================================
// API KEY BILLING
// ==========================================

export const AddApiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'mistral']),
  apiKey: z.string().min(10).max(200),
  displayName: z.string().min(1).max(100),
  modelPreference: z.string().optional(),
});

export type AddApiKeyInput = z.infer<typeof AddApiKeySchema>;
