const axios = require('axios');

class SlackService {
    constructor() {
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    }

    async sendNewFeedbackAlert(feedback) {
        if (!this.webhookUrl) {
            console.log('[SlackService] Disabled - Missing SLACK_WEBHOOK_URL');
            return;
        }

        try {
            const isBug = feedback.type === 'BUG';
            const emoji = isBug ? ':bug:' : ':bulb:';
            // Note: Block Kit handles coloring mainly through attachments or specific elements, 
            // but standard blocks are clean. We'll stick to a clean block structure.

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
                        type: "divider"
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
