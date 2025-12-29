const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const WebhookDeliveryService = require('../services/webhookDeliveryService');

// All routes require auth
router.use(authMiddleware);

/**
 * GET /api/webhooks
 * List subscriptions for current org
 */
router.get('/', async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const subscriptions = await WebhookDeliveryService.listSubscriptions(orgId);
        
        // Parse event_types JSON for each subscription
        const formatted = subscriptions.map(sub => ({
            id: sub.id,
            name: sub.name,
            targetUrl: sub.target_url,
            eventTypes: JSON.parse(sub.event_types || '[]'),
            isActive: !!sub.is_active,
            createdAt: sub.created_at,
            updatedAt: sub.updated_at
        }));
        
        res.json({ subscriptions: formatted });
    } catch (error) {
        console.error('[Webhooks] List error:', error);
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
});

/**
 * GET /api/webhooks/events
 * List available event types
 */
router.get('/events', async (req, res) => {
    try {
        const events = WebhookDeliveryService.getAvailableEvents();
        res.json({ events });
    } catch (error) {
        console.error('[Webhooks] Get events error:', error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

/**
 * POST /api/webhooks
 * Create a new subscription
 */
router.post('/', async (req, res) => {
    try {
        const { name, targetUrl, eventTypes } = req.body;
        const orgId = req.user.organizationId;

        if (!name || !targetUrl || !Array.isArray(eventTypes)) {
            return res.status(400).json({ error: 'name, targetUrl, and eventTypes array are required' });
        }

        const result = await WebhookDeliveryService.createSubscription(orgId, name, targetUrl, eventTypes);
        res.json(result);
    } catch (error) {
        console.error('[Webhooks] Create error:', error);
        res.status(500).json({ error: 'Failed to create webhook' });
    }
});

/**
 * GET /api/webhooks/:id
 * Get subscription details
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const subscription = await WebhookDeliveryService.getSubscription(id);
        
        if (!subscription) {
            return res.status(404).json({ error: 'Webhook not found' });
        }
        
        // Verify ownership
        if (subscription.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({
            subscription: {
                id: subscription.id,
                name: subscription.name,
                targetUrl: subscription.target_url,
                eventTypes: JSON.parse(subscription.event_types || '[]'),
                isActive: !!subscription.is_active,
                secretKey: subscription.secret_key, // Only shown when explicitly requested
                createdAt: subscription.created_at,
                updatedAt: subscription.updated_at
            }
        });
    } catch (error) {
        console.error('[Webhooks] Get error:', error);
        res.status(500).json({ error: 'Failed to get webhook' });
    }
});

/**
 * PUT /api/webhooks/:id
 * Update subscription
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, targetUrl, eventTypes, isActive } = req.body;
        
        // Verify ownership
        const subscription = await WebhookDeliveryService.getSubscription(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Webhook not found' });
        }
        if (subscription.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await WebhookDeliveryService.updateSubscription(id, {
            name,
            targetUrl,
            eventTypes,
            isActive
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[Webhooks] Update error:', error);
        res.status(500).json({ error: 'Failed to update webhook' });
    }
});

/**
 * DELETE /api/webhooks/:id
 * Delete subscription
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const subscription = await WebhookDeliveryService.getSubscription(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Webhook not found' });
        }
        if (subscription.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await WebhookDeliveryService.deleteSubscription(id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Webhooks] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete webhook' });
    }
});

/**
 * POST /api/webhooks/test
 * Test a webhook URL
 */
router.post('/test', async (req, res) => {
    try {
        const { targetUrl, secret } = req.body;
        
        if (!targetUrl) {
            return res.status(400).json({ error: 'targetUrl is required' });
        }
        
        const result = await WebhookDeliveryService.testWebhook(targetUrl, secret);
        res.json(result);
    } catch (error) {
        console.error('[Webhooks] Test error:', error);
        res.status(500).json({ error: 'Failed to test webhook' });
    }
});

/**
 * GET /api/webhooks/:id/logs
 * Get delivery logs for subscription
 */
router.get('/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit } = req.query;
        
        // Verify ownership
        const subscription = await WebhookDeliveryService.getSubscription(id);
        if (!subscription) {
            return res.status(404).json({ error: 'Webhook not found' });
        }
        if (subscription.organization_id !== req.user.organizationId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const logs = await WebhookDeliveryService.getDeliveryLogs(id, parseInt(limit) || 50);
        res.json({ logs });
    } catch (error) {
        console.error('[Webhooks] Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

module.exports = router;
