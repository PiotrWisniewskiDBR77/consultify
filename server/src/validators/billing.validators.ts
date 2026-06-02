/**
 * Billing Route Validators
 * Zod schemas for billing request validation
 */

import { z } from 'zod';

// Invoice Line Item
export const InvoiceLineItemSchema = z
  .object({
    description: z.string().min(1),
    amount: z.number().positive().optional(),
    quantity: z.number().int().positive().default(1),
    unitPrice: z.number().positive().optional(),
  })
  .refine((item) => item.amount !== undefined || item.unitPrice !== undefined, {
    message: 'Each line item requires amount or unitPrice',
  });

// Create Invoice Request
export const CreateInvoiceRequestSchema = z.object({
  organizationId: z.string().uuid(),
  lineItems: z.array(InvoiceLineItemSchema).min(1),
  currency: z.string().default('USD'),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Update Invoice Request
export const UpdateInvoiceRequestSchema = z.object({
  status: z.enum(['draft', 'open', 'paid', 'past_due', 'void']).optional(),
  lineItems: z.array(InvoiceLineItemSchema).optional(),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Create Subscription Request
export const CreateSubscriptionRequestSchema = z.object({
  organizationId: z.string().uuid(),
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  trialDays: z.number().int().min(0).default(0),
});

// Update Subscription Request
export const UpdateSubscriptionRequestSchema = z.object({
  status: z.enum(['active', 'past_due', 'canceled', 'trialing']).optional(),
  planId: z.string().uuid().optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

// Cancel Subscription Request
export const CancelSubscriptionRequestSchema = z.object({
  immediately: z.boolean().default(false),
});

// ==========================================
// ORG SELF-SERVE SUBSCRIPTION ACTIONS (Stripe-backed)
// ==========================================

export const SubscribeToPlanRequestSchema = z.object({
  planId: z.string().min(1),
  paymentMethodId: z.string().min(1).optional(),
});

export const ChangePlanRequestSchema = z.object({
  newPlanId: z.string().min(1),
});

// Create Subscription Plan Request
export const CreatePlanRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceMonthly: z.number().nonnegative(),
  priceYearly: z.number().nonnegative().optional(),
  currency: z.string().default('USD'),
  features: z.array(z.string()).default([]),
  limits: z.record(z.string(), z.unknown()).default({}),
  trialDays: z.number().int().min(0).default(0),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// Update Plan Request
export const UpdatePlanRequestSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    priceMonthly: z.number().nonnegative(),
    priceYearly: z.number().nonnegative().optional(),
    currency: z.string(),
    features: z.array(z.string()),
    limits: z.record(z.string(), z.unknown()),
    trialDays: z.number().int().min(0),
    isPublic: z.boolean(),
    sortOrder: z.number().int(),
    isActive: z.boolean(),
  })
  .partial();

// Create Credit Note Request
export const CreateCreditNoteRequestSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1),
  invoiceId: z.string().uuid().optional(),
});

// Record Usage Request
export const RecordUsageRequestSchema = z.object({
  metricName: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Create Spending Alert Request
export const CreateSpendingAlertRequestSchema = z.object({
  type: z.enum(['budget', 'usage', 'threshold']),
  threshold: z.number().positive(),
  thresholdType: z.enum(['absolute', 'percentage']),
  action: z.enum(['notify', 'suspend', 'limit']),
  notifyEmails: z.array(z.string().email()).default([]),
  isActive: z.boolean().default(true),
});

// Update Spending Alert Request
export const UpdateSpendingAlertRequestSchema = CreateSpendingAlertRequestSchema.partial();

// Toggle Spending Alert Request
export const ToggleSpendingAlertRequestSchema = z.object({
  enabled: z.boolean(),
});

// Query Params
export const BillingStatsQuerySchema = z.object({
  period: z.coerce.number().default(30),
});

export const ListInvoicesQuerySchema = z.object({
  status: z.enum(['draft', 'open', 'paid', 'past_due', 'void']).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export const ListSubscriptionsQuerySchema = z.object({
  status: z.enum(['active', 'past_due', 'canceled', 'trialing']).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export const ListPlansQuerySchema = z.object({
  includeInactive: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
});

export const UsageQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  metric: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ID Params
export const InvoiceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const SubscriptionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const PlanIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const CreditNoteIdParamSchema = z.object({
  creditNoteId: z.string().uuid(),
});

export const SpendingAlertIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ==========================================
// USAGE PRICING TIERS
// ==========================================

export const CreateUsagePricingTierSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  pricePerUnit: z.number().nonnegative(),
  currency: z.string().default('USD'),
  tierType: z.string().default('standard'),
  minQuantity: z.number().int().nonnegative().default(0),
  maxQuantity: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateUsagePricingTierSchema = CreateUsagePricingTierSchema.partial();

export const UsagePricingTierIdParamSchema = z.object({
  id: z.string().min(1),
});

// Type exports
export type CreateUsagePricingTierRequest = z.infer<typeof CreateUsagePricingTierSchema>;
export type UpdateUsagePricingTierRequest = z.infer<typeof UpdateUsagePricingTierSchema>;
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;
export type UpdateInvoiceRequest = z.infer<typeof UpdateInvoiceRequestSchema>;
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionRequestSchema>;
export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionRequestSchema>;
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>;
export type SubscribeToPlanRequest = z.infer<typeof SubscribeToPlanRequestSchema>;
export type ChangePlanRequest = z.infer<typeof ChangePlanRequestSchema>;
export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;
export type CreateCreditNoteRequest = z.infer<typeof CreateCreditNoteRequestSchema>;
export type RecordUsageRequest = z.infer<typeof RecordUsageRequestSchema>;
export type CreateSpendingAlertRequest = z.infer<typeof CreateSpendingAlertRequestSchema>;
export type UpdateSpendingAlertRequest = z.infer<typeof UpdateSpendingAlertRequestSchema>;
export type ToggleSpendingAlertRequest = z.infer<typeof ToggleSpendingAlertRequestSchema>;
export type InvoiceIdParam = z.infer<typeof InvoiceIdParamSchema>;
export type SubscriptionIdParam = z.infer<typeof SubscriptionIdParamSchema>;
export type PlanIdParam = z.infer<typeof PlanIdParamSchema>;
export type CreditNoteIdParam = z.infer<typeof CreditNoteIdParamSchema>;
export type SpendingAlertIdParam = z.infer<typeof SpendingAlertIdParamSchema>;
