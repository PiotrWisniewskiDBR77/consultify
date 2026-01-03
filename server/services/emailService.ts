/**
 * Email Service
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */

import db from '../database';
import nodemailer from 'nodemailer';
import config from '../config';

interface Database {
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}

interface SMTPSettings {
    [key: string]: string;
}

interface SMTPConfig {
    host?: string;
    port: number;
    secure: boolean;
    auth: {
        user?: string;
        pass?: string;
    };
    from: string;
}

interface EmailAttachment {
    filename?: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
}

export interface EmailOptions {
    to: string;
    subject: string;
    html?: string;
    template?: string;
    data?: unknown;
    attachments?: EmailAttachment[];
}

interface Dependencies {
    db: Database;
    nodemailer: typeof nodemailer;
    config: unknown;
}

// Dependency injection for testing
const deps: Dependencies = {
    db: db as Database,
    nodemailer,
    config
};

export interface EmailServiceInterface {
    setDependencies: (newDeps: Partial<Dependencies>) => void;
    send: (options: EmailOptions) => Promise<boolean>;
    sendEmail: (to: string, subject: string, html: string) => Promise<boolean>;
}

const EmailService: EmailServiceInterface = {
    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps: Partial<Dependencies>): void {
        Object.assign(deps, newDeps);
    },

    /**
     * Send an email
     */
    send: async (options: EmailOptions): Promise<boolean> => {
        await initDeps();

        const { to, subject, html, template, data, attachments = [] } = options;

        // 1. Fetch SMTP Settings from DB
        const settings = await new Promise((resolve) => {
            deps.db.all("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'", [], (err, rows) => {
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
                const transporter = deps.nodemailer.createTransport(smtpConfig);
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
    },

    /**
     * Legacy method name
     */
    sendEmail: async (to: string, subject: string, html: string): Promise<boolean> => {
        return EmailService.send({ to, subject, html });
    }
};

export default EmailService;

