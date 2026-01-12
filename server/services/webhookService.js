import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Webhook Service - Trigger webhooks for various events
 */
class WebhookService extends BaseService {
    constructor() {
        super();
        this._fetch = globalThis.fetch;
    }

    /**
     * Initialize dependencies
     */
    async init() {
        await super.init();
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps) {
        super.setDependencies(newDeps);
        if (newDeps.fetch) this._fetch = newDeps.fetch;
    }

    /**
     * Get all webhooks for an organization
     */
    async getWebhooks(organizationId, filters = {}) {
        await this.init();

        const { enabled } = filters;
        let query = 'SELECT * FROM webhooks WHERE organization_id = ?';
        const params = [organizationId];

        if (enabled !== undefined) {
            query += ' AND is_active = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        const rows = await this.queryAll(query, params);

        return rows.map(row => ({
            ...row,
            events: row.events ? JSON.parse(row.events) : [],
            retry_policy: row.retry_policy ? JSON.parse(row.retry_policy) : null,
            headers: row.headers ? JSON.parse(row.headers) : null,
            payload_template: row.payload_template ? JSON.parse(row.payload_template) : null,
            is_active: row.is_active === 1
        }));
    }

    /**
     * Get webhook by ID
     */
    async getWebhookById(id) {
        await this.init();

        const row = await this.queryOne('SELECT * FROM webhooks WHERE id = ?', [id]);
        if (!row) return null;

        return {
            ...row,
            events: row.events ? JSON.parse(row.events) : [],
            retry_policy: row.retry_policy ? JSON.parse(row.retry_policy) : null,
            headers: row.headers ? JSON.parse(row.headers) : null,
            payload_template: row.payload_template ? JSON.parse(row.payload_template) : null,
            is_active: row.is_active === 1
        };
    }

    /**
     * Create a webhook
     */
    async createWebhook(webhookData) {
        await this.init();

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

        await this.queryRun(
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
            ]
        );

        return { id, ...webhookData };
    }

    /**
     * Update a webhook
     */
    async updateWebhook(id, updates) {
        await this.init();

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

        await this.queryRun(
            `UPDATE webhooks SET ${updatesList.join(', ')} WHERE id = ?`,
            params
        );

        return this.getWebhookById(id);
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(id) {
        await this.init();
        const result = await this.queryRun('DELETE FROM webhooks WHERE id = ?', [id]);
        return { deleted: result.changes > 0 };
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
        await this.init();

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

        const rows = await this.queryAll(query, params);

        return rows.map(row => ({
            ...row,
            payload: row.payload ? JSON.parse(row.payload) : null
        }));
    }

    /**
     * Record a webhook delivery
     */
    async recordDelivery(webhookId, eventType, payload, status = 'pending') {
        await this.init();

        const id = uuidv4();
        const now = new Date().toISOString();

        await this.queryRun(
            `INSERT INTO webhook_deliveries (
                id, webhook_id, event_type, payload, status, attempts, created_at
            ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [id, webhookId, eventType, JSON.stringify(payload), status, now]
        );

        return { id, webhook_id: webhookId, status };
    }

    /**
     * Update delivery status
     */
    async updateDeliveryStatus(deliveryId, status, responseCode = null, responseBody = null) {
        await this.init();

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

        const result = await this.queryRun(
            `UPDATE webhook_deliveries SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        return { updated: result.changes > 0 };
    }

    /**
     * Retry a failed delivery
     */
    async retryDelivery(deliveryId) {
        await this.init();

        const delivery = await this.queryOne('SELECT * FROM webhook_deliveries WHERE id = ?', [deliveryId]);
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
        await this.init();

        const webhooks = await this.queryAll(
            `SELECT * FROM webhooks 
             WHERE organization_id = ? 
             AND is_active = 1 
             AND events LIKE ?`,
            [organizationId, `%${eventType}%`]
        );

        if (!webhooks || webhooks.length === 0) {
            return { triggered: 0 };
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

        return { triggered: results.length, results };
    }

    /**
     * Send individual webhook
     */
    async sendWebhook(webhook, eventType, data) {
        await this.init();

        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data
        };

        const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        const response = await this._fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Consultify-Signature': signature,
                'X-Consultify-Event': eventType,
                'User-Agent': 'Consultify-Webhook/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 5000
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
        await this.init();

        try {
            const response = await this._fetch(webhookUrl, {
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

const service = new WebhookService();
export default service;


