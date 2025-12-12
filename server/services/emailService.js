/**
 * Email Service
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */

const config = require('../config');

const db = require('../database');
// const nodemailer = require('nodemailer'); // Uncomment when credentials available

const EmailService = {
    /**
     * Send an email
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} html - HTML content
     */
    sendEmail: async (to, subject, html) => {
        // 1. Fetch SMTP Settings from DB
        const settings = await new Promise((resolve) => {
            db.all("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'", [], (err, rows) => {
                if (err || !rows) return resolve({});
                const s = {};
                rows.forEach(r => s[r.key] = r.value);
                resolve(s);
            });
        });

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

        console.log(`\n--- [EMAIL SERVICE] Sending to ${to} ---`);
        console.log(`Using Host: ${smtpConfig.host || 'Mock (Console)'}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${html.substring(0, 100)}...`);
        console.log('------------------------------------------\n');

        // IF REAL CONFIG EXISTS, TRY SENDING
        /*
        if (smtpConfig.host && smtpConfig.auth.user) {
            try {
                const transporter = nodemailer.createTransport(smtpConfig);
                await transporter.sendMail({
                    from: smtpConfig.from,
                    to,
                    subject,
                    html
                });
                console.log('[EMAIL SERVICE] Sent successfully via SMTP');
            } catch (e) {
                console.error('[EMAIL SERVICE] SMTP Failed:', e.message);
            }
        }
        */

        return true;
    }
};

module.exports = EmailService;
