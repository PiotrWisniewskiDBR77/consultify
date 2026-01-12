/**
 * Stripe Service
 * 
 * Handles all Stripe-specific operations:
 * - Checkout Sessions
 * - Payment Intents
 * - Customer Portal
 * - Subscription management
 * - Proration calculations
 * 
 * @module services/stripeService
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/index.js';

// Dependency injection for testing
let deps = {
    db: null,
    stripe: null,
    billingService: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        deps.db = getDatabase();
    }

    if (!deps.stripe && process.env.STRIPE_SECRET_KEY) {
        try {
            const { default: Stripe } = await import('stripe');
            deps.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16'
            });
        } catch (e) {
            console.log('[StripeService] Stripe not initialized:', e.message);
        }
    }

    if (!deps.billingService) {
        const billingModule = await import('./billingService.js');
        deps.billingService = billingModule.default || billingModule;
    }
}

/**
 * Set dependencies (for testing)
 * @param {Object} newDeps - Dependencies to inject
 */
export function setDependencies(newDeps = {}) {
    deps = { ...deps, ...newDeps };
}

// Database helpers
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        deps.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        deps.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        deps.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ==========================================
// CHECKOUT SESSIONS
// ==========================================

/**
 * Create a Stripe Checkout Session for new subscriptions
 * @param {Object} options - Checkout options
 * @param {string} options.orgId - Organization ID
 * @param {string} options.userId - User ID
 * @param {string} options.planId - Plan ID to subscribe to
 * @param {string} options.successUrl - URL to redirect on success
 * @param {string} options.cancelUrl - URL to redirect on cancel
 * @param {string} [options.billingCycle='monthly'] - Billing cycle
 * @param {string} [options.discountCode] - Optional discount code
 * @param {string} [options.customerEmail] - Customer email
 * @returns {Promise<{sessionId: string, url: string}>}
 */
export async function createCheckoutSession(options) {
    await initDeps();
    const {
        orgId,
        userId,
        planId,
        successUrl,
        cancelUrl,
        billingCycle = 'monthly',
        discountCode,
        customerEmail
    } = options;

    // Get plan details
    const plan = await deps.billingService.getPlanById(planId);
    if (!plan) {
        throw new Error('Invalid plan');
    }

    // Record checkout session in database
    const sessionDbId = uuidv4();

    if (!deps.stripe) {
        // Mock response for development
        const mockSessionId = `mock_cs_${uuidv4()}`;
        
        try {
            await dbRun(`
                INSERT INTO checkout_sessions (id, organization_id, user_id, stripe_session_id, plan_id, status, mode, success_url, cancel_url, customer_email, expires_at)
                VALUES (?, ?, ?, ?, ?, 'pending', 'subscription', ?, ?, ?, datetime('now', '+24 hours'))
            `, [sessionDbId, orgId, userId, mockSessionId, planId, successUrl, cancelUrl, customerEmail]);
        } catch (err) {
            console.log('[StripeService] checkout_sessions table not available');
        }

        return {
            sessionId: mockSessionId,
            url: `${successUrl}?session_id=${mockSessionId}&mock=true`
        };
    }

    // Get or create Stripe customer
    const customer = await deps.billingService.getOrCreateStripeCustomer(
        orgId,
        customerEmail,
        `Organization ${orgId}`
    );

    // Determine price ID based on billing cycle
    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id;

    if (!priceId) {
        throw new Error('Plan does not have a Stripe price configured');
    }

    // Build checkout session params
    const sessionParams = {
        mode: 'subscription',
        customer: customer.id,
        line_items: [{
            price: priceId,
            quantity: 1
        }],
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
            organization_id: orgId,
            user_id: userId,
            plan_id: planId,
            billing_cycle: billingCycle
        },
        subscription_data: {
            metadata: {
                organization_id: orgId,
                plan_id: planId
            }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        tax_id_collection: { enabled: true }
    };

    // Apply discount code if provided
    if (discountCode) {
        const discount = await deps.billingService.validateDiscountCode(discountCode, planId);
        if (discount.valid && discount.discount?.stripe_coupon_id) {
            sessionParams.discounts = [{ coupon: discount.discount.stripe_coupon_id }];
        }
    }

    // Create Stripe session
    const session = await deps.stripe.checkout.sessions.create(sessionParams);

    // Record in database
    try {
        await dbRun(`
            INSERT INTO checkout_sessions (id, organization_id, user_id, stripe_session_id, plan_id, status, mode, success_url, cancel_url, customer_email, expires_at)
            VALUES (?, ?, ?, ?, ?, 'pending', 'subscription', ?, ?, ?, ?)
        `, [sessionDbId, orgId, userId, session.id, planId, successUrl, cancelUrl, customerEmail, new Date(session.expires_at * 1000).toISOString()]);
    } catch (err) {
        console.log('[StripeService] Could not record checkout session:', err.message);
    }

    return {
        sessionId: session.id,
        url: session.url
    };
}

/**
 * Create a Customer Portal session for self-service billing management
 * @param {string} orgId - Organization ID
 * @param {string} returnUrl - URL to return to after portal session
 * @returns {Promise<{url: string}>}
 */
export async function createPortalSession(orgId, returnUrl) {
    await initDeps();

    if (!deps.stripe) {
        return { url: `${returnUrl}?portal=mock` };
    }

    const billing = await deps.billingService.getOrganizationBilling(orgId);
    if (!billing?.stripe_customer_id) {
        throw new Error('No Stripe customer found for organization');
    }

    const session = await deps.stripe.billingPortal.sessions.create({
        customer: billing.stripe_customer_id,
        return_url: returnUrl
    });

    return { url: session.url };
}

/**
 * Retrieve a checkout session by ID
 * @param {string} sessionId - Stripe session ID
 * @returns {Promise<Object>}
 */
export async function getCheckoutSession(sessionId) {
    await initDeps();

    if (!deps.stripe) {
        const session = await dbGet('SELECT * FROM checkout_sessions WHERE stripe_session_id = ?', [sessionId]);
        return session;
    }

    return await deps.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer']
    });
}

// ==========================================
// PAYMENT INTENTS
// ==========================================

/**
 * Create a Payment Intent for one-time payments
 * @param {Object} options - Payment options
 * @param {string} options.orgId - Organization ID
 * @param {number} options.amount - Amount in cents
 * @param {string} [options.currency='usd'] - Currency
 * @param {string} [options.description] - Payment description
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Promise<{clientSecret: string, id: string}>}
 */
export async function createPaymentIntent(options) {
    await initDeps();
    const {
        orgId,
        amount,
        currency = 'usd',
        description,
        metadata = {}
    } = options;

    if (!deps.stripe) {
        const mockId = `mock_pi_${uuidv4()}`;
        return {
            clientSecret: `mock_secret_${uuidv4()}`,
            id: mockId
        };
    }

    const billing = await deps.billingService.getOrganizationBilling(orgId);
    
    const params = {
        amount,
        currency,
        metadata: {
            organization_id: orgId,
            ...metadata
        },
        automatic_payment_methods: { enabled: true }
    };

    if (description) {
        params.description = description;
    }

    if (billing?.stripe_customer_id) {
        params.customer = billing.stripe_customer_id;
    }

    const paymentIntent = await deps.stripe.paymentIntents.create(params);

    return {
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id
    };
}

/**
 * Confirm a Payment Intent
 * @param {string} paymentIntentId - Payment Intent ID
 * @param {string} paymentMethodId - Payment Method ID
 * @returns {Promise<Object>}
 */
export async function confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    await initDeps();

    if (!deps.stripe) {
        return { id: paymentIntentId, status: 'succeeded' };
    }

    return await deps.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
    });
}

/**
 * Retrieve a Payment Intent
 * @param {string} paymentIntentId - Payment Intent ID
 * @returns {Promise<Object>}
 */
export async function getPaymentIntent(paymentIntentId) {
    await initDeps();

    if (!deps.stripe) {
        return { id: paymentIntentId, status: 'succeeded' };
    }

    return await deps.stripe.paymentIntents.retrieve(paymentIntentId);
}

// ==========================================
// PRORATION
// ==========================================

/**
 * Calculate proration for plan change
 * @param {string} orgId - Organization ID
 * @param {string} newPlanId - New plan ID
 * @returns {Promise<Object>} Proration details
 */
export async function calculateProration(orgId, newPlanId) {
    await initDeps();

    const billing = await deps.billingService.getOrganizationBilling(orgId);
    if (!billing) {
        throw new Error('No billing record found');
    }

    const currentPlan = await deps.billingService.getPlanById(billing.subscription_plan_id);
    const newPlan = await deps.billingService.getPlanById(newPlanId);

    if (!currentPlan || !newPlan) {
        throw new Error('Invalid plan');
    }

    // Calculate days remaining in current period
    const now = new Date();
    const periodEnd = new Date(billing.current_period_end);
    const periodStart = new Date(billing.current_period_start);
    const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)));

    // Calculate credit for unused time on current plan
    const dailyRateCurrent = currentPlan.price_monthly / 30;
    const creditAmount = Math.round(dailyRateCurrent * daysRemaining * 100) / 100;

    // Calculate charge for remaining time on new plan
    const dailyRateNew = newPlan.price_monthly / 30;
    const chargeAmount = Math.round(dailyRateNew * daysRemaining * 100) / 100;

    // Net proration amount
    const prorationAmount = chargeAmount - creditAmount;

    return {
        currentPlan: {
            id: currentPlan.id,
            name: currentPlan.name,
            priceMonthly: currentPlan.price_monthly
        },
        newPlan: {
            id: newPlan.id,
            name: newPlan.name,
            priceMonthly: newPlan.price_monthly
        },
        daysRemaining,
        totalDays,
        creditAmount,
        chargeAmount,
        prorationAmount,
        effectiveDate: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
        isUpgrade: newPlan.price_monthly > currentPlan.price_monthly
    };
}

/**
 * Record a proration
 * @param {string} orgId - Organization ID
 * @param {Object} prorationData - Proration calculation result
 * @returns {Promise<string>} Proration record ID
 */
export async function recordProration(orgId, prorationData) {
    await initDeps();

    const id = uuidv4();
    
    try {
        await dbRun(`
            INSERT INTO proration_records (
                id, organization_id, subscription_id, old_plan_id, new_plan_id,
                proration_amount, credit_amount, charge_amount, currency,
                effective_date, billing_period_end, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, 'pending')
        `, [
            id,
            orgId,
            prorationData.subscriptionId || null,
            prorationData.currentPlan.id,
            prorationData.newPlan.id,
            Math.round(prorationData.prorationAmount * 100),
            Math.round(prorationData.creditAmount * 100),
            Math.round(prorationData.chargeAmount * 100),
            prorationData.effectiveDate,
            prorationData.periodEnd
        ]);
    } catch (err) {
        console.log('[StripeService] Could not record proration:', err.message);
    }

    return id;
}

// ==========================================
// USAGE-BASED BILLING
// ==========================================

/**
 * Record a usage event for usage-based billing
 * @param {Object} options - Usage event options
 * @param {string} options.orgId - Organization ID
 * @param {string} options.metricName - Metric name (e.g., 'ai_tokens', 'api_calls')
 * @param {number} options.quantity - Usage quantity
 * @param {Date} [options.timestamp] - Timestamp (defaults to now)
 * @param {string} [options.idempotencyKey] - Idempotency key
 * @returns {Promise<{id: string}>}
 */
export async function recordUsageEvent(options) {
    await initDeps();
    const {
        orgId,
        metricName,
        quantity,
        timestamp = new Date(),
        idempotencyKey
    } = options;

    const id = uuidv4();

    // Check idempotency
    if (idempotencyKey) {
        const existing = await dbGet(
            'SELECT id FROM billing_usage_events WHERE idempotency_key = ?',
            [idempotencyKey]
        );
        if (existing) {
            return { id: existing.id, duplicate: true };
        }
    }

    try {
        await dbRun(`
            INSERT INTO billing_usage_events (
                id, organization_id, metric_name, quantity, timestamp, idempotency_key
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [id, orgId, metricName, quantity, timestamp.toISOString(), idempotencyKey]);
    } catch (err) {
        // Fall back to usage_records table
        await dbRun(`
            INSERT INTO usage_records (id, organization_id, metric_name, quantity, recorded_at)
            VALUES (?, ?, ?, ?, ?)
        `, [id, orgId, metricName, quantity, timestamp.toISOString()]);
    }

    // If Stripe is configured and we have a subscription, report usage
    if (deps.stripe) {
        const billing = await deps.billingService.getOrganizationBilling(orgId);
        if (billing?.stripe_subscription_id) {
            try {
                // Get subscription item for metered billing
                const subscription = await deps.stripe.subscriptions.retrieve(billing.stripe_subscription_id);
                const meteredItem = subscription.items.data.find(item => 
                    item.price.recurring?.usage_type === 'metered'
                );

                if (meteredItem) {
                    await deps.stripe.subscriptionItems.createUsageRecord(
                        meteredItem.id,
                        {
                            quantity,
                            timestamp: Math.floor(timestamp.getTime() / 1000),
                            action: 'increment'
                        },
                        { idempotencyKey }
                    );
                }
            } catch (err) {
                console.log('[StripeService] Could not report usage to Stripe:', err.message);
            }
        }
    }

    return { id };
}

/**
 * Get usage summary for a period
 * @param {string} orgId - Organization ID
 * @param {Date} startDate - Period start
 * @param {Date} endDate - Period end
 * @returns {Promise<Object>}
 */
export async function getUsageSummary(orgId, startDate, endDate) {
    await initDeps();

    const usage = await dbAll(`
        SELECT 
            metric_name,
            SUM(quantity) as total_quantity,
            COUNT(*) as event_count
        FROM billing_usage_events
        WHERE organization_id = ?
        AND timestamp >= ? AND timestamp <= ?
        GROUP BY metric_name
    `, [orgId, startDate.toISOString(), endDate.toISOString()]);

    return {
        period: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
        },
        metrics: usage.reduce((acc, row) => {
            acc[row.metric_name] = {
                total: row.total_quantity,
                eventCount: row.event_count
            };
            return acc;
        }, {})
    };
}

// ==========================================
// CREDITS
// ==========================================

/**
 * Apply credit to organization
 * @param {Object} options - Credit options
 * @param {string} options.orgId - Organization ID
 * @param {number} options.amount - Credit amount in cents
 * @param {string} options.reason - Reason for credit
 * @param {string} [options.source] - Source of credit (refund, promo, etc.)
 * @param {Date} [options.expiresAt] - Expiration date
 * @returns {Promise<{id: string}>}
 */
export async function applyCredit(options) {
    await initDeps();
    const {
        orgId,
        amount,
        reason,
        source,
        sourceId,
        expiresAt
    } = options;

    const id = uuidv4();

    try {
        await dbRun(`
            INSERT INTO billing_credits (
                id, organization_id, amount, reason, source, source_id, expires_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `, [id, orgId, amount, reason, source, sourceId, expiresAt?.toISOString()]);
    } catch (err) {
        console.log('[StripeService] Could not apply credit:', err.message);
        throw err;
    }

    return { id };
}

/**
 * Get available credits for organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<{total: number, credits: Array}>}
 */
export async function getAvailableCredits(orgId) {
    await initDeps();

    const credits = await dbAll(`
        SELECT * FROM billing_credits
        WHERE organization_id = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND used_amount < amount
        ORDER BY expires_at ASC NULLS LAST
    `, [orgId]);

    const total = credits.reduce((sum, c) => sum + (c.amount - c.used_amount), 0);

    return { total, credits };
}

// ==========================================
// EXPORTS
// ==========================================

export default {
    setDependencies,
    // Checkout
    createCheckoutSession,
    createPortalSession,
    getCheckoutSession,
    // Payment Intents
    createPaymentIntent,
    confirmPaymentIntent,
    getPaymentIntent,
    // Proration
    calculateProration,
    recordProration,
    // Usage
    recordUsageEvent,
    getUsageSummary,
    // Credits
    applyCredit,
    getAvailableCredits
};

