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
    type: 'BUG' | 'FEATURE' | 'IMPROVEMENT';
    userEmail?: string;
    message: string;
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
        this.webhookUrl = deps?.webhookUrl || process.env.SLACK_WEBHOOK_URL;
        this.axiosInstance = deps?.axiosInstance || axios;
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
                error instanceof Error ? error : null,
                { message: error instanceof Error ? error.message : String(error) },
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
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * Send feedback alert to Slack
     */
    async sendNewFeedbackAlert(feedback: FeedbackData): Promise<void> {
        if (!this.webhookUrl) {
            logger.debug('[SlackService] No webhook URL configured, skipping feedback alert');
            return;
        }

        try {
            const isBug = feedback.type === 'BUG';
            const emoji = isBug ? ':bug:' : ':bulb:';

            const payload = {
                blocks: [
                    {
                        type: 'header',
                        text: {
                            type: 'plain_text',
                            text: `${emoji} New ${feedback.type} Report`,
                            emoji: true,
                        },
                    },
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*User:*\n${feedback.userEmail || 'Anonymous'}`,
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Type:*\n${feedback.type}`,
                            },
                        ],
                    },
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Message:*\n${feedback.message}`,
                        },
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Submitted at: ${new Date().toLocaleString('pl-PL')}`,
                            },
                        ],
                    },
                ],
            };

            await this.axiosInstance.post(this.webhookUrl, payload);
            logger.info('[SlackService] Feedback alert sent', { type: feedback.type });
        } catch (error: unknown) {
            logger.error(
                '[SlackService] Failed to send alert:',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    /**
     * Send AI Health Alert to Slack
     */
    async sendAIHealthAlert(
        alertData: AIHealthAlertData,
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
                error instanceof Error ? error.message : String(error),
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
export const sendNewFeedbackAlert = (feedback: FeedbackData) => slackService.sendNewFeedbackAlert(feedback);
export const sendAIHealthAlert = (alertData: AIHealthAlertData) => slackService.sendAIHealthAlert(alertData);
