const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const axios = require('axios');

class WebhookDeliveryService {

    /**
     * Trigger an event to be sent to all subscribed webhooks
     * @param {string} orgId - Organization ID the event belongs to
     * @param {string} eventType - e.g., 'initiative.created'
     * @param {object} payload - The data to send
     */
    async triggerEvent(orgId, eventType, payload) {
        console.log(`[Webhook] Triggering ${eventType} for Org ${orgId}`);

        // 1. Find subscriptions for this org and event
        const subs = await this.getSubscriptions(orgId, eventType);
        if (subs.length === 0) return;

        console.log(`[Webhook] Found ${subs.length} items to notify`);

        // 2. Queue delivery attempts
        for (const sub of subs) {
            await this.queueDelivery(sub, eventType, payload);
        }
    }

    async getSubscriptions(orgId, eventType) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM webhook_subscriptions WHERE organization_id = ? AND is_active = 1`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    // Filter in code since event_types is a JSON string
                    const matching = rows.filter(row => {
                        try {
                            const types = JSON.parse(row.event_types);
                            return types.includes(eventType) || types.includes('*');
                        } catch (e) { return false; }
                    });
                    resolve(matching);
                }
            );
        });
    }

    async queueDelivery(sub, eventType, payload) {
        const attemptId = uuidv4();
        const eventId = uuidv4();
        const payloadStr = JSON.stringify({
            id: eventId,
            event: eventType,
            created_at: new Date().toISOString(),
            data: payload
        });

        // Save to DB first
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO webhook_delivery_attempts (id, subscription_id, event_id, event_type, payload, status, next_retry_at) 
                 VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
                [attemptId, sub.id, eventId, eventType, payloadStr],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Attempt immediate delivery (fire and forget mechanism for simplicity in this implementation)
        // In a real scaled system, a worker would pick this up.
        this.processDelivery(attemptId, sub, payloadStr).catch(err => {
            console.error(`[Webhook] Async delivery failed for ${attemptId}`, err.message);
        });
    }

    async processDelivery(attemptId, sub, payload) {
        // Calculate Signature
        const signature = crypto
            .createHmac('sha256', sub.secret_key)
            .update(payload)
            .digest('hex');

        try {
            const start = Date.now();
            const response = await axios.post(sub.target_url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Consultify-Event': sub.event_type, // or specific event
                    'X-Consultify-Signature': `sha256=${signature}`,
                    'User-Agent': 'Consultify-Webhook/1.0'
                },
                timeout: 5000
            });
            const duration = Date.now() - start;

            await this.updateStatus(attemptId, 'success', response.status, `Duration: ${duration}ms`);
            console.log(`[Webhook] Delivered to ${sub.target_url} (${response.status})`);

        } catch (error) {
            console.warn(`[Webhook] Delivery failed to ${sub.target_url}: ${error.message}`);
            // Logic for retry could go here (update next_retry_at)
            await this.updateStatus(attemptId, 'failed', error.response?.status || 0, error.message);
        }
    }

    updateStatus(attemptId, status, code, body) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webhook_delivery_attempts SET status = ?, response_code = ?, response_body = ? WHERE id = ?`,
                [status, code, body, attemptId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    // CRUD for Subscriptions
    async createSubscription(orgId, name, targetUrl, eventTypes) {
        const id = uuidv4();
        const secret = crypto.randomBytes(32).toString('hex');
        const typesJson = JSON.stringify(eventTypes);

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO webhook_subscriptions (id, organization_id, name, target_url, secret_key, event_types) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, orgId, name, targetUrl, secret, typesJson],
                (err) => err ? reject(err) : resolve()
            );
        });

        return { id, secret };
    }
}

module.exports = new WebhookDeliveryService();
