/**
 * MIGRATION DRAFT (auto-generated)
 * Source: server/services/ai/alerting.js
 * Target: server/src/services/ai/alerting.ts
 * Status: wrapper
 *
 * TODO:
 * - Convert require/imports to ES module imports.
 * - Replace db callbacks with DbPromise/getDatabase().
 * - Add types and runtime validation where needed.
 */

/**
 * AI Alerting Service
 * Sends notifications for critical AI system events
 *
 * Channels:
 * - Slack webhook
 * - Discord webhook
 * - Generic webhook (for PagerDuty, Opsgenie, etc.)
 * - Email (via configured SMTP)
 * - Console (fallback)
 */

const https = require('https');
const http = require('http');
const { aiLogger } = require('./logger');

// Alert severity levels
const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
};

// Alert types
const ALERT_TYPE = {
    CIRCUIT_OPEN: 'circuit_open',
    CIRCUIT_CLOSED: 'circuit_closed',
    BUDGET_WARNING: 'budget_warning',
    BUDGET_EXCEEDED: 'budget_exceeded',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    PROVIDER_DOWN: 'provider_down',
    PROVIDER_RECOVERED: 'provider_recovered',
    HIGH_LATENCY: 'high_latency',
    ERROR_SPIKE: 'error_spike',
};

// Throttling to prevent alert storms
const alertThrottle = new Map();
const THROTTLE_DURATION = 5 * 60 * 1000; // 5 minutes

class AlertingService {
    constructor() {
        // Support both naming conventions for Slack webhook
        this.slackWebhook = process.env.SLACK_WEBHOOK_URL || process.env.AI_SLACK_WEBHOOK_URL;
        this.discordWebhook = process.env.DISCORD_WEBHOOK_URL || process.env.AI_DISCORD_WEBHOOK_URL;
        this.genericWebhook = process.env.AI_ALERT_WEBHOOK_URL;
        this.enabled = process.env.AI_ALERTING_ENABLED !== 'false';
    }

    /**
     * Send an alert through all configured channels
     */
    async send(alertType, data = {}) {
        if (!this.enabled) {
            aiLogger.debug('Alerting', 'Alerting disabled, skipping', { alertType });
            return;
        }

        // Check throttle
        const throttleKey = `${alertType}:${data.providerId || 'global'}`;
        const lastAlert = alertThrottle.get(throttleKey);
        if (lastAlert && Date.now() - lastAlert < THROTTLE_DURATION) {
            aiLogger.debug('Alerting', 'Alert throttled', { alertType, throttleKey });
            return;
        }
        alertThrottle.set(throttleKey, Date.now());

        const alert = this.formatAlert(alertType, data);
        const promises = [];

        // Always log to console
        this.logToConsole(alert);

        // Send to configured channels
        if (this.slackWebhook) {
            promises.push(this.sendToSlack(alert));
        }
        if (this.discordWebhook) {
            promises.push(this.sendToDiscord(alert));
        }
        if (this.genericWebhook) {
            promises.push(this.sendToWebhook(alert));
        }

        await Promise.allSettled(promises);
    }

    /**
     * Format alert based on type
     */
    formatAlert(alertType, data) {
        const timestamp = new Date().toISOString();
        let severity = SEVERITY.WARNING;
        let title = '';
        let message = '';
        let emoji = '⚠️';

        switch (alertType) {
            case ALERT_TYPE.CIRCUIT_OPEN:
                severity = SEVERITY.CRITICAL;
                emoji = '🔴';
                title = `Circuit Breaker OPEN: ${data.providerId}`;
                message = `Provider ${data.providerId} has been blocked after ${data.failures || 5} consecutive failures. Auto-recovery in ${data.cooldown || 60}s.`;
                break;

            case ALERT_TYPE.CIRCUIT_CLOSED:
                severity = SEVERITY.INFO;
                emoji = '🟢';
                title = `Circuit Breaker CLOSED: ${data.providerId}`;
                message = `Provider ${data.providerId} has recovered and is accepting requests again.`;
                break;

            case ALERT_TYPE.BUDGET_WARNING:
                severity = SEVERITY.WARNING;
                emoji = '💰';
                title = `Budget Warning: ${data.organizationId}`;
                message = `Organization has used ${data.percentUsed}% of monthly AI budget. Premium features may be limited.`;
                break;

            case ALERT_TYPE.BUDGET_EXCEEDED:
                severity = SEVERITY.ERROR;
                emoji = '🚫';
                title = `Budget Exceeded: ${data.organizationId}`;
                message = `Organization has exceeded ${data.percentUsed}% of AI budget. AI services blocked.`;
                break;

            case ALERT_TYPE.RATE_LIMIT_EXCEEDED:
                severity = SEVERITY.WARNING;
                emoji = '⏱️';
                title = `Rate Limit Exceeded`;
                message = `User ${data.userId} in org ${data.organizationId} exceeded rate limit for ${data.capability}.`;
                break;

            case ALERT_TYPE.PROVIDER_DOWN:
                severity = SEVERITY.CRITICAL;
                emoji = '💀';
                title = `Provider DOWN: ${data.providerId}`;
                message = `LLM provider ${data.providerId} is not responding. Error: ${data.error}`;
                break;

            case ALERT_TYPE.PROVIDER_RECOVERED:
                severity = SEVERITY.INFO;
                emoji = '✅';
                title = `Provider Recovered: ${data.providerId}`;
                message = `LLM provider ${data.providerId} is back online.`;
                break;

            case ALERT_TYPE.HIGH_LATENCY:
                severity = SEVERITY.WARNING;
                emoji = '🐢';
                title = `High Latency Detected`;
                message = `Average latency for ${data.providerId || 'AI requests'} is ${data.latencyMs}ms (threshold: ${data.threshold || 5000}ms).`;
                break;

            case ALERT_TYPE.ERROR_SPIKE:
                severity = SEVERITY.ERROR;
                emoji = '📈';
                title = `Error Rate Spike`;
                message = `Error rate increased to ${data.errorRate}% (${data.errorCount} errors in last ${data.windowMinutes || 5} minutes).`;
                break;

            default:
                title = alertType;
                message = JSON.stringify(data);
        }

        return {
            type: alertType,
            severity,
            emoji,
            title,
            message,
            timestamp,
            data,
            environment: process.env.NODE_ENV || 'development',
        };
    }

    /**
     * Log alert to console
     */
    logToConsole(alert) {
        const logMethod =
            alert.severity === SEVERITY.CRITICAL || alert.severity === SEVERITY.ERROR
                ? 'error'
                : alert.severity === SEVERITY.WARNING
                  ? 'warn'
                  : 'info';

        aiLogger[logMethod]('Alert', `${alert.emoji} ${alert.title}`, {
            message: alert.message,
            data: alert.data,
        });
    }

    /**
     * Send alert to Slack
     */
    async sendToSlack(alert) {
        const color = this.getSeverityColor(alert.severity);

        const payload = {
            attachments: [
                {
                    color,
                    blocks: [
                        {
                            type: 'header',
                            text: {
                                type: 'plain_text',
                                text: `${alert.emoji} ${alert.title}`,
                                emoji: true,
                            },
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: alert.message,
                            },
                        },
                        {
                            type: 'context',
                            elements: [
                                {
                                    type: 'mrkdwn',
                                    text: `*Environment:* ${alert.environment} | *Time:* ${alert.timestamp}`,
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        return this.postWebhook(this.slackWebhook, payload);
    }

    /**
     * Send alert to Discord
     */
    async sendToDiscord(alert) {
        const color = this.getSeverityColorHex(alert.severity);

        const payload = {
            embeds: [
                {
                    title: `${alert.emoji} ${alert.title}`,
                    description: alert.message,
                    color,
                    timestamp: alert.timestamp,
                    footer: {
                        text: `Consultify AI | ${alert.environment}`,
                    },
                },
            ],
        };

        return this.postWebhook(this.discordWebhook, payload);
    }

    /**
     * Send alert to generic webhook (PagerDuty, Opsgenie, etc.)
     */
    async sendToWebhook(alert) {
        const payload = {
            event_type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            timestamp: alert.timestamp,
            environment: alert.environment,
            data: alert.data,
        };

        return this.postWebhook(this.genericWebhook, payload);
    }

    /**
     * Post to a webhook URL
     */
    async postWebhook(url, payload) {
        return new Promise((resolve, reject) => {
            try {
                const urlObj = new URL(url);
                const protocol = urlObj.protocol === 'https:' ? https : http;
                const data = JSON.stringify(payload);

                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data),
                    },
                    timeout: 10000,
                };

                const req = protocol.request(options, (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => (responseData += chunk));
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({ success: true });
                        } else {
                            reject(new Error(`Webhook returned ${res.statusCode}`));
                        }
                    });
                });

                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Webhook timeout'));
                });

                req.write(data);
                req.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get Slack color for severity
     */
    getSeverityColor(severity) {
        switch (severity) {
            case SEVERITY.CRITICAL:
                return '#dc3545'; // Red
            case SEVERITY.ERROR:
                return '#fd7e14'; // Orange
            case SEVERITY.WARNING:
                return '#ffc107'; // Yellow
            case SEVERITY.INFO:
                return '#17a2b8'; // Blue
            default:
                return '#6c757d'; // Gray
        }
    }

    /**
     * Get Discord color (integer) for severity
     */
    getSeverityColorHex(severity) {
        switch (severity) {
            case SEVERITY.CRITICAL:
                return 0xdc3545;
            case SEVERITY.ERROR:
                return 0xfd7e14;
            case SEVERITY.WARNING:
                return 0xffc107;
            case SEVERITY.INFO:
                return 0x17a2b8;
            default:
                return 0x6c757d;
        }
    }

    /**
     * Clear throttle cache (for testing)
     */
    clearThrottle() {
        alertThrottle.clear();
    }

    /**
     * Get alerting status
     */
    getStatus() {
        return {
            enabled: this.enabled,
            channels: {
                slack: !!this.slackWebhook,
                discord: !!this.discordWebhook,
                webhook: !!this.genericWebhook,
            },
            throttledAlerts: alertThrottle.size,
        };
    }
}

// Singleton
const alertingService = new AlertingService();

// Convenience methods for common alerts
const alerts = {
    circuitOpen: (providerId, failures, cooldown) =>
        alertingService.send(ALERT_TYPE.CIRCUIT_OPEN, { providerId, failures, cooldown }),

    circuitClosed: (providerId) => alertingService.send(ALERT_TYPE.CIRCUIT_CLOSED, { providerId }),

    budgetWarning: (organizationId, percentUsed) =>
        alertingService.send(ALERT_TYPE.BUDGET_WARNING, { organizationId, percentUsed }),

    budgetExceeded: (organizationId, percentUsed) =>
        alertingService.send(ALERT_TYPE.BUDGET_EXCEEDED, { organizationId, percentUsed }),

    rateLimitExceeded: (userId, organizationId, capability) =>
        alertingService.send(ALERT_TYPE.RATE_LIMIT_EXCEEDED, { userId, organizationId, capability }),

    providerDown: (providerId, error) => alertingService.send(ALERT_TYPE.PROVIDER_DOWN, { providerId, error }),

    providerRecovered: (providerId) => alertingService.send(ALERT_TYPE.PROVIDER_RECOVERED, { providerId }),

    highLatency: (providerId, latencyMs, threshold) =>
        alertingService.send(ALERT_TYPE.HIGH_LATENCY, { providerId, latencyMs, threshold }),

    errorSpike: (errorCount, errorRate, windowMinutes) =>
        alertingService.send(ALERT_TYPE.ERROR_SPIKE, { errorCount, errorRate, windowMinutes }),
};

module.exports = {
    AlertingService,
    alertingService,
    alerts,
    SEVERITY,
    ALERT_TYPE,
};
