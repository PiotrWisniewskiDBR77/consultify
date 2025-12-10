/**
 * Billing Service
 * Handles Stripe integration, subscriptions, and invoice management
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Stripe will be initialized when keys are configured
let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
} catch (e) {
    console.log('Stripe not initialized - API key not configured');
}

/**
 * Get all subscription plans
 */
function getPlans() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Get plan by ID
 */
function getPlanById(planId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Create a new subscription plan (Superadmin only)
 */
function createPlan(planData) {
    const id = `plan-${uuidv4()}`;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, planData.name, planData.price_monthly, planData.token_limit, planData.storage_limit_gb,
                planData.token_overage_rate, planData.storage_overage_rate, planData.stripe_price_id, 1],
            function (err) {
                if (err) reject(err);
                else resolve({ id, ...planData });
            }
        );
    });
}

/**
 * Update subscription plan
 */
function updatePlan(planId, updates) {
    const fields = [];
    const values = [];

    ['name', 'price_monthly', 'token_limit', 'storage_limit_gb', 'token_overage_rate', 'storage_overage_rate', 'stripe_price_id', 'is_active'].forEach(field => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    if (fields.length === 0) return Promise.resolve(null);

    values.push(planId);

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`,
            values,
            function (err) {
                if (err) reject(err);
                else resolve({ id: planId, changes: this.changes });
            }
        );
    });
}

/**
 * Delete subscription plan (soft delete by setting is_active = 0)
 */
function deletePlan(planId) {
    return updatePlan(planId, { is_active: 0 });
}

/**
 * Get organization billing info
 */
function getOrganizationBilling(orgId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT ob.*, sp.name as plan_name, sp.price_monthly, sp.token_limit, sp.storage_limit_gb
             FROM organization_billing ob
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.organization_id = ?`,
            [orgId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/**
 * Create or update organization billing record
 */
function upsertOrganizationBilling(orgId, billingData) {
    const id = `billing-${uuidv4()}`;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, stripe_customer_id, stripe_subscription_id, billing_email, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(organization_id) DO UPDATE SET
             subscription_plan_id = excluded.subscription_plan_id,
             stripe_customer_id = COALESCE(excluded.stripe_customer_id, stripe_customer_id),
             stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, stripe_subscription_id),
             billing_email = COALESCE(excluded.billing_email, billing_email),
             status = COALESCE(excluded.status, status),
             updated_at = CURRENT_TIMESTAMP`,
            [id, orgId, billingData.subscription_plan_id, billingData.stripe_customer_id,
                billingData.stripe_subscription_id, billingData.billing_email, billingData.status || 'active'],
            function (err) {
                if (err) reject(err);
                else resolve({ id, organization_id: orgId, ...billingData });
            }
        );
    });
}

/**
 * Create Stripe customer if not exists
 */
async function getOrCreateStripeCustomer(orgId, email, orgName) {
    if (!stripe) {
        console.warn('Stripe not configured, returning mock customer');
        return { id: `mock_cus_${orgId}`, email };
    }

    const billing = await getOrganizationBilling(orgId);

    if (billing?.stripe_customer_id) {
        return stripe.customers.retrieve(billing.stripe_customer_id);
    }

    const customer = await stripe.customers.create({
        email,
        name: orgName,
        metadata: { organization_id: orgId }
    });

    await upsertOrganizationBilling(orgId, { stripe_customer_id: customer.id });

    return customer;
}

/**
 * Create subscription for organization
 */
async function createSubscription(orgId, planId, paymentMethodId, email, orgName) {
    const plan = await getPlanById(planId);
    if (!plan) throw new Error('Invalid plan');

    if (!stripe) {
        // Mock subscription for development
        await upsertOrganizationBilling(orgId, {
            subscription_plan_id: planId,
            status: 'active'
        });
        return { id: `mock_sub_${orgId}`, status: 'active', plan };
    }

    const customer = await getOrCreateStripeCustomer(orgId, email, orgName);

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId }
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: plan.stripe_price_id }],
        expand: ['latest_invoice.payment_intent']
    });

    await upsertOrganizationBilling(orgId, {
        subscription_plan_id: planId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
    });

    return subscription;
}

/**
 * Cancel subscription
 */
async function cancelSubscription(orgId) {
    const billing = await getOrganizationBilling(orgId);
    if (!billing?.stripe_subscription_id) {
        throw new Error('No active subscription');
    }

    if (!stripe) {
        await upsertOrganizationBilling(orgId, { status: 'canceled' });
        return { status: 'canceled' };
    }

    const subscription = await stripe.subscriptions.update(billing.stripe_subscription_id, {
        cancel_at_period_end: true
    });

    await upsertOrganizationBilling(orgId, { status: 'canceling' });

    return subscription;
}

/**
 * Change subscription plan
 */
async function changePlan(orgId, newPlanId) {
    const billing = await getOrganizationBilling(orgId);
    const newPlan = await getPlanById(newPlanId);

    if (!newPlan) throw new Error('Invalid plan');

    if (!stripe || !billing?.stripe_subscription_id) {
        await upsertOrganizationBilling(orgId, { subscription_plan_id: newPlanId });
        return { status: 'updated', plan: newPlan };
    }

    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);

    await stripe.subscriptions.update(billing.stripe_subscription_id, {
        items: [{
            id: subscription.items.data[0].id,
            price: newPlan.stripe_price_id
        }],
        proration_behavior: 'create_prorations'
    });

    await upsertOrganizationBilling(orgId, { subscription_plan_id: newPlanId });

    return { status: 'updated', plan: newPlan };
}

/**
 * Get invoices for organization
 */
function getInvoices(orgId) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC',
            [orgId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Record invoice from Stripe webhook
 */
function recordInvoice(orgId, stripeInvoice) {
    const id = `inv-${uuidv4()}`;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO invoices (id, organization_id, stripe_invoice_id, amount_due, amount_paid, currency, status, period_start, period_end, pdf_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, orgId, stripeInvoice.id, stripeInvoice.amount_due / 100, stripeInvoice.amount_paid / 100,
                stripeInvoice.currency, stripeInvoice.status,
                new Date(stripeInvoice.period_start * 1000), new Date(stripeInvoice.period_end * 1000),
                stripeInvoice.invoice_pdf],
            function (err) {
                if (err) reject(err);
                else resolve({ id });
            }
        );
    });
}

/**
 * Get revenue statistics (Superadmin)
 */
function getRevenueStats() {
    return new Promise((resolve, reject) => {
        const stats = {};

        // Get MRR (Monthly Recurring Revenue)
        db.get(
            `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr, COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
            [],
            (err, row) => {
                if (err) return reject(err);
                stats.mrr = row?.mrr || 0;
                stats.activeSubscriptions = row?.active_subscriptions || 0;
                stats.arr = stats.mrr * 12;

                // Get plan distribution
                db.all(
                    `SELECT sp.name, sp.price_monthly, COUNT(ob.id) as count
                     FROM subscription_plans sp
                     LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id AND ob.status = 'active'
                     WHERE sp.is_active = 1
                     GROUP BY sp.id`,
                    [],
                    (err, rows) => {
                        if (err) return reject(err);
                        stats.planDistribution = rows || [];
                        resolve(stats);
                    }
                );
            }
        );
    });
}

module.exports = {
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
    getRevenueStats
};
