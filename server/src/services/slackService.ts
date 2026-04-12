/**
 * Slack Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Slack integration for system alerts and notifications.
 * Fully migrated from server/services/slackService.js
 *
 * Features:
 * - System alerts (CRITICAL/WARNING)
 * - Client ticket notifications
 * - Feedback alerts
 * - AI Health alerts
 */

import axios, { type AxiosInstance } from 'axios';

import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

interface FeedbackData {
  type: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'IDEA';
  userEmail?: string;
  userName?: string;
  message: string;
  severity?: string;
  priority?: string;
  routePath?: string;
  deviceType?: string;
  screenSize?: string;
  uiLanguage?: string;
  uiTheme?: string;
  organizationId?: string;
  feedbackId?: string;
  taskId?: string;
  appEnv?: string; // production|staging|development
}

interface FailedTest {
  capability: string;
  error?: string;
}

interface AIHealthAlertData {
  title: string;
  message: string;
  severity: Severity;
  failedTests?: FailedTest[];
  color?: string;
}

interface SlackServiceDependencies {
  webhookUrl?: string;
  axiosInstance?: AxiosInstance;
}

// ==========================================
// SLACK SERVICE CLASS
// ==========================================

class SlackServiceClass {
  private webhookUrl: string | undefined;
  private axiosInstance: AxiosInstance;

  constructor(deps?: SlackServiceDependencies) {
    this.webhookUrl = deps?.webhookUrl || this.resolveWebhookUrl();
    this.axiosInstance = deps?.axiosInstance || axios;
  }

  private resolveWebhookUrl(): string | undefined {
    const envName = String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_');
    return process.env[`SLACK_WEBHOOK_URL_${envName}`] || process.env.SLACK_WEBHOOK_URL;
  }

  /**
   * Send system alert to Slack
   */
  async sendSystemAlert(title: string, message: string, severity: Severity): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug('[SlackService] No webhook URL configured, skipping system alert');
      return;
    }

    try {
      const emoji = severity === 'CRITICAL' ? ':rotating_light:' : ':warning:';
      const color = severity === 'CRITICAL' ? '#ff0000' : '#ffcc00';

      const payload = {
        attachments: [
          {
            color: color,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `${emoji} SYSTEM ALERT: ${title}`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Severity:* ${severity}\n*Message:* ${message}`,
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Time: ${new Date().toLocaleString('pl-PL')}`,
                  },
                ],
              },
            ],
          },
        ],
      };

      await this.axiosInstance.post(this.webhookUrl, payload);
      logger.info('[SlackService] System alert sent', { title, severity });
    } catch (error: unknown) {
      logger.error(
        '[SlackService] Failed to send system alert:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Send client ticket notification to Slack
   */
  async sendClientTicket(title: string, message: string, clientName?: string): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug('[SlackService] No webhook URL configured, skipping client ticket');
      return;
    }

    try {
      const payload = {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `:telephone_receiver: New Client Request`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Client:*\n${clientName || 'Unknown'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Subject:*\n${title}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Details:*\n${message}`,
            },
          },
          {
            type: 'divider',
          },
        ],
      };

      await this.axiosInstance.post(this.webhookUrl, payload);
      logger.info('[SlackService] Client ticket alert sent', { title, clientName });
    } catch (error: unknown) {
      logger.error(
        '[SlackService] Failed to send client ticket:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Send feedback alert to Slack with full context
   */
  async sendNewFeedbackAlert(feedback: FeedbackData): Promise<void> {
    if (!this.webhookUrl) {
      logger.debug('[SlackService] No webhook URL configured, skipping feedback alert');
      return;
    }

    try {
      const isBug = feedback.type === 'BUG';
      const emoji = isBug ? ':bug:' : feedback.type === 'IDEA' ? ':bulb:' : ':sparkles:';
      const severityEmoji =
        feedback.severity === 'CRITICAL'
          ? ':rotating_light:'
          : feedback.severity === 'HIGH'
            ? ':warning:'
            : '';
      const color = isBug
        ? feedback.severity === 'CRITICAL'
          ? '#ff0000'
          : feedback.severity === 'HIGH'
            ? '#ff6600'
            : '#ffcc00'
        : '#6366f1';

      const appUrl =
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
        'http://localhost:5173';

      const contextParts: string[] = [];
      if (feedback.routePath) contextParts.push(`*Page:* \`${feedback.routePath}\``);
      if (feedback.deviceType) contextParts.push(`*Device:* ${feedback.deviceType}`);
      if (feedback.screenSize) contextParts.push(`*Screen:* ${feedback.screenSize}`);
      if (feedback.uiLanguage) contextParts.push(`*Language:* ${feedback.uiLanguage}`);
      if (feedback.uiTheme) contextParts.push(`*Theme:* ${feedback.uiTheme}`);

      const envLabel = String(feedback.appEnv || process.env.APP_ENV || '').toLowerCase();
      const envBadge =
        envLabel === 'production'
          ? '[PROD]'
          : envLabel === 'staging'
            ? '[STAGE]'
            : envLabel
              ? `[${envLabel.toUpperCase()}]`
              : '';

      const blocks: Record<string, unknown>[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${severityEmoji} ${envBadge ? `${envBadge} ` : ''}New ${feedback.type} Report${feedback.severity ? ` [${feedback.severity}]` : ''}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*User:*\n${feedback.userName || feedback.userEmail || 'Anonymous'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Type:*\n${feedback.type}${feedback.severity ? ` • ${feedback.severity}` : ''}${feedback.priority ? ` • ${feedback.priority}` : ''}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${feedback.message.substring(0, 500)}${feedback.message.length > 500 ? '...' : ''}`,
          },
        },
      ];

      if (contextParts.length > 0) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Context (auto-captured):*\n${contextParts.join(' | ')}`,
          },
        });
      }

      blocks.push({ type: 'divider' });

      const contextElements: Record<string, unknown>[] = [
        {
          type: 'mrkdwn',
          text: `🕐 ${new Date().toLocaleString('pl-PL')}`,
        },
      ];

      if (feedback.feedbackId) {
        contextElements.push({
          type: 'mrkdwn',
          text: `🔗 <${appUrl}/superadmin?tab=feedback|View in SuperAdmin>`,
        });
      }

      if (feedback.taskId) {
        contextElements.push({
          type: 'mrkdwn',
          text: `🧩 <${appUrl}/my-work/tasks/${feedback.taskId}|Open task>`,
        });
      }

      if (feedback.organizationId && feedback.organizationId !== 'system') {
        contextElements.push({
          type: 'mrkdwn',
          text: `🏢 Org: ${feedback.organizationId}`,
        });
      }

      blocks.push({ type: 'context', elements: contextElements });

      const payload = {
        attachments: [{ color, blocks }],
      };

      await this.axiosInstance.post(this.webhookUrl, payload);
      logger.info('[SlackService] Feedback alert sent', {
        type: feedback.type,
        severity: feedback.severity,
        route: feedback.routePath,
      });
    } catch (error: unknown) {
      logger.error(
        '[SlackService] Failed to send alert:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Send AI Health Alert to Slack
   */
  async sendAIHealthAlert(
    alertData: AIHealthAlertData
  ): Promise<{ sent: boolean; reason?: string; severity?: Severity }> {
    if (!this.webhookUrl) {
      logger.debug('[SlackService] No webhook URL configured for AI Health Alert');
      return { sent: false, reason: 'No webhook configured' };
    }

    try {
      const { title, message, severity, failedTests = [], color } = alertData;

      // Build failed tests section
      const failedTestsText =
        failedTests.length > 0
          ? failedTests.map((t) => `• *${t.capability}*: ${t.error || 'Failed'}`).join('\n')
          : 'No details available';

      const payload = {
        attachments: [
          {
            color: color || '#ff0000',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: title,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Severity:* ${severity}\n*Environment:* ${process.env.NODE_ENV || 'development'}`,
                },
              },
              {
                type: 'divider',
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Failed Tests:*\n${failedTestsText}`,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: message,
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `🕐 ${new Date().toLocaleString('pl-PL')} | 🔗 <${process.env.APP_URL || 'http://localhost:5173'}/superadmin/ai-platform|View Dashboard>`,
                  },
                ],
              },
            ],
          },
        ],
      };

      await this.axiosInstance.post(this.webhookUrl, payload);
      logger.info('[SlackService] AI Health Alert sent successfully', { severity });
      return { sent: true, severity };
    } catch (error: unknown) {
      logger.error(
        '[SlackService] Failed to send AI Health Alert:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

// Export singleton instance (for backward compatibility)
const slackService = new SlackServiceClass();

// Export class for testing
export { SlackServiceClass };

// Export default instance
export default slackService;

// Export individual methods for backward compatibility
export const sendSystemAlert = (title: string, message: string, severity: Severity) =>
  slackService.sendSystemAlert(title, message, severity);
export const sendClientTicket = (title: string, message: string, clientName?: string) =>
  slackService.sendClientTicket(title, message, clientName);
export const sendNewFeedbackAlert = (feedback: FeedbackData) =>
  slackService.sendNewFeedbackAlert(feedback);
export const sendAIHealthAlert = (alertData: AIHealthAlertData) =>
  slackService.sendAIHealthAlert(alertData);
