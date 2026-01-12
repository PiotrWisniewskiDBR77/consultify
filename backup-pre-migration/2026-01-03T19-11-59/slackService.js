import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const axios = require('axios');

class SlackService {
    constructor() {
        // Use provided webhook or fallback to env
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    }

    async sendSystemAlert(title, message, severity) {
        if (!this.webhookUrl) return;

        try {
            const emoji = severity === 'CRITICAL' ? ':rotating_light:' : ':warning:';
            const color = severity === 'CRITICAL' ? '#ff0000' : '#ffcc00';

            const payload = {
                attachments: [
                    {
                        color: color,
                        blocks: [
                            {
                                type: "header",
                                text: {
                                    type: "plain_text",
                                    text: `${emoji} SYSTEM ALERT: ${title}`,
                                    emoji: true
                                }
                            },
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `*Severity:* ${severity}\n*Message:* ${message}`
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: `Time: ${new Date().toLocaleString('pl-PL')}`
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            await axios.post(this.webhookUrl, payload);
            console.log('[SlackService] System alert sent');
        } catch (error) {
            console.error('[SlackService] Failed to send system alert:', error.message);
        }
    }

    async sendClientTicket(title, message, clientName) {
        if (!this.webhookUrl) return;

        try {
            const payload = {
                blocks: [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: `:telephone_receiver: New Client Request`,
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        fields: [
                            {
                                type: "mrkdwn",
                                text: `*Client:*\n${clientName || 'Unknown'}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Subject:*\n${title}`
                            }
                        ]
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Details:*\n${message}`
                        }
                    },
                    {
                        type: "divider"
                    }
                ]
            };

            await axios.post(this.webhookUrl, payload);
            console.log('[SlackService] Client ticket alert sent');
        } catch (error) {
            console.error('[SlackService] Failed to send client ticket:', error.message);
        }
    }

    async sendNewFeedbackAlert(feedback) {
        if (!this.webhookUrl) return;

        try {
            const isBug = feedback.type === 'BUG';
            const emoji = isBug ? ':bug:' : ':bulb:';

            const payload = {
                blocks: [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: `${emoji} New ${feedback.type} Report`,
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        fields: [
                            {
                                type: "mrkdwn",
                                text: `*User:*\n${feedback.userEmail || 'Anonymous'}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Type:*\n${feedback.type}`
                            }
                        ]
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Message:*\n${feedback.message}`
                        }
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: `Submitted at: ${new Date().toLocaleString('pl-PL')}`
                            }
                        ]
                    }
                ]
            };

            await axios.post(this.webhookUrl, payload);
            console.log('[SlackService] Feedback alert sent');
        } catch (error) {
            console.error('[SlackService] Failed to send alert:', error.message);
        }
    }

    /**
     * Send AI Health Alert to Slack
     * @param {Object} alertData - Alert data containing title, message, severity, failedTests, color
     */
    async sendAIHealthAlert(alertData) {
        if (!this.webhookUrl) {
            console.log('[SlackService] No webhook URL configured for AI Health Alert');
            return { sent: false, reason: 'No webhook configured' };
        }

        try {
            const { title, message, severity, failedTests = [], color } = alertData;

            // Build failed tests section
            const failedTestsText = failedTests.length > 0
                ? failedTests.map(t => `• *${t.capability}*: ${t.error || 'Failed'}`).join('\n')
                : 'No details available';

            const payload = {
                attachments: [
                    {
                        color: color || '#ff0000',
                        blocks: [
                            {
                                type: "header",
                                text: {
                                    type: "plain_text",
                                    text: title,
                                    emoji: true
                                }
                            },
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `*Severity:* ${severity}\n*Environment:* ${process.env.NODE_ENV || 'development'}`
                                }
                            },
                            {
                                type: "divider"
                            },
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `*Failed Tests:*\n${failedTestsText}`
                                }
                            },
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: message
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: `🕐 ${new Date().toLocaleString('pl-PL')} | 🔗 <${process.env.APP_URL || 'http://localhost:5173'}/superadmin/ai-platform|View Dashboard>`
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };

            await axios.post(this.webhookUrl, payload);
            console.log('[SlackService] AI Health Alert sent successfully');
            return { sent: true, severity };
        } catch (error) {
            console.error('[SlackService] Failed to send AI Health Alert:', error.message);
            throw error;
        }
    }
}

const slackServiceInstance = new SlackService();
export default slackServiceInstance;
