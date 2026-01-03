/**
 * Stripe Webhook Routes
 * Processes Stripe events for subscription lifecycle management
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response, Request, NextFunction } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Helper function for async handler
function asyncHandler(fn: (req: Request, res: Response) => Promise<void> | void) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res)).catch(next);
    };
}

// Billing Service interface
interface BillingServiceInterface {
    updateSubscription?: (subscriptionId: string, data: unknown) => Promise<void>;
    cancelSubscription?: (subscriptionId: string) => Promise<void>;
    createInvoice?: (invoiceData: unknown) => Promise<void>;
}

// Dynamic import for billingService (may not be migrated yet)
let billingService: BillingServiceInterface | null = null;

try {
    const billingModule = await import('../../../services/billingService.js');
    billingService = (billingModule.default || billingModule) as BillingServiceInterface;
} catch {
    console.warn('[Stripe Webhook] billingService not available');
}

// Stripe webhook secret for signature verification
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/stripe', express.raw({ type: 'application/json' }), asyncHandler(async (req: Request, res: Response) => {
    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (endpointSecret) {
        const sig = req.headers['stripe-signature'] as string;
        try {
            const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY || '');
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Webhook signature verification failed:', errorMessage);
            return res.status(400).send(`Webhook Error: ${errorMessage}`);
        }
    } else {
        // For development without signature verification
        event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Stripe.Event;
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
    } catch (error: unknown) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Webhook processing failed' });
    }
}));

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) {
        console.warn('No organization found for customer:', customerId);
        return;
    }

    if (billingService?.upsertOrganizationBilling) {
        await billingService.upsertOrganizationBilling(orgId, {
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
        });
    }

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
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    if (billingService?.upsertOrganizationBilling) {
        await billingService.upsertOrganizationBilling(orgId, {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000)
        });
    }

    console.log(`Subscription updated for org ${orgId}: ${subscription.status}`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    if (billingService?.upsertOrganizationBilling) {
        await billingService.upsertOrganizationBilling(orgId, {
            status: 'canceled',
            stripe_subscription_id: null
        });
    }

    console.log(`Subscription canceled for org ${orgId}`);

    await createNotification(orgId, 'subscription_canceled',
        'Subscription Canceled',
        'Your subscription has been canceled. You will lose access to premium features at the end of your billing period.'
    );
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Record invoice
    if (billingService?.recordInvoice) {
        await billingService.recordInvoice(orgId, invoice);
    }

    // Update billing status to active
    if (billingService?.upsertOrganizationBilling) {
        await billingService.upsertOrganizationBilling(orgId, {
            status: 'active'
        });
    }

    console.log(`Invoice paid for org ${orgId}: ${invoice.id}`);

    await createNotification(orgId, 'invoice_paid',
        'Payment Successful',
        `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed.`
    );
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Update billing status
    if (billingService?.upsertOrganizationBilling) {
        await billingService.upsertOrganizationBilling(orgId, {
            status: 'past_due'
        });
    }

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
async function handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer;
    const orgId = await getOrgIdFromCustomer(customerId);

    if (!orgId) return;

    // Record draft invoice
    if (billingService?.recordInvoice) {
        await billingService.recordInvoice(orgId, invoice);
    }

    console.log(`Invoice created for org ${orgId}: ${invoice.id}`);
}

/**
 * Helper: Get organization ID from Stripe customer ID
 */
async function getOrgIdFromCustomer(customerId: string): Promise<string | null> {
    const row = await dbGet<{ organization_id?: string }>(
        'SELECT organization_id FROM organization_billing WHERE stripe_customer_id = ?',
        [customerId]
    );
    return row?.organization_id || null;
}

/**
 * Helper: Create notification for organization admins
 */
async function createNotification(orgId: string, type: string, title: string, message: string, priority = 'normal'): Promise<void> {
    try {
        // Get admin users for this org
        const users = await dbAll<{ id: string }>(
            'SELECT id FROM users WHERE organization_id = ? AND role IN (?, ?)',
            [orgId, 'ADMIN', 'SUPERADMIN']
        );

        const data = JSON.stringify({ entity_type: 'billing', priority });

        // Create notifications for all admin users
        for (const user of users || []) {
            await dbRun(
                'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), user.id, type, title, message, data]
            );
        }
    } catch (err) {
        console.error('[Stripe Webhook] Error creating notifications:', err);
        // Don't throw - notification failure shouldn't break webhook processing
    }
}

export default router;

