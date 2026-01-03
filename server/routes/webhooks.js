const express = require('express');
const router = express.Router();
const DunningService = require('../services/dunningService');
const InvoiceService = require('../services/invoiceService');
const webhookService = require('../services/webhookService');
const authMiddleware = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

/**
 * GET /api/webhooks
 * Get all webhooks for organization
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.query.organizationId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const { enabled } = req.query;
        const filters = { enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined };
        const webhooks = await webhookService.getWebhooks(orgId, filters);
        res.json(webhooks);
    } catch (error) {
        console.error('[Webhook] Error fetching webhooks:', error);
        res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
});

/**
 * GET /api/webhooks/:id
 * Get webhook by ID
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const webhook = await webhookService.getWebhookById(id);

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        res.json(webhook);
    } catch (error) {
        console.error('[Webhook] Error fetching webhook:', error);
        res.status(500).json({ error: 'Failed to fetch webhook' });
    }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.body.organization_id;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const webhookData = {
            ...req.body,
            organization_id: orgId,
            created_by: req.user.id
        };

        const webhook = await webhookService.createWebhook(webhookData);
        res.status(201).json(webhook);
    } catch (error) {
        console.error('[Webhook] Error creating webhook:', error);
        res.status(500).json({ error: error.message || 'Failed to create webhook' });
    }
});

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const webhook = await webhookService.updateWebhook(id, req.body);
        res.json(webhook);
    } catch (error) {
        console.error('[Webhook] Error updating webhook:', error);
        res.status(500).json({ error: error.message || 'Failed to update webhook' });
    }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await webhookService.deleteWebhook(id);
        res.json(result);
    } catch (error) {
        console.error('[Webhook] Error deleting webhook:', error);
        res.status(500).json({ error: error.message || 'Failed to delete webhook' });
    }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook
 */
router.post('/:id/test', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { payload } = req.body;

        const result = await webhookService.testWebhook(id, payload);
        res.json(result);
    } catch (error) {
        console.error('[Webhook] Error testing webhook:', error);
        res.status(500).json({ error: error.message || 'Failed to test webhook' });
    }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get webhook delivery history
 */
router.get('/:id/deliveries', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, eventType, page = 1, pageSize = 50 } = req.query;

        const filters = { status, eventType };
        const pagination = { page: parseInt(page), pageSize: parseInt(pageSize) };

        const deliveries = await webhookService.getDeliveries(id, filters, pagination);
        res.json(deliveries);
    } catch (error) {
        console.error('[Webhook] Error fetching deliveries:', error);
        res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
    }
});

/**
 * POST /api/webhooks/:id/retry
 * Retry a failed webhook delivery
 */
router.post('/:id/retry', authMiddleware, async (req, res) => {
    try {
        const { deliveryId } = req.body;
        if (!deliveryId) {
            return res.status(400).json({ error: 'Delivery ID required' });
        }

        const result = await webhookService.retryDelivery(deliveryId);
        res.json(result);
    } catch (error) {
        console.error('[Webhook] Error retrying delivery:', error);
        res.status(500).json({ error: error.message || 'Failed to retry webhook delivery' });
    }
});

// Stripe webhook handler (existing functionality)
router.post('/stripe', async (req, res) => {
    const event = req.body;
    const type = event.type;
    const data = event.data?.object;

    console.log(`[Webhook] Received Stripe event: ${type}`);

    try {
        switch (type) {
            case 'invoice.payment_failed':
                // Handle payment failure in Dunning Service
                await DunningService.processPaymentFailure({
                    subscriptionId: data.subscription,
                    customerId: data.customer,
                    invoiceId: data.id,
                    amountDue: data.amount_due,
                    currency: data.currency,
                    failureReason: data.last_payment_error?.message || 'Unknown error'
                });
                break;

            case 'invoice.payment_succeeded':
                // Handle success (recover dunning if active)
                await DunningService.processPaymentSuccess(data.subscription);

                // Create/Update local invoice
                await InvoiceService.createFromStripe(data);
                break;

            case 'customer.subscription.deleted':
                // Handle cancellation
                console.log(`[Webhook] Subscription canceled: ${data.id}`);
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
