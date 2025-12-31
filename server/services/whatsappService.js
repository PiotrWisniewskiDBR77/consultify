const twilio = require('twilio');

class WhatsappService {
    constructor() {
        this.client = null;
        this.fromNumber = process.env.WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
        this.toNumber = process.env.WHATSAPP_TO;     // e.g. 'whatsapp:+1234567890'
        this.isEnabled = false;

        const sid = process.env.WHATSAPP_SID;
        const token = process.env.WHATSAPP_TOKEN;

        if (sid && token && this.fromNumber && this.toNumber) {
            try {
                this.client = twilio(sid, token);
                this.isEnabled = true;
                console.log('[WhatsappService] Initialized successfully');
            } catch (error) {
                console.error('[WhatsappService] Initialization failed:', error.message);
            }
        } else {
            console.log('[WhatsappService] Disabled - Missing credentials in .env');
        }
    }

    async sendNewFeedbackAlert(feedback) {
        if (!this.isEnabled) {
            console.log('[WhatsappService] Skipping alert (disabled)');
            return;
        }

        try {
            const emoji = feedback.type === 'BUG' ? '🐛' : '💡';
            const message = `*New ${feedback.type} Report* ${emoji}\n\n` +
                `*User:* ${feedback.userEmail || 'Anonymous'}\n` +
                `*Message:* ${feedback.message}\n` +
                `*Time:* ${new Date().toLocaleString('pl-PL')}`;

            await this.client.messages.create({
                from: this.fromNumber,
                to: this.toNumber,
                body: message
            });
            console.log('[WhatsappService] Feedback alert sent');
        } catch (error) {
            console.error('[WhatsappService] Failed to send alert:', error.message);
        }
    }
}

module.exports = new WhatsappService();
