import twilio from 'twilio';

export interface FeedbackData {
    type: 'BUG' | 'FEATURE' | 'OTHER';
    userEmail?: string;
    message: string;
}

export interface WhatsappServiceInterface {
    sendNewFeedbackAlert: (feedback: FeedbackData) => Promise<void>;
}

class WhatsappService implements WhatsappServiceInterface {
    private client: twilio.Twilio | null;
    private fromNumber: string | undefined;
    private toNumber: string | undefined;
    private isEnabled: boolean;

    constructor() {
        this.client = null;
        this.fromNumber = process.env.WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
        this.toNumber = process.env.WHATSAPP_TO; // e.g. 'whatsapp:+1234567890'
        this.isEnabled = false;

        const sid = process.env.WHATSAPP_SID;
        const token = process.env.WHATSAPP_TOKEN;

        if (sid && token && this.fromNumber && this.toNumber) {
            try {
                this.client = twilio(sid, token);
                this.isEnabled = true;
                console.log('[WhatsappService] Initialized successfully');
            } catch (error) {
                console.error('[WhatsappService] Initialization failed:', (error as Error).message);
            }
        } else {
            console.log('[WhatsappService] Disabled - Missing credentials in .env');
        }
    }

    async sendNewFeedbackAlert(feedback: FeedbackData): Promise<void> {
        if (!this.isEnabled) {
            console.log('[WhatsappService] Skipping alert (disabled)');
            return;
        }

        try {
            const emoji = feedback.type === 'BUG' ? '🐛' : '💡';
            const message =
                `*New ${feedback.type} Report* ${emoji}\n\n` +
                `*User:* ${feedback.userEmail || 'Anonymous'}\n` +
                `*Message:* ${feedback.message}\n` +
                `*Time:* ${new Date().toLocaleString('pl-PL')}`;

            await this.client.messages.create({
                from: this.fromNumber,
                to: this.toNumber,
                body: message,
            });
            console.log('[WhatsappService] Feedback alert sent');
        } catch (error) {
            console.error('[WhatsappService] Failed to send alert:', error.message);
        }
    }
}

export default new WhatsappService();
