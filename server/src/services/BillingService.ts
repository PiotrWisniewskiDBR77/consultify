/**
 * Billing Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles Stripe integration, subscriptions, and invoice management
 * 
 * Full TypeScript migration from billingService.js
 */

import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';
import type Stripe from 'stripe';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface BillingPlan {
    id: string;
    name: string;
    price_monthly: number;
    token_limit?: number | null;
    storage_limit_gb?: number | null;
    token_overage_rate?: number | null;
    storage_overage_rate?: number | null;
    stripe_price_id?: string | null;
    features?: Record<string, unknown>;
    is_active: number | boolean;
    created_at?: string;
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
    billing_address?: string | null;
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

export interface RevenueStats {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    planDistribution: Array<{
        name: string;
        price_monthly: number;
        count: number;
    }>;
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

export interface BillingModel {
    billingModel: string;
}

export interface SetupIntent {
    clientSecret: string;
    id: string;
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

export interface UpdateTaxSettingsData {
    tax_id?: string | null;
    tax_id_type?: string | null;
    tax_exempt?: number | boolean;
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
}

// Dependency injection interface for testing
export interface BillingServiceDependencies {
    db: IDatabase;
    uuidv4: () => string;
    stripe: Stripe | null;
    getPlanById: (planId: string) => Promise<BillingPlan | null>;
    getOrganizationBilling: (orgId: string) => Promise<OrganizationBilling | null>;
    upsertOrgBilling: (orgId: string, billingData: UpsertBillingData) => Promise<OrganizationBilling>;
    getOrCreateStripeCustomer: (orgId: string, email: string, orgName: string) => Promise<Stripe.Customer | { id: string; email: string }>;
    calculateSeatCost: (orgId: string, quantity: number) => Promise<SeatCost>;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class BillingServiceClass {
    #deps: BillingServiceDependencies | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor() {
        // Dependencies will be initialized lazily via #initDeps
    }

    /**
     * Initialize dependencies lazily
     */
    async #initDeps(): Promise<void> {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            try {
                const { getDatabase } = await import('../database/Database.js');
                const { v4: uuidv4 } = await import('uuid');
                const { default: Stripe } = await import('stripe');

                const db = getDatabase();

                let stripe: Stripe | null = null;
                if (process.env.STRIPE_SECRET_KEY) {
                    try {
                        stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                            apiVersion: '2025-12-15.clover' as any,
                        });
                    } catch (e) {
                        logger.warn('Stripe not initialized - API key not configured');
                    }
                }

                this.#deps = {
                    db,
                    uuidv4,
                    stripe,
                    getPlanById: this.getPlanById.bind(this),
                    getOrganizationBilling: this.getOrganizationBilling.bind(this),
                    upsertOrgBilling: this.upsertOrgBilling.bind(this),
                    getOrCreateStripeCustomer: this.getOrCreateStripeCustomer.bind(this),
                    calculateSeatCost: this.calculateSeatCost.bind(this),
                };

                this.#initialized = true;
            } catch (error) {
                logger.error('Failed to initialize BillingService dependencies:', error as Error);
                throw error;
            } finally {
                this.#initPromise = null;
            }
        })();

        return this.#initPromise;
    }

    /**
     * Get dependencies (honoring manual overrides for testing)
     */
    async #getDeps(): Promise<BillingServiceDependencies> {
        await this.#initDeps();
        if (!this.#deps) throw new Error('BillingService dependencies not initialized');
        return this.#deps;
    }

    /**
     * Set dependencies (for testing)
     */
    async setDependencies(newDeps: Partial<BillingServiceDependencies>): Promise<void> {
        await this.#initDeps();
        if (this.#deps) {
            this.#deps = { ...this.#deps, ...newDeps };
        }
    }

    // ==========================================
    // SUBSCRIPTION PLANS
    // ==========================================

    async getPlans(): Promise<BillingPlan[]> {
        const deps = await this.#getDeps();
        const rows = await (deps.db.all<BillingPlan>(
            'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC',
            []
        ) as Promise<BillingPlan[]>);
        return rows || [];
    }

    async getPlanById(planId: string): Promise<BillingPlan | null> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<BillingPlan>(
            'SELECT * FROM subscription_plans WHERE id = ?',
            [planId]
        ) as Promise<BillingPlan | null>);
        return row || null;
    }

    async createPlan(planData: CreatePlanData): Promise<BillingPlan> {
        const deps = await this.#getDeps();
        const id = `plan-${deps.uuidv4()}`;
        const featuresJson = JSON.stringify(planData.features || {});

        await (deps.db.run(
            `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                planData.name,
                planData.price_monthly,
                planData.token_limit ?? null,
                planData.storage_limit_gb ?? null,
                planData.token_overage_rate ?? null,
                planData.storage_overage_rate ?? null,
                planData.stripe_price_id ?? null,
                featuresJson,
                1
            ]
        ) as Promise<any>);

        return { id, ...planData, is_active: 1 };
    }

    async updatePlan(planId: string, updates: UpdatePlanData): Promise<{ id: string; changes: number } | null> {
        const deps = await this.#getDeps();
        const fields: string[] = [];
        const values: unknown[] = [];

        const allowedFields = ['name', 'price_monthly', 'token_limit', 'storage_limit_gb', 'token_overage_rate', 'storage_overage_rate', 'stripe_price_id', 'features', 'is_active'];

        for (const field of allowedFields) {
            if (updates[field as keyof UpdatePlanData] !== undefined) {
                fields.push(`${field} = ?`);
                let value = updates[field as keyof UpdatePlanData];
                // Stringify JSON if it's the features field and it's an object
                if (field === 'features' && typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(planId);
        const result: any = await (deps.db.run(
            `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`,
            values
        ) as Promise<any>);

        return { id: planId, changes: result.changes };
    }

    async deletePlan(planId: string): Promise<{ id: string; changes: number } | null> {
        return this.updatePlan(planId, { is_active: 0 });
    }

    // ==========================================
    // USER LICENSE PLANS
    // ==========================================

    async getUserPlans(): Promise<UserLicensePlan[]> {
        const deps = await this.#getDeps();
        const rows = await (deps.db.all<UserLicensePlan>(
            'SELECT * FROM user_license_plans WHERE is_active = 1 ORDER BY price_monthly ASC',
            []
        ) as Promise<UserLicensePlan[]>);
        return rows || [];
    }

    async createUserPlan(planData: CreateUserPlanData): Promise<UserLicensePlan> {
        const deps = await this.#getDeps();
        const id = `license-${deps.uuidv4()}`;
        const featuresJson = JSON.stringify(planData.features || {});

        await (deps.db.run(
            `INSERT INTO user_license_plans (id, name, price_monthly, features, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [id, planData.name, planData.price_monthly, featuresJson, 1]
        ) as Promise<any>);

        return { id, ...planData, is_active: 1 };
    }

    async updateUserPlan(planId: string, updates: UpdateUserPlanData): Promise<{ id: string; changes: number } | null> {
        const deps = await this.#getDeps();
        const fields: string[] = [];
        const values: unknown[] = [];

        const allowedFields = ['name', 'price_monthly', 'features', 'is_active'];

        for (const field of allowedFields) {
            if (updates[field as keyof UpdateUserPlanData] !== undefined) {
                fields.push(`${field} = ?`);
                let value = updates[field as keyof UpdateUserPlanData];
                // Stringify JSON if it's the features field and it's an object
                if (field === 'features' && typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(planId);
        const result: any = await (deps.db.run(
            `UPDATE user_license_plans SET ${fields.join(', ')} WHERE id = ?`,
            values
        ) as Promise<any>);

        return { id: planId, changes: result.changes };
    }

    async deleteUserPlan(planId: string): Promise<{ id: string; changes: number } | null> {
        return this.updateUserPlan(planId, { is_active: 0 });
    }

    // ==========================================
    // ORGANIZATION BILLING
    // ==========================================

    async getOrganizationBilling(orgId: string): Promise<OrganizationBilling | null> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<OrganizationBilling>(
            `SELECT ob.*, sp.name as plan_name, sp.price_monthly, sp.token_limit, sp.storage_limit_gb
             FROM organization_billing ob
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.organization_id = ?`,
            [orgId]
        ) as Promise<OrganizationBilling | null>);
        return row || null;
    }

    async upsertOrgBilling(orgId: string, billingData: UpsertBillingData): Promise<OrganizationBilling> {
        const deps = await this.#getDeps();
        const id = `billing-${deps.uuidv4()}`;

        await (deps.db.run(
            `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, stripe_customer_id, stripe_subscription_id, billing_email, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             subscription_plan_id = excluded.subscription_plan_id,
             stripe_customer_id = COALESCE(excluded.stripe_customer_id, stripe_customer_id),
             stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, stripe_subscription_id),
             billing_email = COALESCE(excluded.billing_email, billing_email),
             status = COALESCE(excluded.status, status),
             updated_at = CURRENT_TIMESTAMP`,
            [
                id,
                orgId,
                billingData.subscription_plan_id ?? null,
                billingData.stripe_customer_id ?? null,
                billingData.stripe_subscription_id ?? null,
                billingData.billing_email ?? null,
                billingData.status || 'active'
            ]
        ) as Promise<any>);

        return { id, organization_id: orgId, status: billingData.status || 'active', ...billingData };
    }

    async getOrCreateStripeCustomer(orgId: string, email: string, orgName: string): Promise<Stripe.Customer | { id: string; email: string }> {
        const deps = await this.#getDeps();
        if (!deps.stripe) {
            logger.warn('Stripe not configured, returning mock customer');
            return { id: `mock_cus_${orgId}`, email };
        }

        const billing = await this.getOrganizationBilling(orgId);

        if (billing?.stripe_customer_id) {
            return await deps.stripe.customers.retrieve(billing.stripe_customer_id) as Stripe.Customer;
        }

        const customer = await deps.stripe.customers.create({
            email,
            name: orgName,
            metadata: { organization_id: orgId }
        });

        await this.upsertOrgBilling(orgId, { stripe_customer_id: customer.id });

        return customer;
    }

    async createSubscription(orgId: string, planId: string, paymentMethodId: string, email: string, orgName: string): Promise<Stripe.Subscription | { id: string; status: string; plan: BillingPlan }> {
        const deps = await this.#getDeps();
        const plan = await this.getPlanById(planId);
        if (!plan) {
            throw new Error('Invalid plan');
        }

        if (!deps.stripe) {
            // Simulate subscription for development/test environments (Stripe key missing)
            await this.upsertOrgBilling(orgId, {
                subscription_plan_id: planId,
                status: 'active'
            });
            return { id: `mock_sub_${orgId}`, status: 'active', plan };
        }

        const customer = await this.getOrCreateStripeCustomer(orgId, email, orgName) as Stripe.Customer;

        // Attach payment method
        await deps.stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await deps.stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: paymentMethodId }
        });

        // Create subscription
        const subscription = await deps.stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: plan.stripe_price_id || '' }],
            expand: ['latest_invoice.payment_intent']
        });

        await this.upsertOrgBilling(orgId, {
            subscription_plan_id: planId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date((subscription as any).current_period_start * 1000),
            current_period_end: new Date((subscription as any).current_period_end * 1000)
        });

        return subscription;
    }

    async cancelSubscription(orgId: string): Promise<Stripe.Subscription | { status: string }> {
        const deps = await this.#getDeps();
        const billing = await this.getOrganizationBilling(orgId);
        if (!billing?.stripe_subscription_id) {
            throw new Error('No active subscription');
        }

        if (!deps.stripe) {
            await this.upsertOrgBilling(orgId, { status: 'canceled' });
            return { status: 'canceled' };
        }

        const subscription = await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
            cancel_at_period_end: true
        });

        await this.upsertOrgBilling(orgId, { status: 'canceling' });

        return subscription;
    }

    async changePlan(orgId: string, newPlanId: string): Promise<{ status: string; plan: BillingPlan }> {
        const deps = await this.#getDeps();
        const billing = await this.getOrganizationBilling(orgId);
        const newPlan = await this.getPlanById(newPlanId);

        if (!newPlan) {
            throw new Error('Invalid plan');
        }

        if (!deps.stripe || !billing?.stripe_subscription_id) {
            await this.upsertOrgBilling(orgId, { subscription_plan_id: newPlanId });
            return { status: 'updated', plan: newPlan };
        }

        const subscription = await deps.stripe.subscriptions.retrieve(billing.stripe_subscription_id);

        await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
            items: [{
                id: subscription.items.data[0].id,
                price: newPlan.stripe_price_id || ''
            }],
            proration_behavior: 'create_prorations'
        });

        await this.upsertOrgBilling(orgId, { subscription_plan_id: newPlanId });

        return { status: 'updated', plan: newPlan };
    }

    // ==========================================
    // INVOICES
    // ==========================================

    async getInvoices(orgId: string): Promise<Invoice[]> {
        const deps = await this.#getDeps();
        const rows = await (deps.db.all<Invoice>(
            'SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC',
            [orgId]
        ) as Promise<Invoice[]>);
        return rows || [];
    }

    async recordInvoice(orgId: string, stripeInvoice: Stripe.Invoice): Promise<{ id: string }> {
        const deps = await this.#getDeps();
        const id = `inv-${deps.uuidv4()}`;

        await (deps.db.run(
            `INSERT OR REPLACE INTO invoices (id, organization_id, stripe_invoice_id, amount_due, amount_paid, currency, status, period_start, period_end, pdf_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                orgId,
                stripeInvoice.id,
                stripeInvoice.amount_due ? stripeInvoice.amount_due / 100 : 0,
                stripeInvoice.amount_paid ? stripeInvoice.amount_paid / 100 : 0,
                stripeInvoice.currency,
                stripeInvoice.status,
                stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : null,
                stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : null,
                stripeInvoice.invoice_pdf || null
            ]
        ) as Promise<any>);

        return { id };
    }

    async getRevenueStats(): Promise<RevenueStats> {
        const deps = await this.#getDeps();
        const stats: RevenueStats = {
            mrr: 0,
            arr: 0,
            activeSubscriptions: 0,
            planDistribution: []
        };

        // Get MRR (Monthly Recurring Revenue)
        const mrrRow = await (deps.db.get<{ mrr: number; active_subscriptions: number }>(
            `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr, COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
            []
        ) as Promise<{ mrr: number; active_subscriptions: number } | null>);

        if (mrrRow) {
            stats.mrr = mrrRow.mrr || 0;
            stats.activeSubscriptions = mrrRow.active_subscriptions || 0;
            stats.arr = stats.mrr * 12;
        }

        // Get plan distribution
        const distributionRows = await (deps.db.all<{ name: string; price_monthly: number; count: number }>(
            `SELECT sp.name, sp.price_monthly, COUNT(ob.id) as count
             FROM subscription_plans sp
             LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id AND ob.status = 'active'
             WHERE sp.is_active = 1
             GROUP BY sp.id`,
            []
        ) as Promise<{ name: string; price_monthly: number; count: number }[]>);

        stats.planDistribution = distributionRows || [];

        return stats;
    }

    // ==========================================
    // PAYMENT METHODS MANAGEMENT
    // ==========================================

    async getPaymentMethods(orgId: string): Promise<PaymentMethod[]> {
        const deps = await this.#getDeps();
        const rows = await (deps.db.all<PaymentMethod>(
            `SELECT * FROM payment_methods WHERE organization_id = ? ORDER BY is_default DESC, created_at DESC`,
            [orgId]
        ) as Promise<PaymentMethod[]>);
        return rows || [];
    }

    async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod | null> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<PaymentMethod>(
            'SELECT * FROM payment_methods WHERE id = ?',
            [paymentMethodId]
        ) as Promise<PaymentMethod | null>);
        return row || null;
    }

    async addPaymentMethod(orgId: string, stripePaymentMethodId: string): Promise<PaymentMethod> {
        const deps = await this.#getDeps();
        const id = `pm-${deps.uuidv4()}`;

        // Get Stripe payment method details
        let pmDetails: {
            type: string;
            brand: string;
            last4: string;
            exp_month: number | null;
            exp_year: number | null;
            holder_name: string | null;
        } = {
            type: 'card',
            brand: 'unknown',
            last4: '****',
            exp_month: null,
            exp_year: null,
            holder_name: null
        };

        if (deps.stripe) {
            try {
                const pm = await deps.stripe.paymentMethods.retrieve(stripePaymentMethodId);
                pmDetails = {
                    type: pm.type,
                    brand: (pm.card?.brand as string) || 'unknown',
                    last4: pm.card?.last4 || '****',
                    exp_month: pm.card?.exp_month || null,
                    exp_year: pm.card?.exp_year || null,
                    holder_name: pm.billing_details?.name || null
                };

                // Attach to customer if we have one
                const billing = await this.getOrganizationBilling(orgId);
                if (billing?.stripe_customer_id) {
                    await (deps.stripe.paymentMethods.attach(stripePaymentMethodId, {
                        customer: billing.stripe_customer_id
                    }) as Promise<any>);
                }
            } catch (e) {
                logger.warn('Could not retrieve Stripe payment method details:', { error: e instanceof Error ? e.message : String(e) });
            }
        }

        // Check if this is the first payment method (make it default)
        const existingMethods = await this.getPaymentMethods(orgId);
        const isDefault = existingMethods.length === 0 ? 1 : 0;

        await (deps.db.run(
            `INSERT INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                orgId,
                stripePaymentMethodId,
                pmDetails.type,
                pmDetails.brand,
                pmDetails.last4,
                pmDetails.exp_month,
                pmDetails.exp_year,
                pmDetails.holder_name,
                isDefault
            ]
        ) as Promise<any>);

        return {
            id,
            organization_id: orgId,
            stripe_payment_method_id: stripePaymentMethodId,
            ...pmDetails,
            is_default: isDefault
        };
    }

    async removePaymentMethod(paymentMethodId: string, orgId: string): Promise<{ deleted: boolean }> {
        const deps = await this.#getDeps();
        const pm = await this.getPaymentMethod(paymentMethodId);
        if (!pm || pm.organization_id !== orgId) {
            throw new Error('Payment method not found');
        }

        // Detach from Stripe
        if (deps.stripe && pm.stripe_payment_method_id) {
            try {
                await deps.stripe.paymentMethods.detach(pm.stripe_payment_method_id);
            } catch (e) {
                logger.warn('Could not detach payment method from Stripe:', { error: e instanceof Error ? e.message : String(e) });
            }
        }

        const result: any = await (deps.db.run(
            'DELETE FROM payment_methods WHERE id = ? AND organization_id = ?',
            [paymentMethodId, orgId]
        ) as Promise<any>);

        return { deleted: result.changes > 0 };
    }

    async setDefaultPaymentMethod(paymentMethodId: string, orgId: string): Promise<{ id: string; is_default: boolean }> {
        const deps = await this.#getDeps();
        const pm = await this.getPaymentMethod(paymentMethodId);
        if (!pm || pm.organization_id !== orgId) {
            throw new Error('Payment method not found');
        }

        // Update Stripe customer default payment method
        if (deps.stripe && pm.stripe_payment_method_id) {
            try {
                const billing = await this.getOrganizationBilling(orgId);
                if (billing?.stripe_customer_id) {
                    await deps.stripe.customers.update(billing.stripe_customer_id, {
                        invoice_settings: { default_payment_method: pm.stripe_payment_method_id }
                    });
                }
            } catch (e) {
                logger.warn('Could not update Stripe default payment method:', { error: e instanceof Error ? e.message : String(e) });
            }
        }

        // First, unset all defaults for this org
        await deps.db.run(
            'UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?',
            [orgId]
        );

        // Then set the new default
        await deps.db.run(
            'UPDATE payment_methods SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [paymentMethodId]
        );

        return { id: paymentMethodId, is_default: true };
    }

    async createSetupIntent(orgId: string, email: string, orgName: string): Promise<SetupIntent> {
        const deps = await this.#getDeps();
        if (!deps.stripe) {
            // Return mock for development
            return {
                clientSecret: `mock_secret_${deps.uuidv4()}`,
                id: `mock_seti_${deps.uuidv4()}`
            };
        }

        const customer = await this.getOrCreateStripeCustomer(orgId, email, orgName) as Stripe.Customer;

        const setupIntent = await deps.stripe.setupIntents.create({
            customer: customer.id,
            payment_method_types: ['card'],
            metadata: { organization_id: orgId }
        });

        return {
            clientSecret: setupIntent.client_secret || '',
            id: setupIntent.id
        };
    }

    // ==========================================
    // BILLING ALERTS & USAGE THRESHOLDS
    // ==========================================

    async getBillingAlerts(orgId: string): Promise<BillingAlert> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<BillingAlert>(
            'SELECT * FROM billing_alerts WHERE organization_id = ?',
            [orgId]
        ) as Promise<BillingAlert | null>);

        if (row) {
            return row;
        }

        // Return defaults
        return {
            organization_id: orgId,
            token_threshold_80: 1,
            token_threshold_90: 1,
            token_threshold_100: 1,
            storage_threshold_80: 1,
            storage_threshold_90: 1,
            storage_threshold_100: 1,
            auto_upgrade_enabled: 0,
            cost_cap_monthly: null,
            email_notifications: 1
        };
    }

    async updateBillingAlerts(orgId: string, alertSettings: UpdateBillingAlertsData): Promise<BillingAlert> {
        const deps = await this.#getDeps();
        const id = `alert-${deps.uuidv4()}`;

        await (deps.db.run(
            `INSERT INTO billing_alerts (id, organization_id, token_threshold_80, token_threshold_90, token_threshold_100,
             storage_threshold_80, storage_threshold_90, storage_threshold_100, auto_upgrade_enabled, auto_upgrade_plan_id,
             cost_cap_monthly, email_notifications)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             token_threshold_80 = excluded.token_threshold_80,
             token_threshold_90 = excluded.token_threshold_90,
             token_threshold_100 = excluded.token_threshold_100,
             storage_threshold_80 = excluded.storage_threshold_80,
             storage_threshold_90 = excluded.storage_threshold_90,
             storage_threshold_100 = excluded.storage_threshold_100,
             auto_upgrade_enabled = excluded.auto_upgrade_enabled,
             auto_upgrade_plan_id = excluded.auto_upgrade_plan_id,
             cost_cap_monthly = excluded.cost_cap_monthly,
             email_notifications = excluded.email_notifications,
             updated_at = CURRENT_TIMESTAMP`,
            [
                id,
                orgId,
                alertSettings.token_threshold_80 ?? 1,
                alertSettings.token_threshold_90 ?? 1,
                alertSettings.token_threshold_100 ?? 1,
                alertSettings.storage_threshold_80 ?? 1,
                alertSettings.storage_threshold_90 ?? 1,
                alertSettings.storage_threshold_100 ?? 1,
                alertSettings.auto_upgrade_enabled ?? 0,
                alertSettings.auto_upgrade_plan_id ?? null,
                alertSettings.cost_cap_monthly ?? null,
                alertSettings.email_notifications ?? 1
            ]
        ) as Promise<any>);

        return { id, organization_id: orgId, ...alertSettings } as BillingAlert;
    }

    // ==========================================
    // TAX SETTINGS
    // ==========================================

    async getTaxSettings(orgId: string): Promise<TaxSettings> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<TaxSettings>(
            'SELECT * FROM billing_tax_settings WHERE organization_id = ?',
            [orgId]
        ) as Promise<TaxSettings | null>);
        return row || { organization_id: orgId, tax_exempt: 0 };
    }

    async updateTaxSettings(orgId: string, taxSettings: UpdateTaxSettingsData): Promise<TaxSettings> {
        const deps = await this.#getDeps();
        const id = `tax-${deps.uuidv4()}`;

        await (deps.db.run(
            `INSERT INTO billing_tax_settings (id, organization_id, tax_id, tax_id_type, tax_exempt,
             billing_name, billing_email, billing_address_line1, billing_address_line2,
             billing_city, billing_state, billing_postal_code, billing_country,
             invoice_prefix, po_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             tax_id = excluded.tax_id,
             tax_id_type = excluded.tax_id_type,
             tax_exempt = excluded.tax_exempt,
             billing_name = excluded.billing_name,
             billing_email = excluded.billing_email,
             billing_address_line1 = excluded.billing_address_line1,
             billing_address_line2 = excluded.billing_address_line2,
             billing_city = excluded.billing_city,
             billing_state = excluded.billing_state,
             billing_postal_code = excluded.billing_postal_code,
             billing_country = excluded.billing_country,
             invoice_prefix = excluded.invoice_prefix,
             po_number = excluded.po_number,
             updated_at = CURRENT_TIMESTAMP`,
            [
                id,
                orgId,
                taxSettings.tax_id ?? null,
                taxSettings.tax_id_type ?? null,
                taxSettings.tax_exempt ?? 0,
                taxSettings.billing_name ?? null,
                taxSettings.billing_email ?? null,
                taxSettings.billing_address_line1 ?? null,
                taxSettings.billing_address_line2 ?? null,
                taxSettings.billing_city ?? null,
                taxSettings.billing_state ?? null,
                taxSettings.billing_postal_code ?? null,
                taxSettings.billing_country ?? null,
                taxSettings.invoice_prefix ?? null,
                taxSettings.po_number ?? null
            ]
        ) as Promise<any>);

        return { id, organization_id: orgId, ...taxSettings } as TaxSettings;
    }

    // ==========================================
    // DISCOUNT CODES
    // ==========================================

    async validateDiscountCode(code: string, planId: string): Promise<DiscountValidationResult> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<DiscountCode>(
            `SELECT * FROM discount_codes 
             WHERE code = ? AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= datetime('now'))
             AND (valid_until IS NULL OR valid_until >= datetime('now'))
             AND (max_uses IS NULL OR current_uses < max_uses)`,
            [code.toUpperCase()]
        ) as Promise<DiscountCode | null>);

        if (!row) {
            return { valid: false, error: 'Invalid or expired discount code' };
        }

        // Check if applicable to this plan
        if (row.applicable_plans) {
            const applicablePlans = JSON.parse(row.applicable_plans) as string[];
            if (!applicablePlans.includes(planId)) {
                return { valid: false, error: 'This code is not valid for the selected plan' };
            }
        }

        return {
            valid: true,
            discount: {
                id: row.id,
                code: row.code,
                type: row.discount_type,
                value: row.discount_value,
                currency: row.currency
            }
        };
    }

    async incrementDiscountCodeUsage(codeId: string): Promise<{ updated: boolean }> {
        const deps = await this.#getDeps();
        const result: any = await (deps.db.run(
            'UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?',
            [codeId]
        ) as Promise<any>);

        return { updated: result.changes > 0 };
    }

    // ==========================================
    // SEAT MANAGEMENT
    // ==========================================

    async getSeatPricing(planId: string): Promise<SeatPricing> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<SeatPricing>(
            'SELECT seats_included, seat_price_monthly, max_seats FROM subscription_plans WHERE id = ?',
            [planId]
        ) as Promise<SeatPricing | null>);

        return row || { seats_included: 0, seat_price_monthly: 0, max_seats: -1 };
    }

    async calculateSeatCost(orgId: string, quantity: number): Promise<SeatCost> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<{ seat_price_monthly: number | null; org_seat_price: number | null }>(
            `SELECT sp.seat_price_monthly, os.seat_price_monthly as org_seat_price
             FROM organization_billing ob
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             LEFT JOIN organization_seats os ON ob.organization_id = os.organization_id
             WHERE ob.organization_id = ?`,
            [orgId]
        ) as Promise<{ seat_price_monthly: number | null; org_seat_price: number | null } | null>);

        const seatPrice = row?.org_seat_price || row?.seat_price_monthly || 0;
        const totalCost = seatPrice * quantity;

        return { unitPrice: seatPrice, totalCost, quantity };
    }

    async processSeatPurchase(orgId: string, quantity: number, paymentMethodId: string): Promise<{
        success: boolean;
        quantity: number;
        unitPrice: number;
        totalCost: number;
        paymentMethodId: string;
    }> {
        const cost = await this.calculateSeatCost(orgId, quantity);

        // In a full implementation, this would create a Stripe invoice item
        // For now, return the cost calculation
        return {
            success: true,
            quantity,
            unitPrice: cost.unitPrice,
            totalCost: cost.totalCost,
            paymentMethodId
        };
    }

    async getBillingModel(orgId: string): Promise<BillingModel> {
        const deps = await this.#getDeps();
        const row = await (deps.db.get<{ billing_model: string | null; plan_billing_model: string | null }>(
            `SELECT os.billing_model, sp.billing_model as plan_billing_model
             FROM organization_seats os
             LEFT JOIN organization_billing ob ON os.organization_id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE os.organization_id = ?`,
            [orgId]
        ) as Promise<{ billing_model: string | null; plan_billing_model: string | null } | null>);

        return {
            billingModel: row?.billing_model || row?.plan_billing_model || 'subscription'
        };
    }
}

// Create singleton instance
const billingServiceInstance = new BillingServiceClass();

// Export individual functions for backward compatibility
export const setDependencies = (newDeps: Partial<BillingServiceDependencies>) => billingServiceInstance.setDependencies(newDeps);
export const getPlans = () => billingServiceInstance.getPlans();
export const getPlanById = (planId: string) => billingServiceInstance.getPlanById(planId);
export const createPlan = (planData: CreatePlanData) => billingServiceInstance.createPlan(planData);
export const updatePlan = (planId: string, updates: UpdatePlanData) => billingServiceInstance.updatePlan(planId, updates);
export const deletePlan = (planId: string) => billingServiceInstance.deletePlan(planId);
export const getOrganizationBilling = (orgId: string) => billingServiceInstance.getOrganizationBilling(orgId);
export const upsertOrganizationBilling = (orgId: string, billingData: UpsertBillingData) => billingServiceInstance.upsertOrgBilling(orgId, billingData);
export const getOrCreateStripeCustomer = (orgId: string, email: string, orgName: string) => billingServiceInstance.getOrCreateStripeCustomer(orgId, email, orgName);
export const createSubscription = (orgId: string, planId: string, paymentMethodId: string, email: string, orgName: string) => billingServiceInstance.createSubscription(orgId, planId, paymentMethodId, email, orgName);
export const cancelSubscription = (orgId: string) => billingServiceInstance.cancelSubscription(orgId);
export const changePlan = (orgId: string, newPlanId: string) => billingServiceInstance.changePlan(orgId, newPlanId);
export const getInvoices = (orgId: string) => billingServiceInstance.getInvoices(orgId);
export const recordInvoice = (orgId: string, stripeInvoice: Stripe.Invoice) => billingServiceInstance.recordInvoice(orgId, stripeInvoice);
export const getRevenueStats = () => billingServiceInstance.getRevenueStats();
export const getUserPlans = () => billingServiceInstance.getUserPlans();
export const createUserPlan = (planData: CreateUserPlanData) => billingServiceInstance.createUserPlan(planData);
export const updateUserPlan = (planId: string, updates: UpdateUserPlanData) => billingServiceInstance.updateUserPlan(planId, updates);
export const deleteUserPlan = (planId: string) => billingServiceInstance.deleteUserPlan(planId);
export const getPaymentMethods = (orgId: string) => billingServiceInstance.getPaymentMethods(orgId);
export const getPaymentMethod = (paymentMethodId: string) => billingServiceInstance.getPaymentMethod(paymentMethodId);
export const addPaymentMethod = (orgId: string, stripePaymentMethodId: string) => billingServiceInstance.addPaymentMethod(orgId, stripePaymentMethodId);
export const removePaymentMethod = (paymentMethodId: string, orgId: string) => billingServiceInstance.removePaymentMethod(paymentMethodId, orgId);
export const setDefaultPaymentMethod = (paymentMethodId: string, orgId: string) => billingServiceInstance.setDefaultPaymentMethod(paymentMethodId, orgId);
export const createSetupIntent = (orgId: string, email: string, orgName: string) => billingServiceInstance.createSetupIntent(orgId, email, orgName);
export const getBillingAlerts = (orgId: string) => billingServiceInstance.getBillingAlerts(orgId);
export const updateBillingAlerts = (orgId: string, alertSettings: UpdateBillingAlertsData) => billingServiceInstance.updateBillingAlerts(orgId, alertSettings);
export const getTaxSettings = (orgId: string) => billingServiceInstance.getTaxSettings(orgId);
export const updateTaxSettings = (orgId: string, taxSettings: UpdateTaxSettingsData) => billingServiceInstance.updateTaxSettings(orgId, taxSettings);
export const validateDiscountCode = (code: string, planId: string) => billingServiceInstance.validateDiscountCode(code, planId);
export const incrementDiscountCodeUsage = (codeId: string) => billingServiceInstance.incrementDiscountCodeUsage(codeId);
export const getSeatPricing = (planId: string) => billingServiceInstance.getSeatPricing(planId);
export const calculateSeatCost = (orgId: string, quantity: number) => billingServiceInstance.calculateSeatCost(orgId, quantity);
export const processSeatPurchase = (orgId: string, quantity: number, paymentMethodId: string) => billingServiceInstance.processSeatPurchase(orgId, quantity, paymentMethodId);
export const getBillingModel = (orgId: string) => billingServiceInstance.getBillingModel(orgId);

// Default export for backward compatibility
const billingService = {
    setDependencies,
    getPlans,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan,
    getOrganizationBilling,
    upsertOrganizationBilling,
    getOrCreateStripeCustomer,
    createSubscription,
    cancelSubscription,
    changePlan,
    getInvoices,
    recordInvoice,
    getRevenueStats,
    getUserPlans,
    createUserPlan,
    updateUserPlan,
    deleteUserPlan,
    getPaymentMethods,
    getPaymentMethod,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    createSetupIntent,
    getBillingAlerts,
    updateBillingAlerts,
    getTaxSettings,
    updateTaxSettings,
    validateDiscountCode,
    incrementDiscountCodeUsage,
    getSeatPricing,
    calculateSeatCost,
    processSeatPurchase,
    getBillingModel
};

export default billingService;
