import BaseService from './BaseService.js';
import nodemailer from 'nodemailer';
import config from '../config.js';

/**
 * Email Service
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */
class EmailService extends BaseService {
    constructor() {
        super();
        this._nodemailer = nodemailer;
    }

    /**
     * Initialize dependencies
     */
    async init() {
        await super.init();
        return this;
    }

    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps) {
        super.setDependencies(newDeps);
        if (newDeps.nodemailer) this._nodemailer = newDeps.nodemailer;
    }

    /**
     * Send an email
     * @param {Object} options - Email options (to, subject, html, template, data, attachments)
     * @returns {Promise<boolean>}
     */
    async send(options) {
        await this.init();

        const { to, subject, html, template, data, attachments = [] } = options;

        // 1. Fetch SMTP Settings from DB
        const rows = await this.queryAll("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'", []);
        const settings = {};
        if (rows) {
            rows.forEach(r => settings[r.key] = r.value);
        }

        const smtpConfig = {
            host: settings['smtp_host'] || process.env.SMTP_HOST,
            port: settings['smtp_port'] || process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: settings['smtp_user'] || process.env.SMTP_USER,
                pass: settings['smtp_pass'] || process.env.SMTP_PASS
            },
            from: settings['smtp_from'] || process.env.SMTP_FROM || '"Consultify System" <system@consultify.com>'
        };

        // For logging and debugging
        const displayHtml = html || `Template: ${template}`;
        console.log(`\n--- [EMAIL SERVICE] Sending to ${to} ---`);
        console.log(`Using Host: ${smtpConfig.host || 'Mock (Console)'}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${displayHtml.substring(0, 100)}...`);
        console.log('------------------------------------------\n');

        // IF REAL CONFIG EXISTS, TRY SENDING
        if (smtpConfig.host && smtpConfig.auth.user) {
            try {
                const transporter = this._nodemailer.createTransport(smtpConfig);
                await transporter.sendMail({
                    from: smtpConfig.from,
                    to,
                    subject,
                    html: html || `<h1>${subject}</h1><p>Template: ${template}</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
                    attachments
                });
                console.log('[EMAIL SERVICE] Sent successfully via SMTP');
            } catch (e) {
                console.error('[EMAIL SERVICE] SMTP Failed:', e.message);
            }
        }

        return true;
    }

    /**
     * Legacy method name
     */
    async sendEmail(to, subject, html) {
        return this.send({ to, subject, html });
    }
}

const service = new EmailService();
export default service;


