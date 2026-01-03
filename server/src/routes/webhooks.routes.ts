/**
 * Webhooks Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Webhook management endpoints and Stripe webhook handler
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js';
import {
    WebhookIdParamSchema,
    GetWebhooksQuerySchema,
    GetDeliveriesQuerySchema,
    CreateWebhookBodySchema,
    UpdateWebhookBodySchema,
    TestWebhookBodySchema,
    RetryDeliveryBodySchema,
} from '../validators/webhooks.validators.js';

const router = Router();
import webhookService from '../services/WebhookService.js';
// Dynamic imports for services that may still be wrappers
let DunningService: any;
let InvoiceService: any;

// Lazy load services to avoid circular dependencies
async function getDunningService() {
    if (!DunningService) {
        const module = await import('../services/dunningService.js');
        DunningService = module.default || module;
    }
    return DunningService;
}

async function getInvoiceService() {
    if (!InvoiceService) {
        const module = await import('../services/InvoiceService.js');
        InvoiceService = module.default || module;
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
        const orgId = req.user?.organizationId || req.query.organizationId as string;
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const { enabled } = req.query;
        const filters = { 
            enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined 
        };
        const webhooks = await webhookService.getWebhooks(orgId, filters);
        res.json(webhooks);
    })
);

/**
 * GET /api/webhooks/:id
 * Get webhook by ID
 */
router.get(
    '/:id',
    validateParams(WebhookIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const webhook = await webhookService.getWebhookById(id);

        if (!webhook) {
            res.status(404).json({ error: 'Webhook not found' });
            return;
        }

        res.json(webhook);
    })
);

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post(
    '/',
    validateBody(CreateWebhookBodySchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId || req.body.organization_id as string;
        if (!orgId) {
            res.status(400).json({ error: 'Organization ID required' });
            return;
        }

        const webhookData = {
            ...req.body,
            organization_id: orgId,
            created_by: req.user?.id
        };

        const webhook = await webhookService.createWebhook(webhookData);
        res.status(201).json(webhook);
    })
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
        const { id } = req.params;
        const webhook = await webhookService.updateWebhook(id, req.body);
        res.json(webhook);
    })
);

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete(
    '/:id',
    validateParams(WebhookIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const result = await webhookService.deleteWebhook(id);
        res.json(result);
    })
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
        const { id } = req.params;
        const { payload } = req.body;

        const result = await webhookService.testWebhook(id, payload);
        res.json(result);
    })
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
        const { id } = req.params;
        const { status, eventType, page = '1', pageSize = '50' } = req.query;

        const filters = { status, eventType };
        const pagination = { 
            page: parseInt(page as string), 
            pageSize: parseInt(pageSize as string) 
        };

        const deliveries = await webhookService.getDeliveries(id, filters, pagination);
        res.json(deliveries);
    })
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
    })
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
                case 'invoice.payment_failed':
                    await dunning.processPaymentFailure({
                        subscriptionId: data.subscription,
                        customerId: data.customer,
                        invoiceId: data.id,
                        amountDue: data.amount_due,
                        currency: data.currency,
                        failureReason: data.last_payment_error?.message || 'Unknown error'
                    });
                    break;

                case 'invoice.payment_succeeded':
                    await dunning.processPaymentSuccess(data.subscription);
                    await invoice.createFromStripe(data);
                    break;

                case 'customer.subscription.deleted':
                    console.log(`[Webhook] Subscription canceled: ${data.id}`);
                    break;
            }

            res.json({ received: true });
        } catch (error) {
            console.error('[Webhook] Error processing event:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    })
);

export default router;

