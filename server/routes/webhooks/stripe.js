/**
 * Stripe Webhook Handler
 * Processes Stripe events for subscription lifecycle management
 */

const express = require('express');
const router = express.Router();
const billingService = require('../../services/billingService');
const db = require('../../database');

// Stripe webhook secret for signature verification
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    } else {
        // For development without signature verification
        event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    console.log('Stripe webhook received:', event.type);

    try {
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'invoice.created':
                await handleInvoiceCreated(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) {
        console.warn('No organization found for customer:', customerId);
        return;
    }

    await billingService.upsertOrganizationBilling(orgId, {
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
    });

    console.log(`Subscription created for org ${orgId}`);

    // Create notification for admin
    await createNotification(orgId, 'subscription_created',
        'Subscription Activated',
        'Your subscription has been activated successfully.'
    );
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    await billingService.upsertOrganizationBilling(orgId, {
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000)
    });

    console.log(`Subscription updated for org ${orgId}: ${subscription.status}`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    await billingService.upsertOrganizationBilling(orgId, {
        status: 'canceled',
        stripe_subscription_id: null
    });

    console.log(`Subscription canceled for org ${orgId}`);

    await createNotification(orgId, 'subscription_canceled',
        'Subscription Canceled',
        'Your subscription has been canceled. You will lose access to premium features at the end of your billing period.'
    );
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Record invoice
    await billingService.recordInvoice(orgId, invoice);

    // Update billing status to active
    await billingService.upsertOrganizationBilling(orgId, {
        status: 'active'
    });

    console.log(`Invoice paid for org ${orgId}: ${invoice.id}`);

    await createNotification(orgId, 'invoice_paid',
        'Payment Successful',
        `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed.`
    );
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Update billing status
    await billingService.upsertOrganizationBilling(orgId, {
        status: 'past_due'
    });

    console.log(`Invoice payment failed for org ${orgId}: ${invoice.id}`);

    await createNotification(orgId, 'payment_failed',
        'Payment Failed',
        'Your payment could not be processed. Please update your payment method to avoid service interruption.',
        'high'
    );
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(invoice) {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Record draft invoice
    await billingService.recordInvoice(orgId, invoice);

    console.log(`Invoice created for org ${orgId}: ${invoice.id}`);
}

/**
 * Helper: Get organization ID from Stripe customer ID
 */
function getOrgIdFromCustomer(customerId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT organization_id FROM organization_billing WHERE stripe_customer_id = ?',
            [customerId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row?.organization_id);
            }
        );
    });
}

/**
 * Helper: Create notification for organization admins
 */
function createNotification(orgId, type, title, message, priority = 'normal') {
    return new Promise((resolve, reject) => {
        // Get admin users for this org
        db.all(
            'SELECT id FROM users WHERE organization_id = ? AND role IN (?, ?)',
            [orgId, 'ADMIN', 'SUPERADMIN'],
            (err, users) => {
                if (err) return reject(err);

                const { v4: uuidv4 } = require('uuid');
                const stmt = db.prepare(
                    'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)'
                );

                const data = JSON.stringify({ entity_type: 'billing', priority });

                (users || []).forEach(user => {
                    stmt.run(uuidv4(), user.id, type, title, message, data);
                });

                stmt.finalize((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }
        );
    });
}

module.exports = router;
