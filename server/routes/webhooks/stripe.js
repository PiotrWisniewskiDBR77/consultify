/**
 * Stripe Webhook Handler
 * Processes Stripe events for subscription lifecycle management
 * 
 * Supported Events:
 * - customer.subscription.created/updated/deleted
 * - invoice.created/paid/payment_failed
 * - checkout.session.completed
 * - payment_intent.succeeded/payment_failed
 * - customer.updated
 * - charge.refunded
 * - charge.dispute.created
 * - price.updated
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import billingService from '../../services/billingService.js';
import { getDatabase } from '../../src/database/index.js';

const router = express.Router();
const db = getDatabase();

// Stripe webhook secret for signature verification
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Database helpers
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Log Stripe event for idempotency and audit
 */
async function logStripeEvent(event, orgId, status = 'processed', errorMessage = null) {
    try {
        const id = uuidv4();
        await dbRun(`
            INSERT INTO stripe_events (id, event_id, event_type, organization_id, payload, status, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, event.id, event.type, orgId, JSON.stringify(event), status, errorMessage]);
        return id;
    } catch (err) {
        // If table doesn't exist, just log to console
        if (err.message?.includes('no such table')) {
            console.log('[Stripe Webhook] stripe_events table not found, skipping event logging');
            return null;
        }
        console.error('[Stripe Webhook] Failed to log event:', err);
        return null;
    }
}

/**
 * Check if event was already processed (idempotency)
 */
async function isEventProcessed(eventId) {
    try {
        const existing = await dbGet('SELECT id FROM stripe_events WHERE event_id = ?', [eventId]);
        return !!existing;
    } catch (err) {
        // Table might not exist yet
        return false;
    }
}

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;

    // Verify webhook signature if secret is configured
    if (endpointSecret) {
        const sig = req.headers['stripe-signature'];
        try {
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        // For development without signature verification
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    console.log('[Stripe Webhook] Received:', event.type, event.id);

    // Check idempotency
    if (await isEventProcessed(event.id)) {
        console.log('[Stripe Webhook] Event already processed:', event.id);
        return res.json({ received: true, skipped: true });
    }

    let orgId = null;
    let status = 'processed';
    let errorMessage = null;

    try {
        switch (event.type) {
            // =====================
            // SUBSCRIPTION EVENTS
            // =====================
            case 'customer.subscription.created':
                orgId = await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                orgId = await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                orgId = await handleSubscriptionDeleted(event.data.object);
                break;

            // =====================
            // INVOICE EVENTS
            // =====================
            case 'invoice.created':
                orgId = await handleInvoiceCreated(event.data.object);
                break;

            case 'invoice.paid':
                orgId = await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                orgId = await handleInvoicePaymentFailed(event.data.object);
                break;

            // =====================
            // CHECKOUT EVENTS (NEW)
            // =====================
            case 'checkout.session.completed':
                orgId = await handleCheckoutSessionCompleted(event.data.object);
                break;

            // =====================
            // PAYMENT INTENT EVENTS (NEW)
            // =====================
            case 'payment_intent.succeeded':
                orgId = await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                orgId = await handlePaymentIntentFailed(event.data.object);
                break;

            // =====================
            // CUSTOMER EVENTS (NEW)
            // =====================
            case 'customer.updated':
                orgId = await handleCustomerUpdated(event.data.object);
                break;

            // =====================
            // CHARGE EVENTS (NEW)
            // =====================
            case 'charge.refunded':
                orgId = await handleChargeRefunded(event.data.object);
                break;

            case 'charge.dispute.created':
                orgId = await handleDisputeCreated(event.data.object);
                break;

            // =====================
            // PRICE EVENTS (NEW)
            // =====================
            case 'price.updated':
                await handlePriceUpdated(event.data.object);
                break;

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        // Log successful event
        await logStripeEvent(event, orgId, status, errorMessage);
        res.json({ received: true });

    } catch (error) {
        console.error('[Stripe Webhook] Processing error:', error);
        status = 'failed';
        errorMessage = error.message;
        await logStripeEvent(event, orgId, status, errorMessage);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// =====================================================
// EXISTING EVENT HANDLERS (Refactored)
// =====================================================

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) {
        console.warn('[Stripe Webhook] No organization found for customer:', customerId);
        return null;
    }

    await billingService.upsertOrganizationBilling(orgId, {
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
    });

    // Record state transition
    await recordStateTransition(orgId, subscription.id, null, subscription.status, 'subscription_created', subscription.id);

    console.log(`[Stripe Webhook] Subscription created for org ${orgId}`);

    // Queue welcome email
    await queueBillingEmail(orgId, 'subscription_renewed', {
        subscription_id: subscription.id,
        plan_name: subscription.items?.data?.[0]?.price?.nickname || 'Subscription',
        next_billing_date: new Date(subscription.current_period_end * 1000).toISOString()
    });

    await createNotification(orgId, 'subscription_created',
        'Subscription Activated',
        'Your subscription has been activated successfully.'
    );

    return orgId;
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return null;

    // Get previous state
    const previousBilling = await billingService.getOrganizationBilling(orgId);
    const previousStatus = previousBilling?.status;

    await billingService.upsertOrganizationBilling(orgId, {
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
    });

    // Record state transition if status changed
    if (previousStatus !== subscription.status) {
        await recordStateTransition(orgId, subscription.id, previousStatus, subscription.status, 'subscription_updated', subscription.id);
    }

    console.log(`[Stripe Webhook] Subscription updated for org ${orgId}: ${subscription.status}`);

    return orgId;
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return null;

    const previousBilling = await billingService.getOrganizationBilling(orgId);

    await billingService.upsertOrganizationBilling(orgId, {
        status: 'canceled',
        stripe_subscription_id: null
    });

    await recordStateTransition(orgId, subscription.id, previousBilling?.status, 'canceled', 'subscription_deleted', subscription.id);

    console.log(`[Stripe Webhook] Subscription canceled for org ${orgId}`);

    // Queue cancellation email
    await queueBillingEmail(orgId, 'subscription_canceled', {
        subscription_id: subscription.id,
        cancellation_date: new Date().toISOString(),
        access_until: new Date(subscription.current_period_end * 1000).toISOString()
    });

    await createNotification(orgId, 'subscription_canceled',
        'Subscription Canceled',
        'Your subscription has been canceled. You will lose access to premium features at the end of your billing period.'
    );

    return orgId;
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return null;

    // Record invoice
    await billingService.recordInvoice(orgId, invoice);

    // Record payment attempt success
    await recordPaymentAttempt(orgId, invoice.id, invoice.amount_paid, 'USD', 'succeeded', invoice.payment_intent);

    // Update billing status to active
    await billingService.upsertOrganizationBilling(orgId, {
        status: 'active'
    });

    // Clear any dunning state
    await clearDunningState(orgId);

    console.log(`[Stripe Webhook] Invoice paid for org ${orgId}: ${invoice.id}`);

    // Queue payment receipt email
    await queueBillingEmail(orgId, 'invoice_paid', {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        amount: (invoice.amount_paid / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        pdf_url: invoice.invoice_pdf
    });

    await createNotification(orgId, 'invoice_paid',
        'Payment Successful',
        `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed.`
    );

    return orgId;
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return null;

    // Record failed payment attempt
    const failureReason = invoice.last_finalization_error?.message || 'Payment failed';
    await recordPaymentAttempt(orgId, invoice.id, invoice.amount_due, 'USD', 'failed', invoice.payment_intent, failureReason);

    // Update billing status
    await billingService.upsertOrganizationBilling(orgId, {
        status: 'past_due'
    });

    // Initialize or update dunning state
    await initializeDunning(orgId, invoice.subscription, invoice.amount_due);

    console.log(`[Stripe Webhook] Invoice payment failed for org ${orgId}: ${invoice.id}`);

    // Queue payment failed email
    await queueBillingEmail(orgId, 'payment_failed', {
        invoice_id: invoice.id,
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        failure_reason: failureReason,
        retry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });

    await createNotification(orgId, 'payment_failed',
        'Payment Failed',
        'Your payment could not be processed. Please update your payment method to avoid service interruption.',
        'high'
    );

    return orgId;
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return null;

    // Record draft invoice
    await billingService.recordInvoice(orgId, invoice);

    console.log(`[Stripe Webhook] Invoice created for org ${orgId}: ${invoice.id}`);

    // Queue invoice created email
    await queueBillingEmail(orgId, 'invoice_created', {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        amount: (invoice.amount_due / 100).toFixed(2),
        currency: invoice.currency.toUpperCase(),
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null
    });

    return orgId;
}

// =====================================================
// NEW EVENT HANDLERS
// =====================================================

/**
 * Handle checkout session completed event
 * Activates subscription after successful checkout
 */
async function handleCheckoutSessionCompleted(session) {
    console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);

    const orgId = session.metadata?.organization_id || session.client_reference_id;

    if (!orgId) {
        console.warn('[Stripe Webhook] No organization ID in checkout session metadata');
        return null;
    }

    try {
        // Update checkout session record
        await dbRun(`
            UPDATE checkout_sessions 
            SET status = 'completed', completed_at = datetime('now'), 
                amount_total = ?, customer_email = ?
            WHERE stripe_session_id = ?
        `, [session.amount_total, session.customer_email, session.id]);
    } catch (err) {
        // Table might not exist
        console.log('[Stripe Webhook] checkout_sessions table not found');
    }

    // Link customer to organization if not already linked
    if (session.customer) {
        await billingService.upsertOrganizationBilling(orgId, {
            stripe_customer_id: session.customer,
            billing_email: session.customer_email
        });
    }

    // If subscription mode, the subscription events will handle the rest
    if (session.mode === 'subscription' && session.subscription) {
        console.log(`[Stripe Webhook] Subscription ${session.subscription} will be handled by subscription events`);
    }

    // Queue welcome email
    await queueBillingEmail(orgId, 'subscription_renewed', {
        checkout_session_id: session.id,
        customer_email: session.customer_email,
        amount_total: session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00'
    });

    await createNotification(orgId, 'checkout_completed',
        'Welcome to Your Plan',
        'Your checkout was successful. Thank you for subscribing!'
    );

    return orgId;
}

/**
 * Handle payment intent succeeded event
 * Records successful payment
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log(`[Stripe Webhook] Payment intent succeeded: ${paymentIntent.id}`);

    const customerId = paymentIntent.customer;
    const orgId = customerId ? await getOrgIdFromCustomer(customerId) : null;

    // Record payment attempt
    if (orgId) {
        await recordPaymentAttempt(
            orgId,
            paymentIntent.invoice,
            paymentIntent.amount,
            paymentIntent.currency.toUpperCase(),
            'succeeded',
            paymentIntent.id
        );

        // Clear dunning if exists
        await clearDunningState(orgId);
    }

    return orgId;
}

/**
 * Handle payment intent failed event
 * Triggers dunning process
 */
async function handlePaymentIntentFailed(paymentIntent) {
    console.log(`[Stripe Webhook] Payment intent failed: ${paymentIntent.id}`);

    const customerId = paymentIntent.customer;
    const orgId = customerId ? await getOrgIdFromCustomer(customerId) : null;

    if (!orgId) return null;

    const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
    const failureCode = paymentIntent.last_payment_error?.code;

    // Record failed payment attempt
    await recordPaymentAttempt(
        orgId,
        paymentIntent.invoice,
        paymentIntent.amount,
        paymentIntent.currency.toUpperCase(),
        'failed',
        paymentIntent.id,
        failureReason,
        failureCode
    );

    return orgId;
}

/**
 * Handle customer updated event
 * Syncs billing info changes
 */
async function handleCustomerUpdated(customer) {
    console.log(`[Stripe Webhook] Customer updated: ${customer.id}`);

    const orgId = await getOrgIdFromCustomer(customer.id);

    if (!orgId) return null;

    // Update billing email if changed
    if (customer.email) {
        await billingService.upsertOrganizationBilling(orgId, {
            billing_email: customer.email
        });
    }

    // Update tax settings if present
    if (customer.tax_ids?.data?.length > 0) {
        const taxId = customer.tax_ids.data[0];
        try {
            await billingService.updateTaxSettings(orgId, {
                tax_id: taxId.value,
                tax_id_type: taxId.type
            });
        } catch (err) {
            console.log('[Stripe Webhook] Could not update tax settings:', err.message);
        }
    }

    console.log(`[Stripe Webhook] Customer info synced for org ${orgId}`);

    return orgId;
}

/**
 * Handle charge refunded event
 * Creates credit note and notifies customer
 */
async function handleChargeRefunded(charge) {
    console.log(`[Stripe Webhook] Charge refunded: ${charge.id}`);

    const customerId = charge.customer;
    const orgId = customerId ? await getOrgIdFromCustomer(customerId) : null;

    if (!orgId) return null;

    // Get refund details
    const refund = charge.refunds?.data?.[0];
    if (!refund) return orgId;

    // Record refund
    try {
        const refundId = uuidv4();
        await dbRun(`
            INSERT INTO billing_refunds (id, organization_id, stripe_refund_id, stripe_charge_id, amount, currency, reason, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            refundId,
            orgId,
            refund.id,
            charge.id,
            refund.amount,
            charge.currency.toUpperCase(),
            refund.reason || 'requested_by_customer',
            refund.status
        ]);
    } catch (err) {
        console.log('[Stripe Webhook] billing_refunds table not found');
    }

    // Queue credit note email
    await queueBillingEmail(orgId, 'credit_note_issued', {
        charge_id: charge.id,
        refund_id: refund.id,
        amount: (refund.amount / 100).toFixed(2),
        currency: charge.currency.toUpperCase(),
        reason: refund.reason || 'Refund processed'
    });

    await createNotification(orgId, 'refund_processed',
        'Refund Processed',
        `A refund of $${(refund.amount / 100).toFixed(2)} has been processed to your account.`
    );

    console.log(`[Stripe Webhook] Refund recorded for org ${orgId}: ${refund.id}`);

    return orgId;
}

/**
 * Handle dispute created event
 * Alerts admin and optionally freezes account
 */
async function handleDisputeCreated(dispute) {
    console.log(`[Stripe Webhook] Dispute created: ${dispute.id}`);

    const chargeId = dispute.charge;
    
    // Get charge to find customer
    let orgId = null;
    try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const charge = await stripe.charges.retrieve(chargeId);
        orgId = charge.customer ? await getOrgIdFromCustomer(charge.customer) : null;
    } catch (err) {
        console.error('[Stripe Webhook] Could not retrieve charge for dispute:', err.message);
    }

    if (!orgId) return null;

    // Record dispute
    try {
        const disputeId = uuidv4();
        await dbRun(`
            INSERT INTO billing_disputes (id, organization_id, stripe_dispute_id, stripe_charge_id, amount, currency, reason, status, evidence_due_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            disputeId,
            orgId,
            dispute.id,
            chargeId,
            dispute.amount,
            dispute.currency.toUpperCase(),
            dispute.reason,
            dispute.status,
            dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null
        ]);
    } catch (err) {
        console.log('[Stripe Webhook] billing_disputes table not found');
    }

    // High priority notification
    await createNotification(orgId, 'dispute_created',
        'Payment Dispute Received',
        `A payment dispute for $${(dispute.amount / 100).toFixed(2)} has been opened. Please review immediately.`,
        'critical'
    );

    console.log(`[Stripe Webhook] Dispute recorded for org ${orgId}: ${dispute.id}`);

    return orgId;
}

/**
 * Handle price updated event
 * Syncs plan pricing changes
 */
async function handlePriceUpdated(price) {
    console.log(`[Stripe Webhook] Price updated: ${price.id}`);

    try {
        // Find plan with this Stripe price ID
        const plan = await dbGet('SELECT id FROM subscription_plans WHERE stripe_price_id = ?', [price.id]);

        if (plan) {
            // Update plan pricing
            const amount = price.unit_amount / 100;
            const interval = price.recurring?.interval;

            if (interval === 'month') {
                await dbRun('UPDATE subscription_plans SET price_monthly = ?, updated_at = datetime("now") WHERE id = ?', [amount, plan.id]);
            } else if (interval === 'year') {
                await dbRun('UPDATE subscription_plans SET price_yearly = ?, updated_at = datetime("now") WHERE id = ?', [amount, plan.id]);
            }

            console.log(`[Stripe Webhook] Plan ${plan.id} pricing updated: ${amount}/${interval}`);
        }
    } catch (err) {
        console.log('[Stripe Webhook] Could not update plan pricing:', err.message);
    }

    return null;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get organization ID from Stripe customer ID
 */
async function getOrgIdFromCustomer(customerId) {
    const row = await dbGet(
        'SELECT organization_id FROM organization_billing WHERE stripe_customer_id = ?',
        [customerId]
    );
    return row?.organization_id;
}

/**
 * Create notification for organization admins
 */
async function createNotification(orgId, type, title, message, priority = 'normal') {
    try {
        const users = await dbAll(
            'SELECT id FROM users WHERE organization_id = ? AND role IN (?, ?, ?)',
            [orgId, 'ADMIN', 'SUPERADMIN', 'OWNER']
        );

        const data = JSON.stringify({ entity_type: 'billing', priority });

        for (const user of users) {
            const notifId = uuidv4();
            await dbRun(
                'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)',
                [notifId, user.id, type, title, message, data]
            );
        }
    } catch (err) {
        console.error('[Stripe Webhook] Failed to create notification:', err.message);
    }
}

/**
 * Queue billing email for sending
 */
async function queueBillingEmail(orgId, templateKey, templateData) {
    try {
        // Get billing email
        const billing = await billingService.getOrganizationBilling(orgId);
        const recipientEmail = billing?.billing_email;

        if (!recipientEmail) {
            console.log('[Stripe Webhook] No billing email found for org:', orgId);
            return;
        }

        const emailId = uuidv4();
        await dbRun(`
            INSERT INTO billing_email_queue (id, organization_id, email_type, recipient_email, subject, template_key, template_data, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            emailId,
            orgId,
            templateKey,
            recipientEmail,
            getEmailSubject(templateKey),
            templateKey,
            JSON.stringify(templateData)
        ]);

        console.log(`[Stripe Webhook] Email queued: ${templateKey} for ${recipientEmail}`);
    } catch (err) {
        // Table might not exist
        console.log('[Stripe Webhook] Could not queue email:', err.message);
    }
}

/**
 * Get email subject by template key
 */
function getEmailSubject(templateKey) {
    const subjects = {
        'invoice_created': 'New Invoice Available',
        'invoice_paid': 'Payment Confirmation',
        'invoice_overdue': 'Invoice Overdue - Action Required',
        'payment_failed': 'Payment Failed - Please Update Payment Method',
        'payment_method_expiring': 'Your Payment Method is Expiring Soon',
        'subscription_renewed': 'Subscription Renewed Successfully',
        'subscription_canceled': 'Subscription Cancellation Confirmation',
        'credit_note_issued': 'Credit Note Issued'
    };
    return subjects[templateKey] || 'Billing Notification';
}

/**
 * Record payment attempt
 */
async function recordPaymentAttempt(orgId, invoiceId, amount, currency, status, paymentIntentId, failureReason = null, failureCode = null) {
    try {
        const attemptId = uuidv4();

        // Get current attempt number
        const existing = await dbGet(`
            SELECT MAX(attempt_number) as max_attempt 
            FROM payment_attempts 
            WHERE organization_id = ? AND invoice_id = ?
        `, [orgId, invoiceId]);

        const attemptNumber = (existing?.max_attempt || 0) + 1;

        await dbRun(`
            INSERT INTO payment_attempts (id, organization_id, invoice_id, amount, currency, status, stripe_payment_intent_id, failure_reason, failure_code, attempt_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [attemptId, orgId, invoiceId, amount, currency, status, paymentIntentId, failureReason, failureCode, attemptNumber]);

        return attemptId;
    } catch (err) {
        console.log('[Stripe Webhook] Could not record payment attempt:', err.message);
        return null;
    }
}

/**
 * Record subscription state transition
 */
async function recordStateTransition(orgId, subscriptionId, previousState, newState, triggerEvent, triggerEventId) {
    try {
        const id = uuidv4();
        await dbRun(`
            INSERT INTO subscription_state_history (id, organization_id, subscription_id, previous_state, new_state, trigger_event, trigger_event_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, orgId, subscriptionId, previousState, newState, triggerEvent, triggerEventId]);
    } catch (err) {
        console.log('[Stripe Webhook] Could not record state transition:', err.message);
    }
}

/**
 * Initialize dunning state for failed payment
 */
async function initializeDunning(orgId, subscriptionId, amountDue) {
    try {
        const existing = await dbGet('SELECT id, current_step FROM dunning_states WHERE organization_id = ?', [orgId]);

        if (existing) {
            // Increment step
            await dbRun(`
                UPDATE dunning_states 
                SET current_step = current_step + 1, 
                    last_attempt_at = datetime('now'),
                    next_attempt_at = datetime('now', '+3 days'),
                    total_amount_due = ?,
                    updated_at = datetime('now')
                WHERE organization_id = ?
            `, [amountDue, orgId]);
        } else {
            // Create new dunning state
            const id = uuidv4();
            await dbRun(`
                INSERT INTO dunning_states (id, organization_id, subscription_id, current_step, last_attempt_at, next_attempt_at, total_amount_due)
                VALUES (?, ?, ?, 1, datetime('now'), datetime('now', '+3 days'), ?)
            `, [id, orgId, subscriptionId, amountDue]);
        }
    } catch (err) {
        console.log('[Stripe Webhook] Could not initialize dunning:', err.message);
    }
}

/**
 * Clear dunning state after successful payment
 */
async function clearDunningState(orgId) {
    try {
        await dbRun(`
            UPDATE dunning_states 
            SET status = 'resolved', updated_at = datetime('now')
            WHERE organization_id = ? AND status = 'active'
        `, [orgId]);
    } catch (err) {
        console.log('[Stripe Webhook] Could not clear dunning state:', err.message);
    }
}

export default router;
