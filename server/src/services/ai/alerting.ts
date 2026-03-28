/**
 * AI Alerting Service
 * Sends notifications for critical AI system events.
 */

import * as http from 'http';
import * as https from 'https';

import aiLogger from './logger.js';

export const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export const ALERT_TYPE = {
  CIRCUIT_OPEN: 'circuit_open',
  CIRCUIT_CLOSED: 'circuit_closed',
  BUDGET_WARNING: 'budget_warning',
  BUDGET_EXCEEDED: 'budget_exceeded',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  PROVIDER_DOWN: 'provider_down',
  PROVIDER_RECOVERED: 'provider_recovered',
  HIGH_LATENCY: 'high_latency',
  ERROR_SPIKE: 'error_spike',
  PURPOSE_COVERAGE_MISSING: 'purpose_coverage_missing',
  DELIVERY_THREATENED: 'delivery_threatened',
  DOCUMENT_PATH_DEGRADED: 'document_path_degraded',
  IMAGE_PROVIDER_UNAVAILABLE: 'image_provider_unavailable',
} as const;

type Severity = (typeof SEVERITY)[keyof typeof SEVERITY];
type AlertType = (typeof ALERT_TYPE)[keyof typeof ALERT_TYPE];

type AlertData = {
  providerId?: string;
  failures?: number;
  cooldown?: number;
  organizationId?: string;
  percentUsed?: number;
  userId?: string;
  capability?: string;
  error?: string;
  latencyMs?: number;
  threshold?: number;
  errorRate?: number;
  errorCount?: number;
  windowMinutes?: number;
  [key: string]: unknown;
};

type AlertPayload = {
  type: AlertType | string;
  severity: Severity;
  emoji: string;
  title: string;
  message: string;
  timestamp: string;
  data: AlertData;
  environment: string;
};

const alertThrottle = new Map<string, number>();
const THROTTLE_DURATION = 5 * 60 * 1000;

export class AlertingService {
  slackWebhook?: string;
  discordWebhook?: string;
  genericWebhook?: string;
  enabled: boolean;

  constructor() {
    // IMPORTANT:
    // - `SLACK_WEBHOOK_URL` is used by product feedback notifications.
    // - AI infra alerting (circuit breakers, provider outages) should NOT spam the same channel by default.
    // Use a dedicated webhook for AI alerting.
    this.slackWebhook = process.env.AI_SLACK_WEBHOOK_URL;
    this.discordWebhook = process.env.DISCORD_WEBHOOK_URL || process.env.AI_DISCORD_WEBHOOK_URL;
    this.genericWebhook = process.env.AI_ALERT_WEBHOOK_URL;

    // Railway runs both staging/prod with NODE_ENV=production (Dockerfile),
    // so we must use APP_ENV / Railway env name to decide whether to alert.
    const env = String(
      process.env.APP_ENV ||
        process.env.RAILWAY_ENVIRONMENT_NAME ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.NODE_ENV ||
        'development'
    ).toLowerCase();
    // Default: only enable AI infra alerting in production unless explicitly enabled.
    // This prevents noisy spam during local development and staging.
    if (
      String(process.env.AI_ALERTING_ENABLED || '')
        .trim()
        .toLowerCase() === 'true'
    ) {
      this.enabled = true;
    } else if (
      String(process.env.AI_ALERTING_ENABLED || '')
        .trim()
        .toLowerCase() === 'false'
    ) {
      this.enabled = false;
    } else {
      this.enabled = env === 'production';
    }
  }

  async send(alertType: AlertType, data: AlertData = {}): Promise<void> {
    if (!this.enabled) {
      aiLogger.debug('Alerting', 'Alerting disabled, skipping', { alertType });
      return;
    }

    const throttleKey = `${alertType}:${data.providerId || 'global'}`;
    const lastAlert = alertThrottle.get(throttleKey);
    if (lastAlert && Date.now() - lastAlert < THROTTLE_DURATION) {
      aiLogger.debug('Alerting', 'Alert throttled', { alertType, throttleKey });
      return;
    }
    alertThrottle.set(throttleKey, Date.now());

    const alert = this.formatAlert(alertType, data);
    const promises: Array<Promise<unknown>> = [];

    this.logToConsole(alert);

    if (this.slackWebhook) {
      promises.push(this.sendToSlack(alert));
    }
    if (this.discordWebhook) {
      promises.push(this.sendToDiscord(alert));
    }
    if (this.genericWebhook) {
      promises.push(this.sendToWebhook(alert));
    }

    // Send to Sentry for critical alerts
    if (alert.severity === SEVERITY.CRITICAL || alert.severity === SEVERITY.ERROR) {
      try {
        const Logic = await import('../../config/index.js');
        const { captureMessage, addBreadcrumb } = Logic as any;
        addBreadcrumb({
          message: alert.title,
          level: alert.severity === SEVERITY.CRITICAL ? 'critical' : 'error',
          data: alert.data,
          category: 'alert',
        });
        captureMessage(alert.message, {
          level: alert.severity === SEVERITY.CRITICAL ? 'fatal' : 'error',
          tags: {
            alertType: alert.type,
            severity: alert.severity,
            environment:
              alert.environment ||
              String(
                process.env.APP_ENV ||
                  process.env.RAILWAY_ENVIRONMENT_NAME ||
                  process.env.RAILWAY_ENVIRONMENT ||
                  process.env.NODE_ENV ||
                  'unknown'
              ).toLowerCase(),
            ...(alert.data.providerId ? { providerId: String(alert.data.providerId) } : {}),
            ...(alert.data.organizationId
              ? { organizationId: String(alert.data.organizationId) }
              : {}),
          },
          extra: alert.data,
        });
      } catch (error: unknown) {
        // Sentry not available, continue without it
        aiLogger.debug('Alerting', 'Sentry integration not available');
      }
    }

    await Promise.allSettled(promises);
  }

  formatAlert(alertType: AlertType, data: AlertData): AlertPayload {
    const timestamp = new Date().toISOString();
    let severity: Severity = SEVERITY.WARNING;
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
        title = 'Rate Limit Exceeded';
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
        title = 'High Latency Detected';
        message = `Average latency for ${data.providerId || 'AI requests'} is ${data.latencyMs}ms (threshold: ${data.threshold || 5000}ms).`;
        break;
      case ALERT_TYPE.ERROR_SPIKE:
        severity = SEVERITY.ERROR;
        emoji = '📈';
        title = 'Error Rate Spike';
        message = `Error rate increased to ${data.errorRate}% (${data.errorCount} errors in last ${data.windowMinutes || 5} minutes).`;
        break;
      case ALERT_TYPE.PURPOSE_COVERAGE_MISSING:
        severity = SEVERITY.CRITICAL;
        emoji = '🧭';
        title = `Purpose Coverage Missing: ${data.purpose || data.useCase || 'unknown'}`;
        message = `No healthy primary/fallback chain is available for ${data.purpose || data.useCase || 'this AI use case'}. User-visible delivery is at risk.`;
        break;
      case ALERT_TYPE.DELIVERY_THREATENED:
        severity = (data.severity as Severity) || SEVERITY.WARNING;
        emoji = severity === SEVERITY.CRITICAL ? '🚨' : '⚠️';
        title = `LLM Delivery Threatened: ${data.useCase || data.purpose || 'runtime'}`;
        message = String(
          data.message ||
            `Delivery risk detected for ${data.useCase || data.purpose || 'an AI runtime path'}.`
        );
        break;
      case ALERT_TYPE.DOCUMENT_PATH_DEGRADED:
        severity = SEVERITY.WARNING;
        emoji = '📄';
        title = `Document Path Degraded: ${data.purpose || 'document runtime'}`;
        message = `Document understanding path is degraded for ${data.purpose || 'document runtime'}. Fallbacks may still work, but grounded answers are at risk.`;
        break;
      case ALERT_TYPE.IMAGE_PROVIDER_UNAVAILABLE:
        severity = SEVERITY.WARNING;
        emoji = '🖼️';
        title = `Image Provider Unavailable: ${data.providerId || 'visual generation'}`;
        message = `Image generation capacity is degraded for ${data.purpose || 'presentation visuals'}. Asset generation may fall back or fail.`;
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
      environment: String(
        process.env.APP_ENV ||
          process.env.RAILWAY_ENVIRONMENT_NAME ||
          process.env.RAILWAY_ENVIRONMENT ||
          process.env.NODE_ENV ||
          'development'
      ).toLowerCase(),
    };
  }

  logToConsole(alert: AlertPayload): void {
    const payload = {
      message: alert.message,
      data: alert.data,
    };

    if (alert.severity === SEVERITY.CRITICAL || alert.severity === SEVERITY.ERROR) {
      aiLogger.error('Alert', `${alert.emoji} ${alert.title}`, payload);
      return;
    }

    if (alert.severity === SEVERITY.WARNING) {
      aiLogger.warn('Alert', `${alert.emoji} ${alert.title}`, payload);
      return;
    }

    aiLogger.info('Alert', `${alert.emoji} ${alert.title}`, payload);
  }

  async sendToSlack(alert: AlertPayload): Promise<{ success: true }> {
    if (!this.slackWebhook) {
      aiLogger.debug('Alerting', 'Slack webhook not configured, skipping');
      return { success: true };
    }

    const color = this.getSeverityColor(alert.severity);

    // Enhanced Slack payload with rich formatting
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
            // Add fields for additional data
            ...(Object.keys(alert.data).length > 0
              ? [
                  {
                    type: 'section',
                    fields: Object.entries(alert.data)
                      .slice(0, 10) // Limit to 10 fields
                      .map(([key, value]) => ({
                        type: 'mrkdwn',
                        text: `*${key}:* ${String(value)}`,
                      })),
                  },
                ]
              : []),
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Environment:* ${alert.environment} | *Time:* ${new Date(alert.timestamp).toLocaleString()} | *Severity:* ${alert.severity.toUpperCase()}`,
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      return await this.postWebhook(this.slackWebhook, payload);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      aiLogger.error('Alerting', `Failed to send Slack alert: ${err.message}`);
      throw err;
    }
  }

  async sendToDiscord(alert: AlertPayload): Promise<{ success: true }> {
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

  async sendToWebhook(alert: AlertPayload): Promise<{ success: true }> {
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

  async postWebhook(url: string | undefined, payload: unknown): Promise<{ success: true }> {
    if (!url) {
      return { success: true };
    }

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
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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
      } catch (error: unknown) {
        reject(error);
      }
    });
  }

  getSeverityColor(severity: Severity): string {
    switch (severity) {
      case SEVERITY.CRITICAL:
        return '#dc3545';
      case SEVERITY.ERROR:
        return '#fd7e14';
      case SEVERITY.WARNING:
        return '#ffc107';
      case SEVERITY.INFO:
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  }

  getSeverityColorHex(severity: Severity): number {
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

  clearThrottle(): void {
    alertThrottle.clear();
  }

  getStatus(): {
    enabled: boolean;
    channels: { slack: boolean; discord: boolean; webhook: boolean };
    throttledAlerts: number;
  } {
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

export const alertingService = new AlertingService();

export const alerts = {
  circuitOpen: (providerId: string, failures?: number, cooldown?: number) =>
    alertingService.send(ALERT_TYPE.CIRCUIT_OPEN, { providerId, failures, cooldown }),
  circuitClosed: (providerId: string) =>
    alertingService.send(ALERT_TYPE.CIRCUIT_CLOSED, { providerId }),
  budgetWarning: (organizationId: string, percentUsed: number) =>
    alertingService.send(ALERT_TYPE.BUDGET_WARNING, { organizationId, percentUsed }),
  budgetExceeded: (organizationId: string, percentUsed: number) =>
    alertingService.send(ALERT_TYPE.BUDGET_EXCEEDED, { organizationId, percentUsed }),
  rateLimitExceeded: (userId: string, organizationId: string, capability: string) =>
    alertingService.send(ALERT_TYPE.RATE_LIMIT_EXCEEDED, { userId, organizationId, capability }),
  providerDown: (providerId: string, error: string) =>
    alertingService.send(ALERT_TYPE.PROVIDER_DOWN, { providerId, error }),
  providerRecovered: (providerId: string) =>
    alertingService.send(ALERT_TYPE.PROVIDER_RECOVERED, { providerId }),
  highLatency: (providerId: string | undefined, latencyMs: number, threshold?: number) =>
    alertingService.send(ALERT_TYPE.HIGH_LATENCY, { providerId, latencyMs, threshold }),
  errorSpike: (errorCount: number, errorRate: number, windowMinutes?: number) =>
    alertingService.send(ALERT_TYPE.ERROR_SPIKE, { errorCount, errorRate, windowMinutes }),
};

export default alertingService;
