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
}

module.exports = new SlackService();
