const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Use native fetch (Node 18+) - no import needed, globally available

/**
 * Webhook Service - Trigger webhooks for various events
 * Extended with full CRUD and delivery management
 */
class WebhookService {
    /**
     * @param {Object} dbInstance - Database instance (optional, defaults to require)
     * @param {Object} options - Optional dependencies for testing
     * @param {Function} options.fetch - Custom fetch implementation
     */
    constructor(dbInstance = null, options = {}) {
        this.db = dbInstance || db;
        this.fetch = options.fetch || globalThis.fetch;
    }

    /**
     * Get all webhooks for an organization
     */
    async getWebhooks(organizationId, filters = {}) {
        const { enabled } = filters;

        let query = 'SELECT * FROM webhooks WHERE organization_id = ?';
        const params = [organizationId];

        if (enabled !== undefined) {
            query += ' AND is_active = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Webhook] Error fetching webhooks:', err);
                    return reject(err);
                }

                const webhooks = rows.map(row => ({
                    ...row,
                    events: row.events ? JSON.parse(row.events) : [],
                    retry_policy: row.retry_policy ? JSON.parse(row.retry_policy) : null,
                    headers: row.headers ? JSON.parse(row.headers) : null,
                    payload_template: row.payload_template ? JSON.parse(row.payload_template) : null,
                    is_active: row.is_active === 1
                }));

                resolve(webhooks);
            });
        });
    }

    /**
     * Get webhook by ID
     */
    async getWebhookById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM webhooks WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[Webhook] Error fetching webhook:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    events: row.events ? JSON.parse(row.events) : [],
                    retry_policy: row.retry_policy ? JSON.parse(row.retry_policy) : null,
                    headers: row.headers ? JSON.parse(row.headers) : null,
                    payload_template: row.payload_template ? JSON.parse(row.payload_template) : null,
                    is_active: row.is_active === 1
                });
            });
        });
    }

    /**
     * Create a webhook
     */
    async createWebhook(webhookData) {
        const {
            organization_id,
            name,
            description,
            url,
            events = [],
            secret,
            is_active = true,
            retry_policy = { max_attempts: 3, backoff: 'exponential' },
            headers = {},
            payload_template = null,
            created_by
        } = webhookData;

        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO webhooks (
                    id, organization_id, name, description, url, events, secret,
                    is_active, retry_policy, headers, payload_template,
                    created_at, updated_at, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, organization_id, name, description, url,
                    JSON.stringify(events), secret,
                    is_active ? 1 : 0,
                    JSON.stringify(retry_policy),
                    JSON.stringify(headers),
                    payload_template ? JSON.stringify(payload_template) : null,
                    now, now, created_by
                ],
                function (err) {
                    if (err) {
                        console.error('[Webhook] Error creating webhook:', err);
                        return reject(err);
                    }
                    resolve({ id, ...webhookData });
                }
            );
        });
    }

    /**
     * Update a webhook
     */
    async updateWebhook(id, updates) {
        const {
            name,
            description,
            url,
            events,
            secret,
            is_active,
            retry_policy,
            headers,
            payload_template
        } = updates;

        const updatesList = [];
        const params = [];

        if (name !== undefined) {
            updatesList.push('name = ?');
            params.push(name);
        }

        if (description !== undefined) {
            updatesList.push('description = ?');
            params.push(description);
        }

        if (url !== undefined) {
            updatesList.push('url = ?');
            params.push(url);
        }

        if (events !== undefined) {
            updatesList.push('events = ?');
            params.push(JSON.stringify(events));
        }

        if (secret !== undefined) {
            updatesList.push('secret = ?');
            params.push(secret);
        }

        if (is_active !== undefined) {
            updatesList.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }

        if (retry_policy !== undefined) {
            updatesList.push('retry_policy = ?');
            params.push(JSON.stringify(retry_policy));
        }

        if (headers !== undefined) {
            updatesList.push('headers = ?');
            params.push(JSON.stringify(headers));
        }

        if (payload_template !== undefined) {
            updatesList.push('payload_template = ?');
            params.push(payload_template ? JSON.stringify(payload_template) : null);
        }

        if (updatesList.length === 0) {
            return this.getWebhookById(id);
        }

        updatesList.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE webhooks SET ${updatesList.join(', ')} WHERE id = ?`,
                params,
                async function (err) {
                    if (err) {
                        console.error('[Webhook] Error updating webhook:', err);
                        return reject(err);
                    }
                    resolve(await this.getWebhookById(id));
                }.bind(this)
            );
        });
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM webhooks WHERE id = ?', [id], function (err) {
                if (err) {
                    console.error('[Webhook] Error deleting webhook:', err);
                    return reject(err);
                }
                resolve({ deleted: this.changes > 0 });
            });
        });
    }

    /**
     * Test a webhook
     */
    async testWebhook(id, testPayload = {}) {
        const webhook = await this.getWebhookById(id);
        if (!webhook) {
            throw new Error('Webhook not found');
        }

        const payload = testPayload.event ? testPayload : {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            data: testPayload
        };

        try {
            const result = await this.sendWebhook(webhook, payload.event, payload.data);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get webhook deliveries
     */
    async getDeliveries(webhookId, filters = {}, pagination = { page: 1, pageSize: 50 }) {
        const { status, eventType } = filters;
        const { page = 1, pageSize = 50 } = pagination;
        const offset = (page - 1) * pageSize;

        let query = 'SELECT * FROM webhook_deliveries WHERE webhook_id = ?';
        const params = [webhookId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Webhook] Error fetching deliveries:', err);
                    return reject(err);
                }

                const deliveries = rows.map(row => ({
                    ...row,
                    payload: row.payload ? JSON.parse(row.payload) : null
                }));

                resolve(deliveries);
            });
        });
    }

    /**
     * Record a webhook delivery
     */
    async recordDelivery(webhookId, eventType, payload, status = 'pending') {
        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO webhook_deliveries (
                    id, webhook_id, event_type, payload, status, attempts, created_at
                ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
                [id, webhookId, eventType, JSON.stringify(payload), status, now],
                function (err) {
                    if (err) {
                        console.error('[Webhook] Error recording delivery:', err);
                        return reject(err);
                    }
                    resolve({ id, webhook_id: webhookId, status });
                }
            );
        });
    }

    /**
     * Update delivery status
     */
    async updateDeliveryStatus(deliveryId, status, responseCode = null, responseBody = null) {
        const updates = ['status = ?', 'attempts = attempts + 1'];
        const params = [status];

        if (responseCode !== null) {
            updates.push('response_code = ?');
            params.push(responseCode);
        }

        if (responseBody !== null) {
            updates.push('response_body = ?');
            params.push(responseBody);
        }

        if (status === 'success') {
            updates.push('delivered_at = ?');
            params.push(new Date().toISOString());
        }

        params.push(deliveryId);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE webhook_deliveries SET ${updates.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error('[Webhook] Error updating delivery:', err);
                        return reject(err);
                    }
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Retry a failed delivery
     */
    async retryDelivery(deliveryId) {
        const delivery = await new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM webhook_deliveries WHERE id = ?', [deliveryId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!delivery) {
            throw new Error('Delivery not found');
        }

        const webhook = await this.getWebhookById(delivery.webhook_id);
        if (!webhook) {
            throw new Error('Webhook not found');
        }

        const payload = delivery.payload ? JSON.parse(delivery.payload) : {};

        try {
            const result = await this.sendWebhook(webhook, delivery.event_type, payload);
            await this.updateDeliveryStatus(deliveryId, 'success', result.status, result.statusText);
            return { success: true, result };
        } catch (error) {
            await this.updateDeliveryStatus(deliveryId, 'failed', null, error.message);
            throw error;
        }
    }

    /**
     * Trigger webhooks for a specific event
     */
    async trigger(organizationId, eventType, data) {
        return new Promise((resolve, reject) => {
            // Get active webhooks for this organization that listen to this event
            this.db.all(
                `SELECT * FROM webhooks 
                 WHERE organization_id = ? 
                 AND is_active = 1 
                 AND events LIKE ?`,
                [organizationId, `%${eventType}%`],
                async (err, webhooks) => {
                    if (err) {
                        console.error('[Webhook] Query error:', err);
                        return reject(err);
                    }

                    if (!webhooks || webhooks.length === 0) {
                        return resolve({ triggered: 0 });
                    }

                    const results = [];

                    for (const webhook of webhooks) {
                        try {
                            const result = await this.sendWebhook(webhook, eventType, data);
                            results.push({ webhookId: webhook.id, success: true, result });
                        } catch (error) {
                            results.push({ webhookId: webhook.id, success: false, error: error.message });
                            console.error(`[Webhook] Failed to send to ${webhook.url}:`, error.message);
                        }
                    }

                    resolve({ triggered: results.length, results });
                }
            );
        });
    }

    /**
     * Send individual webhook
     */
    async sendWebhook(webhook, eventType, data) {
        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data
        };

        // Create HMAC signature
        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        const response = await this.fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Consultify-Signature': signature,
                'X-Consultify-Event': eventType,
                'User-Agent': 'Consultify-Webhook/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 5000 // 5 second timeout
        });

        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
        }

        return {
            status: response.status,
            statusText: response.statusText
        };
    }

    /**
     * Send Slack notification
     */
    async sendSlackNotification(webhookUrl, message) {
        try {
            const response = await this.fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });

            return { success: response.ok, status: response.status };
        } catch (error) {
            console.error('[Slack] Notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Format Slack message for initiative update
     */
    formatInitiativeMessage(initiative, action) {
        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${action}:* ${initiative.name}\n*Axis:* ${initiative.axis}\n*Priority:* ${initiative.priority}`
                    }
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `ROI: ${initiative.roi}% | Cost: $${initiative.capex || 0}`
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Format Slack message for task update
     */
    formatTaskMessage(task, action) {
        const statusEmoji = {
            'not_started': '⚪',
            'in_progress': '🟡',
            'completed': '✅',
            'blocked': '🔴'
        };

        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${statusEmoji[task.status] || '⚪'} *${action}*\n*Task:* ${task.title}\n*Status:* ${task.status}`
                    }
                }
            ]
        };
    }
}

// Export singleton instance
const service = new WebhookService();
service.WebhookService = WebhookService;
module.exports = service;
