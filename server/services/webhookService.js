const fetch = require('node-fetch');
const crypto = require('crypto');

/**
 * Webhook Service - Trigger webhooks for various events
 */
class WebhookService {
    constructor(db) {
        this.db = db;
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

        const response = await fetch(webhook.url, {
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
            const response = await fetch(webhookUrl, {
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

module.exports = WebhookService;
