/**
 * Billing Domain Types
 * Enterprise SaaS Architecture - Billing & Subscription Types
 */

// ==========================================
// SUBSCRIPTION TYPES
// ==========================================

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'cancelled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';

export type BillingInterval = 'monthly' | 'yearly' | 'one_time';

/**
 * Subscription plan
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: PlanTier;
  description?: string;
  features: PlanFeature[];
  pricing: PlanPricing[];
  limits: PlanLimits;
  isActive: boolean;
  isPublic: boolean;
  trialDays?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  isIncluded: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanPricing {
  id: string;
  interval: BillingInterval;
  amount: number;
  currency: string;
  stripePriceId?: string;
  discount?: number;
}

export interface PlanLimits {
  users: number;
  projects: number;
  storage: number; // in MB
  aiTokensPerMonth: number;
  apiCallsPerMonth?: number;
  customIntegrations?: number;
  ssoEnabled?: boolean;
  advancedAnalytics?: boolean;
  prioritySupport?: boolean;
  whitelabel?: boolean;
}

/**
 * Organization subscription
 */
export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  plan?: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd?: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  pausedAt?: string;
  resumeAt?: string;
  quantity: number; // seats
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  metadata?: SubscriptionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionMetadata {
  source?: 'website' | 'api' | 'admin' | 'migration';
  campaignId?: string;
  referralCode?: string;
  customDeal?: boolean;
}

// ==========================================
// PAYMENT TYPES
// ==========================================

export type PaymentMethodType = 'card' | 'bank_account' | 'sepa_debit' | 'paypal';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'disputed';

/**
 * Payment method
 */
export interface PaymentMethod {
  id: string;
  organizationId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  stripePaymentMethodId?: string;
  card?: CardDetails;
  bankAccount?: BankAccountDetails;
  billingAddress?: BillingAddress;
  createdAt: string;
  updatedAt: string;
}

export interface CardDetails {
  brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  fingerprint?: string;
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
  country?: string;
}

export interface BankAccountDetails {
  bankName: string;
  last4: string;
  accountHolderType: 'individual' | 'company';
  country: string;
  currency: string;
}

export interface BillingAddress {
  name?: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

/**
 * Payment/charge record
 */
export interface Payment {
  id: string;
  organizationId: string;
  subscriptionId?: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodId?: string;
  stripePaymentIntentId?: string;
  description?: string;
  failureReason?: string;
  refundedAmount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// INVOICE TYPES
// ==========================================

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

/**
 * Invoice
 */
export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId?: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amount_paid?: number; // Alias for amountPaid
  amountDue: number;
  dueDate?: string;
  paidAt?: string;
  created_at?: string; // Alias for createdAt
  stripeInvoiceId?: string;
  items: InvoiceItem[];
  discounts?: InvoiceDiscount[];
  billingAddress?: BillingAddress;
  pdfUrl?: string;
  downloadUrl?: string; // Alias for pdfUrl
  hostedInvoiceUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: string;
  period?: {
    start: string;
    end: string;
  };
  proration?: boolean;
}

export interface InvoiceDiscount {
  id: string;
  couponId?: string;
  couponName?: string;
  amount: number;
  percentage?: number;
}

// ==========================================
// TOKEN & USAGE TYPES
// ==========================================

export type TokenTransactionType =
  | 'purchase'
  | 'usage'
  | 'refund'
  | 'bonus'
  | 'allocation'
  | 'expiry';

/**
 * Token balance
 */
export interface TokenBalance {
  organizationId: string;
  available: number;
  used: number;
  reserved: number;
  limit: number;
  resetDate?: string;
  lastUpdated: string;
}

/**
 * Token transaction
 */
export interface TokenTransaction {
  id: string;
  organizationId: string;
  userId?: string;
  type: TokenTransactionType;
  amount: number;
  balance: number;
  description: string;
  provider?: string;
  model?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Token package for purchase
 */
export interface TokenPackage {
  id: string;
  name: string;
  description?: string;
  tokens: number;
  price: number;
  currency: string;
  discount?: number;
  isActive: boolean;
  stripePriceId?: string;
  expiryDays?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Usage metrics
 */
export interface UsageMetrics {
  organizationId: string;
  period: {
    start: string;
    end: string;
  };
  seats: {
    used: number;
    limit: number;
    percentage: number;
  };
  storage: {
    used: number; // bytes
    limit: number;
    percentage: number;
  };
  aiTokens: {
    used: number;
    limit: number;
    percentage: number;
    cost: number;
  };
  apiCalls?: {
    used: number;
    limit: number;
    percentage: number;
  };
  projects: {
    active: number;
    limit: number;
    percentage: number;
  };
}

// ==========================================
// BUDGET & ALERT TYPES
// ==========================================

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AlertType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'payment_failed'
  | 'subscription_expiring'
  | 'usage_limit';

/**
 * Budget configuration
 */
export interface Budget {
  id: string;
  organizationId: string;
  userId?: string;
  projectId?: string;
  type: 'ai_tokens' | 'spending' | 'api_calls';
  amount: number;
  period: BudgetPeriod;
  currentUsage: number;
  alertThreshold: number; // percentage
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Billing alert
 */
export interface BillingAlert {
  id: string;
  organizationId: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  isRead: boolean;
  isDismissed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
}

// ==========================================
// SEAT MANAGEMENT TYPES
// ==========================================

export type SeatStatus = 'active' | 'pending' | 'released';

/**
 * Seat allocation
 */
export interface Seat {
  id: string;
  organizationId: string;
  userId?: string;
  email?: string;
  status: SeatStatus;
  allocatedAt?: string;
  releasedAt?: string;
  invitedAt?: string;
  expiresAt?: string;
}

/**
 * Seat configuration
 */
export interface SeatConfiguration {
  organizationId: string;
  totalSeats: number;
  usedSeats: number;
  pendingSeats: number;
  availableSeats: number;
  autoAddSeats: boolean;
  maxAutoAddSeats?: number;
  pricePerSeat?: number;
  currency?: string;
}

// ==========================================
// TAX TYPES
// ==========================================

/**
 * Tax settings
 */
export interface TaxSettings {
  organizationId: string;
  taxId?: string;
  taxIdType?: 'vat' | 'gst' | 'ein' | 'other';
  taxExempt: boolean;
  taxExemptionCertificate?: string;
  country: string;
  region?: string;
  defaultTaxRate?: number;
  updatedAt: string;
}

/**
 * Tax rate
 */
export interface TaxRate {
  id: string;
  country: string;
  region?: string;
  rate: number;
  name: string;
  description?: string;
  inclusive: boolean;
  stripeTaxRateId?: string;
}

// ==========================================
// DISCOUNT & COUPON TYPES
// ==========================================

export type DiscountType = 'percentage' | 'fixed_amount';

export type CouponDuration = 'once' | 'repeating' | 'forever';

/**
 * Coupon/discount code
 */
export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: DiscountType;
  amount: number;
  currency?: string;
  duration: CouponDuration;
  durationInMonths?: number;
  maxRedemptions?: number;
  timesRedeemed: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  appliesTo?: string[]; // plan IDs
  stripeCouponId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Applied discount
 */
export interface AppliedDiscount {
  id: string;
  organizationId: string;
  couponId: string;
  coupon?: Coupon;
  subscriptionId?: string;
  appliedAt: string;
  endsAt?: string;
  amountSaved: number;
}
