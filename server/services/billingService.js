/**
 * Billing Service
 * Handles Stripe integration, subscriptions, and invoice management
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

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
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    Object.assign(deps, newDeps);
}

/**
 * Get all subscription plans
 */
function getPlans() {
    return new Promise((resolve, reject) => {
        deps.db.all('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC', [], (err, rows) => {
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
        deps.db.get('SELECT * FROM subscription_plans WHERE id = ?', [planId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Create a new subscription plan (Superadmin only)
 */
function createPlan(planData) {
    const id = `plan-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate, storage_overage_rate, stripe_price_id, features, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, planData.name, planData.price_monthly, planData.token_limit, planData.storage_limit_gb,
                planData.token_overage_rate, planData.storage_overage_rate, planData.stripe_price_id,
                JSON.stringify(planData.features || {}), 1],
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

    ['name', 'price_monthly', 'token_limit', 'storage_limit_gb', 'token_overage_rate', 'storage_overage_rate', 'stripe_price_id', 'features', 'is_active'].forEach(field => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    if (fields.length === 0) return Promise.resolve(null);

    values.push(planId);

    return new Promise((resolve, reject) => {
        deps.db.run(
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

// ==========================================
// USER LICENSE PLANS
// ==========================================

function getUserPlans() {
    return new Promise((resolve, reject) => {
        deps.db.all('SELECT * FROM user_license_plans WHERE is_active = 1 ORDER BY price_monthly ASC', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function createUserPlan(planData) {
    const id = `license-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO user_license_plans (id, name, price_monthly, features, is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [id, planData.name, planData.price_monthly, JSON.stringify(planData.features || {}), 1],
            function (err) {
                if (err) reject(err);
                else resolve({ id, ...planData });
            }
        );
    });
}

function updateUserPlan(planId, updates) {
    const fields = [];
    const values = [];

    ['name', 'price_monthly', 'features', 'is_active'].forEach(field => {
        if (updates[field] !== undefined) {
            fields.push(`${field} = ?`);
            // Stringify JSON if it's the features field and it's an object
            if (field === 'features' && typeof updates[field] === 'object') {
                values.push(JSON.stringify(updates[field]));
            } else {
                values.push(updates[field]);
            }
        }
    });

    if (fields.length === 0) return Promise.resolve(null);

    values.push(planId);

    return new Promise((resolve, reject) => {
        deps.db.run(
            `UPDATE user_license_plans SET ${fields.join(', ')} WHERE id = ?`,
            values,
            function (err) {
                if (err) reject(err);
                else resolve({ id: planId, changes: this.changes });
            }
        );
    });
}

function deleteUserPlan(planId) {
    return updateUserPlan(planId, { is_active: 0 });
}

/**
 * Get organization billing info
 */
function getOrganizationBilling(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
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
    const id = `billing-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
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
        // Simulate subscription for development/test environments (Stripe key missing)
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
        deps.db.all(
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
    const id = `inv-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
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
        deps.db.get(
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
                deps.db.all(
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

// ==========================================
// PAYMENT METHODS MANAGEMENT
// ==========================================

/**
 * Get all payment methods for an organization
 */
function getPaymentMethods(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT * FROM payment_methods WHERE organization_id = ? ORDER BY is_default DESC, created_at DESC`,
            [orgId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            }
        );
    });
}

/**
 * Get a single payment method
 */
function getPaymentMethod(paymentMethodId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM payment_methods WHERE id = ?',
            [paymentMethodId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/**
 * Add a new payment method
 */
async function addPaymentMethod(orgId, stripePaymentMethodId) {
    const id = `pm-${deps.uuidv4()}`;
    
    // Get Stripe payment method details
    let pmDetails = {
        type: 'card',
        brand: 'unknown',
        last4: '****',
        exp_month: null,
        exp_year: null,
        holder_name: null
    };

    if (stripe) {
        try {
            const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
            pmDetails = {
                type: pm.type,
                brand: pm.card?.brand || 'unknown',
                last4: pm.card?.last4 || '****',
                exp_month: pm.card?.exp_month,
                exp_year: pm.card?.exp_year,
                holder_name: pm.billing_details?.name
            };

            // Attach to customer if we have one
            const billing = await getOrganizationBilling(orgId);
            if (billing?.stripe_customer_id) {
                await stripe.paymentMethods.attach(stripePaymentMethodId, {
                    customer: billing.stripe_customer_id
                });
            }
        } catch (e) {
            console.warn('Could not retrieve Stripe payment method details:', e.message);
        }
    }

    // Check if this is the first payment method (make it default)
    const existingMethods = await getPaymentMethods(orgId);
    const isDefault = existingMethods.length === 0 ? 1 : 0;

    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO payment_methods (id, organization_id, stripe_payment_method_id, type, brand, last4, exp_month, exp_year, holder_name, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, orgId, stripePaymentMethodId, pmDetails.type, pmDetails.brand, pmDetails.last4, 
             pmDetails.exp_month, pmDetails.exp_year, pmDetails.holder_name, isDefault],
            function (err) {
                if (err) reject(err);
                else resolve({ id, organization_id: orgId, stripe_payment_method_id: stripePaymentMethodId, ...pmDetails, is_default: isDefault });
            }
        );
    });
}

/**
 * Remove a payment method
 */
async function removePaymentMethod(paymentMethodId, orgId) {
    const pm = await getPaymentMethod(paymentMethodId);
    if (!pm || pm.organization_id !== orgId) {
        throw new Error('Payment method not found');
    }

    // Detach from Stripe
    if (stripe && pm.stripe_payment_method_id) {
        try {
            await stripe.paymentMethods.detach(pm.stripe_payment_method_id);
        } catch (e) {
            console.warn('Could not detach payment method from Stripe:', e.message);
        }
    }

    return new Promise((resolve, reject) => {
        deps.db.run(
            'DELETE FROM payment_methods WHERE id = ? AND organization_id = ?',
            [paymentMethodId, orgId],
            function (err) {
                if (err) reject(err);
                else resolve({ deleted: this.changes > 0 });
            }
        );
    });
}

/**
 * Set a payment method as default
 */
async function setDefaultPaymentMethod(paymentMethodId, orgId) {
    const pm = await getPaymentMethod(paymentMethodId);
    if (!pm || pm.organization_id !== orgId) {
        throw new Error('Payment method not found');
    }

    // Update Stripe customer default payment method
    if (stripe && pm.stripe_payment_method_id) {
        try {
            const billing = await getOrganizationBilling(orgId);
            if (billing?.stripe_customer_id) {
                await stripe.customers.update(billing.stripe_customer_id, {
                    invoice_settings: { default_payment_method: pm.stripe_payment_method_id }
                });
            }
        } catch (e) {
            console.warn('Could not update Stripe default payment method:', e.message);
        }
    }

    return new Promise((resolve, reject) => {
        // First, unset all defaults for this org
        deps.db.run(
            'UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?',
            [orgId],
            (err) => {
                if (err) return reject(err);
                
                // Then set the new default
                deps.db.run(
                    'UPDATE payment_methods SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [paymentMethodId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: paymentMethodId, is_default: true });
                    }
                );
            }
        );
    });
}

/**
 * Create a Stripe SetupIntent for adding a new payment method
 */
async function createSetupIntent(orgId, email, orgName) {
    if (!stripe) {
        // Return mock for development
        return { 
            clientSecret: 'mock_secret_' + deps.uuidv4(),
            id: 'mock_seti_' + deps.uuidv4()
        };
    }

    const customer = await getOrCreateStripeCustomer(orgId, email, orgName);

    const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        payment_method_types: ['card'],
        metadata: { organization_id: orgId }
    });

    return {
        clientSecret: setupIntent.client_secret,
        id: setupIntent.id
    };
}

// ==========================================
// BILLING ALERTS & USAGE THRESHOLDS
// ==========================================

/**
 * Get billing alert configuration for an organization
 */
function getBillingAlerts(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM billing_alerts WHERE organization_id = ?',
            [orgId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || {
                    token_threshold_80: 1,
                    token_threshold_90: 1,
                    token_threshold_100: 1,
                    storage_threshold_80: 1,
                    storage_threshold_90: 1,
                    storage_threshold_100: 1,
                    auto_upgrade_enabled: 0,
                    cost_cap_monthly: null,
                    email_notifications: 1
                });
            }
        );
    });
}

/**
 * Update billing alert configuration
 */
function updateBillingAlerts(orgId, alertSettings) {
    const id = `alert-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
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
            [id, orgId, 
             alertSettings.token_threshold_80 ?? 1,
             alertSettings.token_threshold_90 ?? 1,
             alertSettings.token_threshold_100 ?? 1,
             alertSettings.storage_threshold_80 ?? 1,
             alertSettings.storage_threshold_90 ?? 1,
             alertSettings.storage_threshold_100 ?? 1,
             alertSettings.auto_upgrade_enabled ?? 0,
             alertSettings.auto_upgrade_plan_id ?? null,
             alertSettings.cost_cap_monthly ?? null,
             alertSettings.email_notifications ?? 1],
            function (err) {
                if (err) reject(err);
                else resolve({ organization_id: orgId, ...alertSettings });
            }
        );
    });
}

// ==========================================
// TAX SETTINGS
// ==========================================

/**
 * Get tax settings for an organization
 */
function getTaxSettings(orgId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            'SELECT * FROM billing_tax_settings WHERE organization_id = ?',
            [orgId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            }
        );
    });
}

/**
 * Update tax settings
 */
function updateTaxSettings(orgId, taxSettings) {
    const id = `tax-${deps.uuidv4()}`;
    return new Promise((resolve, reject) => {
        deps.db.run(
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
            [id, orgId,
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
             taxSettings.po_number ?? null],
            function (err) {
                if (err) reject(err);
                else resolve({ organization_id: orgId, ...taxSettings });
            }
        );
    });
}

// ==========================================
// DISCOUNT CODES
// ==========================================

/**
 * Validate and apply a discount code
 */
async function validateDiscountCode(code, planId) {
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT * FROM discount_codes 
             WHERE code = ? AND is_active = 1 
             AND (valid_from IS NULL OR valid_from <= datetime('now'))
             AND (valid_until IS NULL OR valid_until >= datetime('now'))
             AND (max_uses IS NULL OR current_uses < max_uses)`,
            [code.toUpperCase()],
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve({ valid: false, error: 'Invalid or expired discount code' });
                
                // Check if applicable to this plan
                if (row.applicable_plans) {
                    const applicablePlans = JSON.parse(row.applicable_plans);
                    if (!applicablePlans.includes(planId)) {
                        return resolve({ valid: false, error: 'This code is not valid for the selected plan' });
                    }
                }

                resolve({
                    valid: true,
                    discount: {
                        id: row.id,
                        code: row.code,
                        type: row.discount_type,
                        value: row.discount_value,
                        currency: row.currency
                    }
                });
            }
        );
    });
}

/**
 * Increment discount code usage
 */
function incrementDiscountCodeUsage(codeId) {
    return new Promise((resolve, reject) => {
        deps.db.run(
            'UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = ?',
            [codeId],
            function (err) {
                if (err) reject(err);
                else resolve({ updated: this.changes > 0 });
            }
        );
    });
}

module.exports = {
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
    // Payment Methods
    getPaymentMethods,
    getPaymentMethod,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    createSetupIntent,
    // Billing Alerts
    getBillingAlerts,
    updateBillingAlerts,
    // Tax Settings
    getTaxSettings,
    updateTaxSettings,
    // Discount Codes
    validateDiscountCode,
    incrementDiscountCodeUsage
};
