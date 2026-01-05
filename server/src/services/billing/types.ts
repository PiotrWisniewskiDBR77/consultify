import type Stripe from 'stripe';

import type { IDatabase } from '../../database/IDatabase.js';

export interface BillingPlan {
    id: string;
    name: string;
    price_monthly: number;
    token_limit?: number;
    storage_limit_gb?: number;
    token_overage_rate?: number;
    storage_overage_rate?: number;
    stripe_price_id?: string;
    features?: Record<string, unknown> | string;
    is_active?: number | boolean;
}

export interface UserLicensePlan {
    id: string;
    name: string;
    price_monthly: number;
    features?: Record<string, unknown>;
    is_active: number | boolean;
    created_at?: string;
}

export interface OrganizationBilling {
    id: string;
    organization_id: string;
    subscription_plan_id?: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    billing_email?: string | null;
    payment_method_last4?: string | null;
    payment_method_brand?: string | null;
    current_period_start?: string | Date | null;
    current_period_end?: string | Date | null;
    status: string;
    created_at?: string;
    updated_at?: string;
    plan_name?: string;
    price_monthly?: number;
    token_limit?: number | null;
    storage_limit_gb?: number | null;
}

export interface Invoice {
    id: string;
    organization_id: string;
    stripe_invoice_id?: string | null;
    amount_due: number;
    amount_paid: number;
    currency: string;
    status: string;
    period_start: string | Date;
    period_end: string | Date;
    pdf_url?: string | null;
    created_at?: string;
}

export interface PaymentMethod {
    id: string;
    organization_id: string;
    stripe_payment_method_id: string;
    type: string;
    brand: string;
    last4: string;
    exp_month?: number | null;
    exp_year?: number | null;
    holder_name?: string | null;
    is_default: number | boolean;
    created_at?: string;
    updated_at?: string;
}

export interface BillingAlert {
    id?: string;
    organization_id: string;
    token_threshold_80: number;
    token_threshold_90: number;
    token_threshold_100: number;
    storage_threshold_80: number;
    storage_threshold_90: number;
    storage_threshold_100: number;
    auto_upgrade_enabled: number | boolean;
    auto_upgrade_plan_id?: string | null;
    cost_cap_monthly?: number | null;
    email_notifications: number | boolean;
    created_at?: string;
    updated_at?: string;
}

export interface TaxSettings {
    id?: string;
    organization_id: string;
    tax_id?: string | null;
    tax_id_type?: string | null;
    tax_exempt: number | boolean;
    billing_name?: string | null;
    billing_email?: string | null;
    billing_address_line1?: string | null;
    billing_address_line2?: string | null;
    billing_city?: string | null;
    billing_state?: string | null;
    billing_postal_code?: string | null;
    billing_country?: string | null;
    invoice_prefix?: string | null;
    po_number?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface DiscountCode {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    currency: string;
    applicable_plans?: string | null;
    valid_from?: string | null;
    valid_until?: string | null;
    max_uses?: number | null;
    current_uses: number;
    is_active: number | boolean;
}

export interface DiscountValidationResult {
    valid: boolean;
    error?: string;
    discount?: {
        id: string;
        code: string;
        type: string;
        value: number;
        currency: string;
    };
}

export interface CreateUserPlanData {
    name: string;
    price_monthly: number;
    features?: Record<string, unknown>;
}

export interface UpdateUserPlanData {
    name?: string;
    price_monthly?: number;
    features?: Record<string, unknown> | string;
    is_active?: number | boolean;
}

export interface CreatePlanData {
    name: string;
    price_monthly: number;
    token_limit?: number;
    storage_limit_gb?: number;
    token_overage_rate?: number;
    storage_overage_rate?: number;
    stripe_price_id?: string;
    features?: Record<string, unknown>;
}

export interface UpdatePlanData {
    name?: string;
    price_monthly?: number;
    token_limit?: number;
    storage_limit_gb?: number;
    token_overage_rate?: number;
    storage_overage_rate?: number;
    stripe_price_id?: string;
    features?: Record<string, unknown> | string;
    is_active?: number | boolean;
}

export interface UpsertBillingData {
    subscription_plan_id?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    billing_email?: string;
    status?: string;
    current_period_start?: Date;
    current_period_end?: Date;
}

export interface UpdateBillingAlertsData {
    token_threshold_80?: number;
    token_threshold_90?: number;
    token_threshold_100?: number;
    storage_threshold_80?: number;
    storage_threshold_90?: number;
    storage_threshold_100?: number;
    auto_upgrade_enabled?: number | boolean;
    auto_upgrade_plan_id?: string | null;
    cost_cap_monthly?: number | null;
    email_notifications?: number | boolean;
}

export interface SetupIntent {
    clientSecret: string;
    id: string;
}

export interface BillingModel {
    billingModel: string;
}

export interface SeatPricing {
    seats_included: number;
    seat_price_monthly: number;
    max_seats: number;
}

export interface SeatCost {
    unitPrice: number;
    totalCost: number;
    quantity: number;
}

export interface RevenueStats {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    planDistribution: { name: string; price_monthly: number; count: number }[];
}

export interface BillingServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
    stripe: Stripe | null;
}
export type _BillingPlan = BillingPlan;
export type _SetupIntent = SetupIntent;

export interface UpdateTaxSettingsData {
    tax_id?: string;
    tax_id_type?: string;
    tax_exempt?: number | boolean;
    billing_name?: string;
    billing_email?: string;
    billing_address_line1?: string;
    billing_address_line2?: string;
    billing_city?: string;
    billing_state?: string;
    billing_postal_code?: string;
    billing_country?: string;
    invoice_prefix?: string;
    po_number?: string;
}
