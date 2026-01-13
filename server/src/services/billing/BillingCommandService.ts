import StripeLib from 'stripe';
import Stripe from 'stripe';

// Type aliases for Stripe namespace types
type StripeCustomer = Stripe.Customer;
type StripeInvoice = Stripe.Invoice;
type StripeSubscription = Stripe.Subscription;
type StripePaymentIntent = Stripe.PaymentIntent;
type StripePrice = Stripe.Price;

import { BillingEventService } from './BillingEventService.js';
import { BillingQueryService } from './BillingQueryService.js';
import type {
    SeatPricing,
    BillingPlan,
    BillingServiceDependencies,
    CreatePlanData,
    CreateUserPlanData,
    DiscountValidationResult,
    Invoice,
    OrganizationBilling,
    PaymentMethod,
    SeatCost,
    SetupIntent,
    TaxSettings,
    UpdateBillingAlertsData,
    UpdatePlanData,
    UpdateUserPlanData,
    UpsertBillingData,
} from './types.js';

type DepsAccessor = () => BillingServiceDependencies;

export class BillingCommandService {
    constructor(
        private readonly getDeps: DepsAccessor,
        private readonly queryService: BillingQueryService,
        private readonly eventService: BillingEventService,
    ) {}

    private deps() {
        return this.getDeps();
    }

    async createPlan(planData: CreatePlanData): Promise<BillingPlan> {
        const deps = this.deps();
        const id = `plan-${deps.uuidv4()}`;
        const featuresJson = JSON.stringify(planData.features || {});

        await (deps.db.run(
            `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                id,
                planData.name,
                planData.price_monthly,
                planData.token_limit || null,
                planData.storage_limit_gb || null,
                planData.token_overage_rate || null,
                planData.storage_overage_rate || null,
                planData.stripe_price_id || null,
                featuresJson,
            ],
        ) as Promise<any>);

        return { id, ...planData, features: planData.features || {}, is_active: 1 };
    }

    async updatePlan(planId: string, updates: UpdatePlanData): Promise<{ id: string; changes: number } | null> {
        const deps = this.deps();
        const allowedFields: Array<keyof UpdatePlanData> = [
            'name',
            'price_monthly',
            'token_limit',
            'storage_limit_gb',
            'token_overage_rate',
            'storage_overage_rate',
            'stripe_price_id',
            'features',
            'is_active',
        ];
        const fields: string[] = [];
        const values: any[] = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                let value = updates[field];
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
            values,
        ) as Promise<any>);

        return { id: planId, changes: result.changes || 0 };
    }

    async deletePlan(planId: string): Promise<{ id: string; changes: number } | null> {
        return this.updatePlan(planId, { is_active: 0 });
    }

    async createUserPlan(planData: CreateUserPlanData): Promise<void> {
        const deps = this.deps();
        const id = `license-${deps.uuidv4()}`;
        const featuresJson = JSON.stringify(planData.features || {});

        await (deps.db.run(
            `INSERT INTO user_license_plans (id, name, price_monthly, features, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [id, planData.name, planData.price_monthly, featuresJson],
        ) as Promise<any>);
    }

    async updateUserPlan(planId: string, updates: UpdateUserPlanData): Promise<{ id: string; changes: number } | null> {
        const deps = this.deps();
        const allowedFields: Array<keyof UpdateUserPlanData> = ['name', 'price_monthly', 'features', 'is_active'];
        const fields: string[] = [];
        const values: any[] = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = ?`);
                let value = updates[field];
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
            values,
        ) as Promise<any>);

        return { id: planId, changes: result.changes || 0 };
    }

    async deleteUserPlan(planId: string): Promise<{ id: string; changes: number } | null> {
        return this.updateUserPlan(planId, { is_active: 0 });
    }

    async upsertOrgBilling(orgId: string, billingData: UpsertBillingData): Promise<OrganizationBilling> {
        const deps = this.deps();
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
                billingData.status || 'active',
            ],
        ) as Promise<any>);

        const result = {
            id,
            organization_id: orgId,
            status: billingData.status || 'active',
            ...billingData,
        };

        this.eventService.emitEvent('billing.org.updated', result);
        return result as OrganizationBilling;
    }

    async getOrCreateStripeCustomer(
        orgId: string,
        email: string,
        orgName: string,
    ): Promise<StripeCustomer | { id: string; email: string }> {
        const deps = this.deps();
        const billing = await this.queryService.getOrganizationBilling(orgId);

        if (!deps.stripe) {
            return { id: `mock_cus_${orgId}`, email };
        }

        if (billing?.stripe_customer_id) {
            return (await deps.stripe.customers.retrieve(billing.stripe_customer_id)) as StripeCustomer;
        }

        const customer = await deps.stripe.customers.create({
            email,
            name: orgName,
            metadata: { organization_id: orgId },
        });

        await this.upsertOrgBilling(orgId, { stripe_customer_id: customer.id });
        return customer;
    }

    async createSubscription(
        orgId: string,
        planId: string,
        paymentMethodId: string,
        email: string,
        orgName: string,
    ): Promise<StripeSubscription | { id: string; status: string; plan: BillingPlan }> {
        const deps = this.deps();
        const plan = await this.queryService.getPlanById(planId);
        if (!plan) {
            throw new Error('Invalid plan');
        }

        if (!deps.stripe) {
            await this.upsertOrgBilling(orgId, { subscription_plan_id: planId, status: 'active' });
            return { id: `mock_sub_${orgId}`, status: 'active', plan };
        }

        const customer = (await this.getOrCreateStripeCustomer(orgId, email, orgName)) as StripeCustomer;
        await deps.stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
        await deps.stripe.customers.update(customer.id, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });

        const subscription = await deps.stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: plan.stripe_price_id || '' }],
            expand: ['latest_invoice.payment_intent'],
        });

        await this.upsertOrgBilling(orgId, {
            subscription_plan_id: planId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: (subscription as any).current_period_start
                ? new Date((subscription as any).current_period_start * 1000)
                : null,
            current_period_end: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : null,
        });

        this.eventService.emitEvent('billing.subscription.created', { orgId, subscriptionId: subscription.id });
        return subscription;
    }

    async cancelSubscription(orgId: string): Promise<StripeSubscription | { status: string }> {
        const deps = this.deps();
        const billing = await this.queryService.getOrganizationBilling(orgId);
        if (!billing?.stripe_subscription_id) {
            throw new Error('No active subscription');
        }

        if (!deps.stripe) {
            await this.upsertOrgBilling(orgId, { status: 'canceled' });
            return { status: 'canceled' };
        }

        const subscription = await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
            cancel_at_period_end: true,
        });

        await this.upsertOrgBilling(orgId, { status: 'canceling' });
        this.eventService.emitEvent('billing.subscription.canceling', { orgId, subscriptionId: subscription.id });
        return subscription;
    }

    async changePlan(orgId: string, newPlanId: string): Promise<{ status: string; plan: BillingPlan }> {
        const deps = this.deps();
        const billing = await this.queryService.getOrganizationBilling(orgId);
        const newPlan = await this.queryService.getPlanById(newPlanId);

        if (!newPlan) {
            throw new Error('Invalid plan');
        }

        if (!deps.stripe || !billing?.stripe_subscription_id) {
            await this.upsertOrgBilling(orgId, { subscription_plan_id: newPlanId });
            return { status: 'updated', plan: newPlan };
        }

        const subscription = await deps.stripe.subscriptions.retrieve(billing.stripe_subscription_id);

        await deps.stripe.subscriptions.update(billing.stripe_subscription_id, {
            items: [
                {
                    id: subscription.items.data[0].id,
                    price: newPlan.stripe_price_id || '',
                },
            ],
            proration_behavior: 'create_prorations',
        });

        await this.upsertOrgBilling(orgId, { subscription_plan_id: newPlanId });
        this.eventService.emitEvent('billing.plan.changed', { orgId, planId: newPlanId });
        return { status: 'updated', plan: newPlan };
    }

    async recordInvoice(orgId: string, stripeInvoice: StripeInvoice): Promise<{ id: string }> {
        const deps = this.deps();
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
                stripeInvoice.invoice_pdf || null,
            ],
        ) as Promise<any>);

        this.eventService.emitEvent('billing.invoice.recorded', { invoiceId: id, orgId });
        return { id };
    }

    async addPaymentMethod(orgId: string, stripePaymentMethodId: string): Promise<PaymentMethod> {
        const deps = this.deps();
        const id = `pm-${deps.uuidv4()}`;

        let pmDetails = {
            type: 'card',
            brand: 'unknown',
            last4: '****',
            exp_month: null,
            exp_year: null,
            holder_name: null,
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
                    holder_name: pm.billing_details?.name || null,
                };

                const billing = await this.queryService.getOrganizationBilling(orgId);
                if (billing?.stripe_customer_id) {
                    await (deps.stripe.paymentMethods.attach(stripePaymentMethodId, {
                        customer: billing.stripe_customer_id,
                    }) as Promise<any>);
                }
            } catch (error: unknown) {
                console.warn('Could not retrieve Stripe payment method details:', error);
            }
        }

        const existingMethods = await this.queryService.getPaymentMethods(orgId);
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
                isDefault,
            ],
        ) as Promise<any>);

        const paymentMethod: PaymentMethod = {
            id,
            organization_id: orgId,
            stripe_payment_method_id: stripePaymentMethodId,
            ...pmDetails,
            is_default: isDefault,
        };

        this.eventService.emitEvent('billing.payment_method.added', { orgId, paymentMethodId: id });
        return paymentMethod;
    }

    async removePaymentMethod(paymentMethodId: string, orgId: string): Promise<{ deleted: boolean }> {
        const deps = this.deps();
        const pm = await this.queryService.getPaymentMethod(paymentMethodId);
        if (!pm || pm.organization_id !== orgId) {
            throw new Error('Payment method not found');
        }

        if (deps.stripe && pm.stripe_payment_method_id) {
            try {
                await deps.stripe.paymentMethods.detach(pm.stripe_payment_method_id);
            } catch (error: unknown) {
                console.warn('Could not detach payment method from Stripe:', error);
            }
        }

        const result: any = await (deps.db.run('DELETE FROM payment_methods WHERE id = ? AND organization_id = ?', [
            paymentMethodId,
            orgId,
        ]) as Promise<any>);

        return { deleted: result.changes > 0 };
    }

    async setDefaultPaymentMethod(
        paymentMethodId: string,
        orgId: string,
    ): Promise<{ id: string; is_default: boolean }> {
        const deps = this.deps();
        const pm = await this.queryService.getPaymentMethod(paymentMethodId);
        if (!pm || pm.organization_id !== orgId) {
            throw new Error('Payment method not found');
        }

        if (deps.stripe && pm.stripe_payment_method_id) {
            try {
                const billing = await this.queryService.getOrganizationBilling(orgId);
                if (billing?.stripe_customer_id) {
                    await deps.stripe.customers.update(billing.stripe_customer_id, {
                        invoice_settings: { default_payment_method: pm.stripe_payment_method_id },
                    });
                }
            } catch (error: unknown) {
                console.warn('Could not update Stripe default payment method:', error);
            }
        }

        await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [orgId]);

        await deps.db.run('UPDATE payment_methods SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            paymentMethodId,
        ]);

        this.eventService.emitEvent('billing.payment_method.defaulted', { orgId, paymentMethodId });
        return { id: paymentMethodId, is_default: true };
    }

    async createSetupIntent(orgId: string, email: string, orgName: string): Promise<SetupIntent> {
        const deps = this.deps();
        if (!deps.stripe) {
            return {
                clientSecret: `mock_secret_${deps.uuidv4()}`,
                id: `mock_seti_${deps.uuidv4()}`,
            };
        }

        const customer = (await this.getOrCreateStripeCustomer(orgId, email, orgName)) as StripeCustomer;
        const setupIntent = await deps.stripe.setupIntents.create({
            customer: customer.id,
            payment_method_types: ['card'],
            metadata: { organization_id: orgId },
        });

        return {
            clientSecret: setupIntent.client_secret || '',
            id: setupIntent.id,
        };
    }

    async updateBillingAlerts(orgId: string, alertSettings: UpdateBillingAlertsData): Promise<Record<string, unknown>> {
        const deps = this.deps();
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
                alertSettings.email_notifications ?? 1,
            ],
        ) as Promise<any>);

        this.eventService.emitEvent('billing.alerts.updated', { orgId, alertSettings });
        return { id, organization_id: orgId, ...alertSettings };
    }

    async updateTaxSettings(orgId: string, taxSettings: Partial<TaxSettings>): Promise<Record<string, unknown>> {
        const deps = this.deps();
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
                taxSettings.po_number ?? null,
            ],
        ) as Promise<any>);

        this.eventService.emitEvent('billing.tax.updated', { orgId, taxSettings });
        return { id, organization_id: orgId, ...taxSettings };
    }

    async validateDiscountCode(code: string, planId: string): Promise<DiscountValidationResult> {
        const deps = this.deps();
        const row = await (deps.db.get<{
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
            is_active: number;
        }>(
            `SELECT * FROM discount_codes 
             WHERE code = ? AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= datetime('now'))
             AND (valid_until IS NULL OR valid_until >= datetime('now'))
             AND (max_uses IS NULL OR current_uses < max_uses)`,
            [code.toUpperCase()],
        ) as Promise<any>);

        if (!row) {
            return { valid: false, error: 'Invalid or expired discount code' };
        }

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
                currency: row.currency,
            },
        };
    }

    async incrementDiscountCodeUsage(codeId: string): Promise<{ updated: boolean }> {
        const deps = this.deps();
        const result: any = await (deps.db.run(
            'UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?',
            [codeId],
        ) as Promise<any>);

        return { updated: result.changes > 0 };
    }

    async calculateSeatCost(orgId: string, quantity: number): Promise<SeatCost> {
        return this.queryService.getSeatPricing(orgId).then((row) => {
            const seatPrice = row.seat_price_monthly || 0;
            const totalCost = seatPrice * quantity;
            return { unitPrice: seatPrice, totalCost, quantity };
        });
    }

    async processSeatPurchase(
        orgId: string,
        quantity: number,
        paymentMethodId: string,
    ): Promise<{
        success: boolean;
        quantity: number;
        unitPrice: number;
        totalCost: number;
        paymentMethodId: string;
    }> {
        const cost = await this.calculateSeatCost(orgId, quantity);
        return {
            success: true,
            quantity,
            unitPrice: cost.unitPrice,
            totalCost: cost.totalCost,
            paymentMethodId,
        };
    }
}
