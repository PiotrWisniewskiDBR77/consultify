/**
 * Stripe Webhook Routes
 * Processes Stripe events for subscription lifecycle management
 *
 * Fully migrated to TypeScript ES modules
 */

import { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import type { Stripe as StripeTypes } from 'stripe';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { send as sendNotification } from '../../services/notificationService.js';
import * as PartnerCommissionService from '../../services/partnerCommissionService.js';
// Partner services for commission tracking
import * as PartnerReferralService from '../../services/partnerReferralService.js';
// AMD-PRT-ECONOMICS-002: partner economics (commission/discount/accrual/payout)
// are excluded by owner decision; this predicate/guard fails closed before
// any of the writes below (attribution activation, first_payment_at stamp,
// commission row) can execute.
import { assertPartnerEconomicsOperationAllowed } from '../../services/partnerEconomicsPolicy.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

let stripeEventsTableEnsured = false;
async function ensureStripeEventsTable(): Promise<void> {
  if (stripeEventsTableEnsured) return;
  // Keep this compatible with both SQLite and Postgres. SQLite treats JSON as TEXT affinity.
  await dbRun(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      event_type TEXT NOT NULL,
      organization_id TEXT,
      processed_at TIMESTAMP,
      payload JSON,
      status TEXT DEFAULT 'processed',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_stripe_events_org ON stripe_events(organization_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_events(status)`);
  stripeEventsTableEnsured = true;
}

// Exported (alongside the default router export) so the H6.3 acceptance
// suite can exercise the idempotency gate + notification helper directly
// against a real local Postgres, without dragging in the full Stripe
// signature-verification / billingService / dunningService graph. No
// behavior change — same functions the router itself calls.
export async function tryBeginStripeEvent(event: StripeTypes.Event): Promise<boolean> {
  await ensureStripeEventsTable();
  const existing = await dbGet<{ event_id: string }>(
    `SELECT event_id FROM stripe_events WHERE event_id = ? LIMIT 1`,
    [event.id]
  );
  if (existing?.event_id) return false;
  const result = await dbRun(
    `INSERT INTO stripe_events (id, event_id, event_type, payload, status, created_at)
     VALUES (?, ?, ?, ?, 'processing', CURRENT_TIMESTAMP)`,
    [event.id, event.id, event.type, JSON.stringify(event)]
  );
  // H6.3: dbRun fails OPEN by default — a DB error resolves {success:false}
  // instead of rejecting. Without this check, two concurrent deliveries of the
  // SAME Stripe event (SELECT-then-INSERT race above; Stripe does deliver
  // duplicates under retry/timeout) would both pass the SELECT check, one
  // INSERT would lose the event_id UNIQUE-constraint race, and — because the
  // failure was swallowed — this function would still tell the caller "new
  // event", double-firing every handler (including createNotification) for
  // the same event.id. Distinguish the harmless race (dedupe, don't reprocess)
  // from a genuine DB failure (must NOT be reported as deduped — that would
  // ack a webhook to Stripe that we never actually processed).
  if (!result.success) {
    const isDuplicateKey = /unique constraint|duplicate key/i.test(result.error || '');
    if (isDuplicateKey) {
      logger.info(
        `[Stripe Webhook] Concurrent duplicate insert for event ${event.id} — treating as deduped`
      );
      return false;
    }
    throw new Error(`stripe_events insert failed: ${result.error || 'unknown error'}`);
  }
  return true;
}

export async function markStripeEventProcessed(
  event: StripeTypes.Event,
  opts: { organizationId?: string | null } = {}
): Promise<void> {
  await ensureStripeEventsTable();
  await dbRun(
    `UPDATE stripe_events
       SET status = 'processed',
           processed_at = CURRENT_TIMESTAMP,
           organization_id = COALESCE(organization_id, ?),
           payload = ?
     WHERE event_id = ?`,
    [opts.organizationId || null, JSON.stringify(event), event.id]
  );
}

async function markStripeEventFailed(
  event: StripeTypes.Event,
  errorMessage: string,
  opts: { organizationId?: string | null } = {}
): Promise<void> {
  await ensureStripeEventsTable();
  await dbRun(
    `UPDATE stripe_events
       SET status = 'failed',
           processed_at = CURRENT_TIMESTAMP,
           organization_id = COALESCE(organization_id, ?),
           error_message = ?
     WHERE event_id = ?`,
    [opts.organizationId || null, errorMessage, event.id]
  );
}

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
const isProduction = process.env.NODE_ENV === 'production';
const shouldVerifySignature =
  Boolean(endpointSecret) && process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true';

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    if (isProduction && !endpointSecret) {
      logger.error('[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET in production.');
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    let event: StripeTypes.Event;

    // Verify webhook signature if secret is configured (skip in test to keep integration deterministic)
    if (shouldVerifySignature) {
      const sig = req.headers['stripe-signature'] as string;
      try {
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new Error('Stripe API key is not configured');
        }
        if (!sig) {
          throw new Error('Missing stripe-signature header');
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia' as any,
        });
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''));
        event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret!);
      } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Webhook signature verification failed:', errorMessage);
        return res.status(400).send(`Webhook Error: ${errorMessage}`);
      }
    } else {
      // For development without signature verification
      if (Buffer.isBuffer(req.body)) {
        try {
          event = JSON.parse(req.body.toString()) as StripeTypes.Event;
        } catch (err) {
          logger.error('[Stripe Webhook] Error parsing Buffer body:', err);
          return res.status(400).send('Invalid JSON in Buffer');
        }
      } else if (typeof req.body === 'string') {
        try {
          event = JSON.parse(req.body) as StripeTypes.Event;
        } catch (err) {
          logger.error('[Stripe Webhook] Error parsing string body:', err);
          return res.status(400).send('Invalid JSON string');
        }
      } else if (typeof req.body === 'object' && req.body !== null) {
        event = req.body as StripeTypes.Event;
      } else {
        logger.error('[Stripe Webhook] Unknown body type:', typeof req.body);
        return res.status(400).send('Unknown body type');
      }
    }

    logger.info('Stripe webhook received:', event.type);

    try {
      const isNew = await tryBeginStripeEvent(event);
      if (!isNew) {
        logger.info(`[Stripe Webhook] Deduped event: ${event.type} (${event.id})`);
        return res.json({ received: true, deduped: true });
      }

      let organizationIdForEvent: string | null = null;
      switch (event.type) {
        case 'customer.subscription.created':
          organizationIdForEvent = await handleSubscriptionCreated(event.data.object as any);
          break;

        case 'customer.subscription.updated':
          organizationIdForEvent = await handleSubscriptionUpdated(event.data.object as any);
          break;

        case 'customer.subscription.deleted':
          organizationIdForEvent = await handleSubscriptionDeleted(event.data.object as any);
          break;

        case 'invoice.paid':
          organizationIdForEvent = await handleInvoicePaid(event.data.object as any);
          break;

        case 'invoice.payment_failed':
          organizationIdForEvent = await handleInvoicePaymentFailed(event.data.object as any);
          break;

        case 'invoice.created':
          organizationIdForEvent = await handleInvoiceCreated(event.data.object as any);
          break;

        // GAP-INVOICE-003: Handle invoice finalized
        case 'invoice.finalized':
          organizationIdForEvent = await handleInvoiceFinalized(event.data.object as any);
          break;

        // T109: Token billing — idempotent credit on checkout completion
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object as any);
          break;

        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      await markStripeEventProcessed(event, { organizationId: organizationIdForEvent });
      return res.json({ received: true });
    } catch (error: unknown) {
      logger.error('Webhook processing error:', error);
      try {
        await markStripeEventFailed(event, error instanceof Error ? error.message : String(error));
      } catch (markErr) {
        logger.warn('[Stripe Webhook] Failed to persist stripe_events failure state:', markErr);
      }

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

      // H6.4 500-leak sweep: the real error is already logged above
      // (`logger.error('Webhook processing error:', error)`) and persisted
      // via `markStripeEventFailed` — never echo raw `error.message` (can
      // carry DB-driver / Stripe SDK internal detail) back in the response.
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
    return;
  })
);

async function getPlanIdFromStripePriceId(stripePriceId: string | null | undefined) {
  if (!stripePriceId) return null;
  const row = await dbGet<{ id: string }>(
    `SELECT id FROM subscription_plans
     WHERE stripe_price_id = ?
        OR stripe_price_id_monthly = ?
        OR stripe_price_id_yearly = ?
     LIMIT 1`,
    [stripePriceId, stripePriceId, stripePriceId]
  );
  return row?.id || null;
}

async function getManualOverrideState(organizationId: string): Promise<{
  billingRail: string | null;
  contractStatus: string | null;
  isManualOverride: boolean;
}> {
  const existingBilling = (await dbGet(
    `SELECT billing_rail, contract_status, is_manual_override FROM organization_billing WHERE organization_id = ?`,
    [organizationId]
  )) as {
    billing_rail?: string | null;
    contract_status?: string | null;
    is_manual_override?: number | boolean | null;
  } | null;

  return {
    billingRail: existingBilling?.billing_rail || null,
    contractStatus: existingBilling?.contract_status || null,
    isManualOverride:
      String(existingBilling?.billing_rail || '') === 'manual_invoice' &&
      Boolean(existingBilling?.is_manual_override),
  };
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(
  subscription: StripeTypes.Subscription
): Promise<string | null> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) {
    logger.warn('No organization found for customer:', customerId);
    return null;
  }

  const stripePriceId = subscription.items?.data?.[0]?.price?.id || null;
  const planId = await getPlanIdFromStripePriceId(stripePriceId);
  const { isManualOverride } = await getManualOverrideState(orgId);

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      ...(planId ? { subscription_plan_id: planId } : {}),
      ...(isManualOverride ? {} : { billing_rail: 'stripe_subscription', contract_status: null }),
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
    });
  }

  // Keep org type aligned with billing (Stripe is SSOT).
  if (!isManualOverride) {
    try {
      await dbRun(
        `UPDATE organizations SET organization_type = 'PAID', updated_at = datetime('now') WHERE id = ?`,
        [orgId]
      );
    } catch {
      // ignore schema drift
    }
  }

  logger.info(`Subscription created for org ${orgId}`);

  // N2 (DEC-2026-08-25-21): routed through the notification engine instead
  // of the direct-SQL createNotification() helper (notyfikacje-audyt.md §1B).
  await notifyOrgAdmins(
    orgId,
    'subscription_created',
    'Subscription Activated',
    'Your subscription has been activated successfully.'
  );
  return orgId;
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(
  subscription: StripeTypes.Subscription
): Promise<string | null> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;

  const stripePriceId = subscription.items?.data?.[0]?.price?.id || null;
  const planId = await getPlanIdFromStripePriceId(stripePriceId);
  const { isManualOverride } = await getManualOverrideState(orgId);

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      ...(planId ? { subscription_plan_id: planId } : {}),
      ...(isManualOverride ? {} : { billing_rail: 'stripe_subscription', contract_status: null }),
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
    });
  }

  if (
    !isManualOverride &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  ) {
    try {
      await dbRun(
        `UPDATE organizations SET organization_type = 'PAID', updated_at = datetime('now') WHERE id = ?`,
        [orgId]
      );
    } catch {
      // ignore
    }
  }

  logger.info(`Subscription updated for org ${orgId}: ${subscription.status}`);
  return orgId;
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(
  subscription: StripeTypes.Subscription
): Promise<string | null> {
  const customerId = subscription.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;

  const { isManualOverride } = await getManualOverrideState(orgId);

  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'canceled',
      stripe_subscription_id: null,
      ...(isManualOverride ? {} : { billing_rail: 'stripe_subscription' }),
    });
  }

  logger.info(`Subscription canceled for org ${orgId}`);

  // N2 (DEC-2026-08-25-21): routed through the notification engine instead
  // of the direct-SQL createNotification() helper (notyfikacje-audyt.md §1B).
  await notifyOrgAdmins(
    orgId,
    'subscription_canceled',
    'Subscription Canceled',
    'Your subscription has been canceled. You will lose access to premium features at the end of your billing period.'
  );
  return orgId;
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(invoice: StripeTypes.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;
  const { isManualOverride, contractStatus } = await getManualOverrideState(orgId);

  // Record invoice
  if (billingService?.recordInvoice) {
    await billingService.recordInvoice(orgId, invoice);
  }

  // Never let Stripe payment recovery overwrite manually managed contracts.
  if (isManualOverride) {
    logger.info(
      `[Stripe Webhook] invoice.paid recorded for manual contract org ${orgId}; preserving manual state (${contractStatus || 'unknown'})`
    );
  } else if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'active',
    });
  }

  // T109: Exit dunning on successful payment
  try {
    if (!isManualOverride) {
      const { default: dunningService } = await import('../../services/dunningService.js');
      if (dunningService?.handlePaymentSucceeded) {
        const paymentIntentId = invoice.payment_intent as string | undefined;
        if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-11-20.acacia' as StripeTypes.LatestApiVersion,
          });
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          await dunningService.handlePaymentSucceeded(paymentIntent);
        }
      }
    }
  } catch (dunningErr) {
    logger.error('[Stripe Webhook] Dunning recovery error:', dunningErr);
  }

  logger.info(`Invoice paid for org ${orgId}: ${invoice.id}`);

  // =========================================
  // PARTNER COMMISSION TRACKING (GAP-PARTNER-001)
  // =========================================
  try {
    // AMD-PRT-ECONOMICS-002: partner economics (commission/discount/accrual/
    // payout) are excluded by owner decision. Fail closed as the FIRST
    // statement of this block — before the attribution lookup, before the
    // ACTIVE-status/first_payment_at writes below, and before any commission
    // creation — so none of those writes execute. Caught by the existing
    // catch (partnerError) below, which only logs: commission tracking is
    // not the critical path, so the webhook must keep returning success to
    // Stripe regardless of this policy state.
    assertPartnerEconomicsOperationAllowed('commission');

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

  // N2 (DEC-2026-08-25-21): routed through the notification engine instead
  // of the direct-SQL createNotification() helper (notyfikacje-audyt.md §1B).
  await notifyOrgAdmins(
    orgId,
    'invoice_paid',
    'Payment Successful',
    `Your payment of $${(invoice.amount_paid / 100).toFixed(2)} has been processed.`
  );
  return orgId;
}

/**
 * Handle invoice payment failed event
 * T109: Integrates with DunningService for staged recovery flow.
 */
async function handleInvoicePaymentFailed(invoice: StripeTypes.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;

  // Update billing status
  if (billingService?.upsertOrganizationBilling) {
    await billingService.upsertOrganizationBilling(orgId, {
      status: 'past_due',
    });
  }

  logger.info(`Invoice payment failed for org ${orgId}: ${invoice.id}`);

  // T109: Trigger dunning flow
  try {
    const { default: dunningService } = await import('../../services/dunningService.js');
    if (dunningService?.handlePaymentFailed) {
      const paymentIntentId = invoice.payment_intent as string | undefined;
      if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia' as StripeTypes.LatestApiVersion,
        });
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        await dunningService.handlePaymentFailed(paymentIntent);
      } else {
        await dunningService.handlePaymentFailed({
          id: invoice.id,
          customer: customerId,
          metadata: { organization_id: orgId },
          status: 'requires_payment_method',
        } as unknown as StripeTypes.PaymentIntent);
      }
      logger.info(`[Stripe Webhook] Dunning started for org ${orgId}`);
    }
  } catch (dunningErr) {
    logger.error('[Stripe Webhook] Dunning service error:', dunningErr);
  }

  // N1.2: routed through the notification engine (see notifyPaymentFailedAdmins
  // below) instead of the direct-SQL createNotification() helper, so this
  // critical, registry-seeded-for-email type actually sends email.
  await notifyPaymentFailedAdmins(
    orgId,
    'Your payment could not be processed. Please update your payment method to avoid service interruption.'
  );
  return orgId;
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(invoice: StripeTypes.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;

  // Record draft invoice
  if (billingService?.recordInvoice) {
    await billingService.recordInvoice(orgId, invoice);
  }

  logger.info(`Invoice created for org ${orgId}: ${invoice.id}`);
  return orgId;
}

/**
 * Handle invoice finalized event
 * GAP-INVOICE-003: Handle when invoice is finalized and ready for payment
 */
async function handleInvoiceFinalized(invoice: StripeTypes.Invoice): Promise<string | null> {
  const customerId = invoice.customer as string;
  const orgId = await getOrgIdFromCustomer(customerId);

  if (!orgId) return null;

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

  // N2 (DEC-2026-08-25-21): routed through the notification engine instead
  // of the direct-SQL createNotification() helper (notyfikacje-audyt.md §1B).
  if (invoice.amount_due && invoice.amount_due > 0) {
    await notifyOrgAdmins(
      orgId,
      'invoice_finalized',
      'Invoice Ready',
      `A new invoice for $${(invoice.amount_due / 100).toFixed(2)} has been generated and will be charged soon.`
    );
  }
  return orgId;
}

/**
 * T109: Handle checkout.session.completed for token billing (idempotent).
 * Uses stripe_events dedup — if event was already processed, creditTokens is skipped.
 */
async function handleCheckoutSessionCompleted(session: Record<string, unknown>): Promise<void> {
  const metadata = session.metadata as Record<string, string> | undefined;
  if (!metadata?.userId || !metadata?.tokens) {
    logger.info('[Stripe Webhook] checkout.session.completed without token metadata — skipping');
    return;
  }

  const { userId, packageId, tokens, bonusPercent } = metadata;
  const tokenCount = parseInt(tokens, 10);
  const bonus = Math.floor(tokenCount * (parseInt(bonusPercent || '0', 10) / 100));
  const stripePaymentId = session.payment_intent as string | undefined;

  // Idempotency guard: check if this payment was already credited
  if (stripePaymentId) {
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM token_transactions WHERE stripe_payment_id = ? LIMIT 1`,
      [stripePaymentId]
    );
    if (existing) {
      logger.info(`[Stripe Webhook] Token credit already applied for payment ${stripePaymentId}`);
      return;
    }
  }

  try {
    const { default: tokenBillingService } = await import('../../services/tokenBillingService.js');
    if (tokenBillingService?.creditTokens) {
      await tokenBillingService.creditTokens(userId, tokenCount, bonus, {
        packageId,
        stripePaymentId,
      });
      logger.info(
        `[Stripe Webhook] Credited ${tokenCount}+${bonus} tokens to user ${userId} (payment: ${stripePaymentId})`
      );
    }
  } catch (err) {
    logger.error('[Stripe Webhook] Failed to credit tokens:', err);
    throw err;
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
 * Helper: Create notification for organization admins via a direct
 * `INSERT INTO notifications` — bypasses the notification engine entirely
 * (preferences, dedup, every channel but in-app).
 *
 * N2 (DEC-2026-08-25-21): no longer called from this file — all five prior
 * call sites (payment_failed, subscription_created/canceled, invoice_paid,
 * invoice_finalized) now go through notifyOrgAdmins()/send() instead. Left
 * in place (exported, unused here) rather than deleted, since deleting it
 * is out of this ticket's scope and it may still be imported by tests.
 */
export async function createNotification(
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

/**
 * Helper: notify organization admins of a billing lifecycle event through
 * the notification engine (notificationService.send), instead of the
 * direct `INSERT INTO notifications` used by createNotification() above.
 *
 * N1.2/N2 (DEC-2026-08-25-21): routing through send() gives each type the
 * registry's preference/channel handling instead of the direct-SQL path's
 * hardcoded in-app-only behavior (notyfikacje-audyt.md §1B). No explicit
 * `channels` is passed — the registry's `default_channels` for the type
 * decides, same as every other emitter that already goes through send().
 */
export async function notifyOrgAdmins(
  orgId: string,
  type: string,
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical' = 'normal'
): Promise<void> {
  try {
    const users = await dbAll<{ id: string }>(
      'SELECT id FROM users WHERE organization_id = ? AND role IN (?, ?)',
      [orgId, 'ADMIN', 'SUPERADMIN']
    );

    for (const user of users || []) {
      await sendNotification({
        userId: user.id,
        organizationId: orgId,
        type,
        title,
        body: message,
        priority,
        entityType: 'billing',
      });
    }
  } catch (err) {
    logger.error(`[Stripe Webhook] Error sending ${type} notification:`, err);
    // Don't throw - notification failure shouldn't break webhook processing
  }
}

/**
 * N1.2 (DEC-2026-08-25-21): `payment_failed` is seeded in the
 * notification_types registry as is_critical with default channels
 * ["in_app","email"] (server/migrations/257_notification_system.sql:60),
 * but the direct-SQL path never sent email — a failed payment only
 * surfaced if the admin happened to open the app
 * (notyfikacje-audyt.md §1B). Kept as a thin, separately-tested wrapper
 * around notifyOrgAdmins for call-site and test-suite stability.
 */
export async function notifyPaymentFailedAdmins(orgId: string, message: string): Promise<void> {
  return notifyOrgAdmins(orgId, 'payment_failed', 'Payment Failed', message, 'high');
}

export default router;
