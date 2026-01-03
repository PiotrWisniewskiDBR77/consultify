// Dependency injection for testing
import axios from 'axios';


const deps = {
    _db: null,
    _uuidv4: null,
    _crypto: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get crypto() { return this._crypto; },
    set crypto(val) { this._crypto = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../database.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._crypto) {
        const crypto = await import('crypto');
        deps._crypto = crypto.default;
    }
}

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
    
    /**
     * List all subscriptions for organization
     */
    async listSubscriptions(orgId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM webhook_subscriptions WHERE organization_id = ? ORDER BY created_at DESC`,
                [orgId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
    
    /**
     * Get subscription by ID
     */
    async getSubscription(subscriptionId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM webhook_subscriptions WHERE id = ?`,
                [subscriptionId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                }
            );
        });
    }
    
    /**
     * Update subscription
     */
    async updateSubscription(subscriptionId, updates) {
        const fields = [];
        const params = [];
        
        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }
        if (updates.targetUrl !== undefined) {
            fields.push('target_url = ?');
            params.push(updates.targetUrl);
        }
        if (updates.eventTypes !== undefined) {
            fields.push('event_types = ?');
            params.push(JSON.stringify(updates.eventTypes));
        }
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        
        if (fields.length === 0) return { success: true };
        
        fields.push('updated_at = datetime("now")');
        params.push(subscriptionId);
        
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE webhook_subscriptions SET ${fields.join(', ')} WHERE id = ?`,
                params,
                (err) => err ? reject(err) : resolve({ success: true })
            );
        });
    }
    
    /**
     * Delete subscription
     */
    async deleteSubscription(subscriptionId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM webhook_subscriptions WHERE id = ?`,
                [subscriptionId],
                (err) => err ? reject(err) : resolve({ success: true })
            );
        });
    }
    
    /**
     * Test webhook URL
     */
    async testWebhook(targetUrl, secret = null) {
        const testPayload = JSON.stringify({
            id: uuidv4(),
            event: 'test',
            created_at: new Date().toISOString(),
            data: {
                message: 'This is a test webhook from Consultify',
                timestamp: new Date().toISOString()
            }
        });
        
        const testSecret = secret || crypto.randomBytes(32).toString('hex');
        const signature = crypto
            .createHmac('sha256', testSecret)
            .update(testPayload)
            .digest('hex');
        
        try {
            const start = Date.now();
            const response = await axios.post(targetUrl, testPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Consultify-Event': 'test',
                    'X-Consultify-Signature': `sha256=${signature}`,
                    'User-Agent': 'Consultify-Webhook/1.0'
                },
                timeout: 10000
            });
            const duration = Date.now() - start;
            
            return {
                success: true,
                statusCode: response.status,
                duration,
                message: 'Webhook test successful'
            };
        } catch (error) {
            return {
                success: false,
                statusCode: error.response?.status || 0,
                error: error.message,
                message: 'Webhook test failed'
            };
        }
    }
    
    /**
     * Get delivery logs for subscription
     */
    async getDeliveryLogs(subscriptionId, limit = 50) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM webhook_delivery_attempts 
                 WHERE subscription_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [subscriptionId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }
    
    /**
     * Get available event types
     */
    getAvailableEvents() {
        return [
            // Task events
            { category: 'Tasks', events: [
                { type: 'task.created', description: 'A new task was created' },
                { type: 'task.updated', description: 'A task was updated' },
                { type: 'task.completed', description: 'A task was marked as complete' },
                { type: 'task.assigned', description: 'A task was assigned to a user' },
                { type: 'task.deleted', description: 'A task was deleted' },
            ]},
            // Initiative events
            { category: 'Initiatives', events: [
                { type: 'initiative.created', description: 'A new initiative was created' },
                { type: 'initiative.status_changed', description: 'Initiative status changed' },
                { type: 'initiative.phase_changed', description: 'Initiative moved to new phase' },
            ]},
            // Approval events
            { category: 'Approvals', events: [
                { type: 'approval.requested', description: 'An approval was requested' },
                { type: 'approval.approved', description: 'An approval was granted' },
                { type: 'approval.rejected', description: 'An approval was rejected' },
            ]},
            // User events
            { category: 'Users', events: [
                { type: 'user.invited', description: 'A user was invited' },
                { type: 'user.joined', description: 'A user joined the organization' },
                { type: 'user.removed', description: 'A user was removed' },
            ]},
            // Assessment events
            { category: 'Assessments', events: [
                { type: 'assessment.started', description: 'An assessment was started' },
                { type: 'assessment.completed', description: 'An assessment was completed' },
            ]},
        ];
    }
}

const webhookDeliveryServiceInstance = new WebhookDeliveryService();
export default webhookDeliveryServiceInstance;
