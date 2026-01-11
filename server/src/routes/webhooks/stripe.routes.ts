/**
 * Stripe Webhook Routes
 * Processes Stripe events for subscription lifecycle management
 *
 * Fully migrated to TypeScript ES modules
 */

import { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// Partner services for commission tracking
import * as PartnerReferralService from '../../services/partnerReferralService.js';
import * as PartnerCommissionService from '../../services/partnerCommissionService.js';

const router = Router();

// Helper function for async handler
function asyncHandler(fn: (req: Request, res: Response) => Promise<any> | any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

// Dynamic import for billingService (may not be migrated yet)
let billingService: any = null;

try {
  const billingModule = (await import('../../services/BillingService.js')) as any;
  billingService = billingModule.default || billingModule;
} catch {
  logger.warn('[Stripe Webhook] billingService not available');
}

// Stripe webhook secret for signature verification
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (endpointSecret) {
      const sig = req.headers['stripe-signature'] as string;
      try {
        const stripe = ((await import('stripe')) as any).default(
          process.env.STRIPE_SECRET_KEY || ''
        );
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Webhook signature verification failed:', errorMessage);
        return res.status(400).send(`Webhook Error: ${errorMessage}`);
      }
    } else {
      // For development without signature verification
      if (Buffer.isBuffer(req.body)) {
        try {
          event = JSON.parse(req.body.toString()) as Stripe.Event;
        } catch (err) {
          logger.error('[Stripe Webhook] Error parsing Buffer body:', err);
          return res.status(400).send('Invalid JSON in Buffer');
        }
      } else if (typeof req.body === 'string') {
        try {
          event = JSON.parse(req.body) as Stripe.Event;
        } catch (err) {
          logger.error('[Stripe Webhook] Error parsing string body:', err);
          return res.status(400).send('Invalid JSON string');
        }
      } else if (typeof req.body === 'object' && req.body !== null) {
        event = req.body as Stripe.Event;
      } else {
        logger.error('[Stripe Webhook] Unknown body type:', typeof req.body);
        return res.status(400).send('Unknown body type');
      }
    }

    logger.info('Stripe webhook received:', event.type);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object as any);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as any);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as any);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as any);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as any);
          break;

        case 'invoice.created':
          await handleInvoiceCreated(event.data.object as any);
          break;

        // GAP-INVOICE-003: Handle invoice finalized
        case 'invoice.finalized':
          await handleInvoiceFinalized(event.data.object as any);
          break;

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (error: unknown) {
      logger.error('Webhook processing error:', error);

      // GAP-BILLING-002: Queue for retry on failure
      try {
        const webhookRetryService = (await import('../../services/webhookRetryService.js')).default;
        await webhookRetryService.queueForRetry({
          webhookType: 'stripe',
          eventType: event.type,
          eventId: event.id,
          payload: event.data.object as unknown as Record<string, unknown>,
          maxRetries: 5,
        });
        logger.info(`[Stripe Webhook] Queued for retry: ${event.type} (${event.id})`);
      } catch (queueErr) {
        logger.error('[Stripe Webhook] Failed to queue for retry:', queueErr);
      }

      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Webhook processing failed' });
    }
    return;
  })
);

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) {
    logger.warn('No organization found for customer:', customerId);
    return;
  }

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
    });
  }

  logger.info(`Subscription created for org ${orgId}`);

  // Create notification for admin
  await createNotification(
    orgId,
    'subscription_created',
    'Subscription Activated',
    'Your subscription has been activated successfully.'
  );
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
    });
  }

  logger.info(`Subscription updated for org ${orgId}: ${subscription.status}`);
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'canceled',
      stripe_subscription_id: null,
    });
  }

  logger.info(`Subscription canceled for org ${orgId}`);

  await createNotification(
    orgId,
    'subscription_canceled',
    'Subscription Canceled',
    'Your subscription has been canceled. You will lose access to premium features at the end of your billing period.'
  );
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  // Record invoice
  if (billingService?.recordInvoice) {
    await billingService.recordInvoice(orgId, invoice);
  }

  // Update billing status to active
  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'active',
    });
  }

  logger.info(`Invoice paid for org ${orgId}: ${invoice.id}`);

  // =========================================
  // PARTNER COMMISSION TRACKING (GAP-PARTNER-001)
  // =========================================
  try {
    // Check if organization has a partner attribution
    const attribution = await PartnerReferralService.getAttributionByOrganization(orgId);

    if (attribution && attribution.status === 'ACTIVE') {
      // Determine commission rate (use attribution rate or default 15%)
      const commissionRate = attribution.commissionRatePercent || 15;
      const grossAmount = invoice.amount_paid / 100; // Convert from cents to currency

      // Determine transaction type based on billing context
      let transactionType: 'INITIAL' | 'SUBSCRIPTION' | 'RENEWAL' = 'SUBSCRIPTION';

      // Check if this is the first payment for this attribution
      if (!attribution.firstPaymentAt) {
        transactionType = 'INITIAL';

        // Update attribution with first payment date
        await PartnerReferralService.updateAttributionStatus(attribution.id, 'ACTIVE');
        await dbRun(
          `UPDATE partner_attributions SET first_payment_at = datetime('now') WHERE id = ?`,
          [attribution.id]
        );
      } else if (invoice.billing_reason === 'subscription_cycle') {
        transactionType = 'RENEWAL';
      }

      // Create commission transaction
      const commission = await PartnerCommissionService.createCommission({
        partnerOrgId: attribution.partnerOrgId,
        attributionId: attribution.id,
        organizationId: orgId,
        transactionType,
        grossAmount,
        commissionRate,
        currency: invoice.currency?.toUpperCase() || 'EUR',
        stripePaymentId: (invoice as any).payment_intent || undefined,
        stripeInvoiceId: invoice.id,
        billingPeriodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString()
          : undefined,
        billingPeriodEnd: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : undefined,
      });

      if (commission) {
        logger.info(
          `[Partner Commission] Created commission ${commission.id} for partner ${attribution.partnerOrgId}, amount: ${commission.commissionAmount} ${commission.currency}`
        );

        // Update attribution lifetime value
        await dbRun(
          `UPDATE partner_attributions 
                     SET lifetime_value = lifetime_value + ?, 
                         total_commission_earned = total_commission_earned + ?,
                         updated_at = datetime('now')
                     WHERE id = ?`,
          [grossAmount, commission.commissionAmount, attribution.id]
        );

        // GAP-PARTNER-008: Send email notification to partner
        try {
          const PartnerEmailService = await import('../../services/partnerEmailService.js');

          // Get partner contact info
          const partnerInfo = await dbGet<{ partner_name: string; contact_email: string }>(
            `SELECT partner_name, contact_email FROM partner_organizations WHERE id = ?`,
            [attribution.partnerOrgId]
          );

          // Get organization name
          const orgInfo = await dbGet<{ name: string }>(
            `SELECT name FROM organizations WHERE id = ?`,
            [orgId]
          );

          if (partnerInfo?.contact_email) {
            await PartnerEmailService.sendCommissionEarnedNotification({
              partnerEmail: partnerInfo.contact_email,
              partnerName: partnerInfo.partner_name || 'Partner',
              organizationName: orgInfo?.name || 'Customer',
              grossAmount,
              commissionAmount: commission.commissionAmount,
              commissionRate: commission.commissionRate,
              currency: commission.currency,
              transactionDate: commission.transactionDate,
            });
          }
        } catch (emailErr) {
          // Don't fail on email error
          logger.warn('[Partner Commission] Failed to send email notification:', emailErr);
        }
      }
    }
  } catch (partnerError: any) {
    // Log but don't fail the webhook - commission tracking is not critical path
    logger.error(
      '[Partner Commission] Error creating commission:',
      partnerError?.message || partnerError
    );
  }

  await createNotification(
    orgId,
    'invoice_paid',
    'Payment Successful',
    `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed.`
  );
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  // Update billing status
  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'past_due',
    });
  }

  logger.info(`Invoice payment failed for org ${orgId}: ${invoice.id}`);

  await createNotification(
    orgId,
    'payment_failed',
    'Payment Failed',
    'Your payment could not be processed. Please update your payment method to avoid service interruption.',
    'high'
  );
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  // Record draft invoice
  if (billingService?.recordInvoice) {
    await billingService.recordInvoice(orgId, invoice);
  }

  logger.info(`Invoice created for org ${orgId}: ${invoice.id}`);
}

/**
 * Handle invoice finalized event
 * GAP-INVOICE-003: Handle when invoice is finalized and ready for payment
 */
async function handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return;

  // Update invoice status in database
  if (billingService?.recordInvoice) {
    await billingService.recordInvoice(orgId, invoice);
  }

  // Update PDF URL if available
  if (invoice.invoice_pdf) {
    await dbRun(`UPDATE invoices SET pdf_url = ?, status = 'open' WHERE stripe_invoice_id = ?`, [
      invoice.invoice_pdf,
      invoice.id,
    ]);
  }

  logger.info(`Invoice finalized for org ${orgId}: ${invoice.id}`);

  // Create notification for upcoming payment
  if (invoice.amount_due && invoice.amount_due > 0) {
    await createNotification(
      orgId,
      'invoice_finalized',
      'Invoice Ready',
      `A new invoice for $${(invoice.amount_due / 100).toFixed(2)} has been generated and will be charged soon.`
    );
  }
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
async function createNotification(
  orgId: string,
  type: string,
  title: string,
  message: string,
  priority = 'normal'
): Promise<void> {
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
    logger.error('[Stripe Webhook] Error creating notifications:', err);
    // Don't throw - notification failure shouldn't break webhook processing
  }
}

export default router;
