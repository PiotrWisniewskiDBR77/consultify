const express = require('express');
const router = express.Router();
const db = require('../database');
const verifyToken = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

// GET all webhooks for organization
router.get('/', verifyToken, (req, res) => {
    const { organizationId } = req.user;

    db.all(
        'SELECT * FROM webhooks WHERE organization_id = ? ORDER BY created_at DESC',
        [organizationId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// CREATE webhook
router.post('/', verifyToken, (req, res) => {
    const { organizationId, userId } = req.user;
    const { url, events, name, description, isActive = true } = req.body;

    if (!url || !events || !Array.isArray(events)) {
        return res.status(400).json({ error: 'URL and events array required' });
    }

    const id = uuidv4();
    const secret = uuidv4(); // Webhook secret for signature verification

    db.run(
        `INSERT INTO webhooks (id, organization_id, name, description, url, events, secret, is_active, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, organizationId, name, description, url, JSON.stringify(events), secret, isActive ? 1 : 0, userId],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id,
                organizationId,
                name,
                url,
                events,
                secret,
                isActive,
                message: 'Webhook created successfully'
            });
        }
    );
});

// UPDATE webhook
router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { organizationId } = req.user;
    const { url, events, name, description, isActive } = req.body;

    db.run(
        `UPDATE webhooks 
         SET url = COALESCE(?, url),
             events = COALESCE(?, events),
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             is_active = COALESCE(?, is_active),
             updated_at = datetime('now')
         WHERE id = ? AND organization_id = ?`,
        [url, events ? JSON.stringify(events) : null, name, description, isActive !== undefined ? (isActive ? 1 : 0) : null, id, organizationId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
            res.json({ success: true, message: 'Webhook updated' });
        }
    );
});

// DELETE webhook
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { organizationId } = req.user;

    db.run(
        'DELETE FROM webhooks WHERE id = ? AND organization_id = ?',
        [id, organizationId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
            res.json({ success: true, message: 'Webhook deleted' });
        }
    );
});

// TEST webhook (send test payload)
router.post('/:id/test', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { organizationId } = req.user;

    db.get(
        'SELECT * FROM webhooks WHERE id = ? AND organization_id = ?',
        [id, organizationId],
        async (err, webhook) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

            const testPayload = {
                event: 'webhook.test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from Consultify',
                    webhookId: id,
                    organizationId
                }
            };

            try {
                const fetch = (await import('node-fetch')).default;
                const crypto = require('crypto');

                // Create signature
                const signature = crypto
                    .createHmac('sha256', webhook.secret)
                    .update(JSON.stringify(testPayload))
                    .digest('hex');

                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Consultify-Signature': signature,
                        'X-Consultify-Event': 'webhook.test'
                    },
                    body: JSON.stringify(testPayload)
                });

                res.json({
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    );
});

module.exports = router;
