/**
 * Webhooks Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Webhook management endpoints and Stripe webhook handler
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    CreateWebhookBodySchema,
    GetDeliveriesQuerySchema,
    GetWebhooksQuerySchema,
    RetryDeliveryBodySchema,
    TestWebhookBodySchema,
    UpdateWebhookBodySchema,
    WebhookIdParamSchema,
} from '../validators/webhooks.validators.js';

const router = Router();
import Stripe from 'stripe';

import type { DunningService } from '../services/DunningService.js';
import type { InvoiceServiceClass } from '../services/InvoiceService.js';
import webhookService from '../services/WebhookService.js';

// Type definitions for lazy-loaded services
interface DunningServiceInstance {
    handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void>;
    handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void>;
    processScheduledRetries(): Promise<void>;
    getDunningStatus(orgId: string): Promise<{
        inDunning: boolean;
        status: string;
        stage: number;
        stageName?: string;
        daysSinceStart: number;
        daysUntilSuspension: number;
        suspensionScheduledAt?: string | null;
    }>;
    manualRetry(orgId: string): Promise<{ success: boolean; message: string; error?: string }>;
    suspendOrganization(orgId: string, reason?: string): Promise<void>;
    reactivateOrganization(orgId: string): Promise<void>;
}

interface InvoiceServiceInstance {
    createFromStripe(stripeInvoice: Stripe.Invoice): Promise<{
        id: string;
        invoiceNumber: string;
        total: number;
        currency: string;
    } | null>;
    createInvoice(options: unknown): Promise<unknown>;
    getInvoice(invoiceId: string): Promise<unknown>;
    listInvoices(organizationId: string, options?: unknown): Promise<unknown[]>;
}

// Dynamic imports for services that may still be wrappers
let DunningService: DunningServiceInstance | null = null;
let InvoiceService: InvoiceServiceInstance | null = null;

// Lazy load services to avoid circular dependencies
async function getDunningService(): Promise<DunningServiceInstance> {
    if (!DunningService) {
        const module = await import('../services/dunningService.js');
        DunningService = (module.default || module) as DunningServiceInstance;
    }
    return DunningService;
}

async function getInvoiceService(): Promise<InvoiceServiceInstance> {
    if (!InvoiceService) {
        const module = await import('../services/InvoiceService.js');
        InvoiceService = (module.default || module) as InvoiceServiceInstance;
    }
    return InvoiceService;
}

// Apply auth middleware to all routes except Stripe webhook
router.use((req, res, next) => {
    if (req.path === '/stripe') {
        return next();
    }
    return verifyToken(req, res, next);
});

/**
 * GET /api/webhooks
 * Get all webhooks for organization
 */
router.get(
    '/',
    validateQuery(GetWebhooksQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId || (req.query.organizationId as string);
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const { enabled } = req.query;
        const filters = {
            enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
        };
        const webhooks = await webhookService.getWebhooks(orgId, filters);
        res.json(webhooks);
    }),
);

/**
 * GET /api/webhooks/:id
 * Get webhook by ID
 */
router.get(
    '/:id',
    validateParams(WebhookIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: 'id is required' });
            return;
        }
        const webhook = await webhookService.getWebhookById(id);

        if (!webhook) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }

        res.json(webhook);
    }),
);

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post(
    '/',
    validateBody(CreateWebhookBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId || (req.body.organization_id as string);
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const webhookData = {
            ...req.body,
            organization_id: orgId,
            created_by: req.user?.id,
        };

        const webhook = await webhookService.createWebhook(webhookData);
        res.status(201).json(webhook);
    }),
);

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put(
    '/:id',
    validateParams(WebhookIdParamSchema),
    validateBody(UpdateWebhookBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: 'id is required' });
            return;
        }
        const webhook = await webhookService.updateWebhook(id, req.body);
        res.json(webhook);
    }),
);

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete(
    '/:id',
    validateParams(WebhookIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: 'id is required' });
            return;
        }
        const result = await webhookService.deleteWebhook(id);
        res.json(result);
    }),
);

/**
 * POST /api/webhooks/:id/test
 * Test a webhook
 */
router.post(
    '/:id/test',
    validateParams(WebhookIdParamSchema),
    validateBody(TestWebhookBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: 'id is required' });
            return;
        }
        const { payload } = req.body;

        const result = await webhookService.testWebhook(id, payload);
        res.json(result);
    }),
);

/**
 * GET /api/webhooks/:id/deliveries
 * Get webhook delivery history
 */
router.get(
    '/:id/deliveries',
    validateParams(WebhookIdParamSchema),
    validateQuery(GetDeliveriesQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            res.status(400).json({ error: 'id is required' });
            return;
        }
        const { status, eventType, page = '1', pageSize = '50' } = req.query;

        const filters = { status, eventType };
        const pagination = {
            page: parseInt(page as string),
            pageSize: parseInt(pageSize as string),
        };

        const deliveries = await webhookService.getDeliveries(id, filters, pagination);
        res.json(deliveries);
    }),
);

/**
 * POST /api/webhooks/:id/retry
 * Retry a failed webhook delivery
 */
router.post(
    '/:id/retry',
    validateParams(WebhookIdParamSchema),
    validateBody(RetryDeliveryBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const { deliveryId } = req.body;
        if (!deliveryId) {
            res.status(400).json({ error: 'Delivery ID required' });
            return;
        }

        const result = await webhookService.retryDelivery(deliveryId);
        res.json(result);
    }),
);

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler (no auth required)
 */
router.post(
    '/stripe',
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const event = req.body;
        const type = event.type;
        const data = event.data?.object;

        console.log(`[Webhook] Received Stripe event: ${type}`);

        try {
            const dunning = await getDunningService();
            const invoice = await getInvoiceService();

            switch (type) {
                case 'invoice.payment_failed': {
                    // Convert Invoice to PaymentIntent-like structure for DunningService
                    const invoice = data as Stripe.Invoice;
                    const paymentIntentId = invoice.payment_intent as string | undefined;

                    if (paymentIntentId) {
                        // If we have payment_intent, we can handle it directly
                        // For now, we'll start dunning process based on invoice data
                        const orgId = invoice.metadata?.organization_id;
                        if (orgId) {
                            // Get organization and start dunning if needed
                            const org = await dunning.getDunningStatus(orgId);
                            if (!org || (org as { inDunning: boolean }).inDunning === false) {
                                // Create a mock PaymentIntent structure for handlePaymentFailed
                                const mockPaymentIntent = {
                                    id: paymentIntentId,
                                    amount: invoice.amount_due || 0,
                                    currency: invoice.currency || 'usd',
                                    metadata: invoice.metadata || {},
                                    last_payment_error: {
                                        code: 'payment_failed',
                                        message: invoice.last_payment_error?.message || 'Payment failed',
                                    },
                                } as Stripe.PaymentIntent;

                                await dunning.handlePaymentFailed(mockPaymentIntent);
                            }
                        }
                    }
                    break;
                }

                case 'invoice.payment_succeeded': {
                    const invoice = data as Stripe.Invoice;
                    const paymentIntentId = invoice.payment_intent as string | undefined;

                    if (paymentIntentId) {
                        const mockPaymentIntent = {
                            id: paymentIntentId,
                            amount: invoice.amount_paid || 0,
                            currency: invoice.currency || 'usd',
                            metadata: invoice.metadata || {},
                        } as Stripe.PaymentIntent;

                        await dunning.handlePaymentSucceeded(mockPaymentIntent);
                    }

                    await invoice.createFromStripe(invoice);
                    break;
                }

                case 'customer.subscription.deleted':
                    console.log(`[Webhook] Subscription canceled: ${data.id}`);
                    break;
            }

            res.json({ received: true });
        } catch (error: unknown) {
            console.error('[Webhook] Error processing event:', error);
            return res.status(500).json({ error: 'Webhook processing failed' });
        }
    }),
);

export default router;
