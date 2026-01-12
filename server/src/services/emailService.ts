/**
 * Email Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/emailService.js (ES Modules) to TypeScript (ES Modules)
 * Handles sending system notifications and alerts.
 * Currently configured for console output, ready for SMTP integration.
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';

// ==========================================
// TYPES
// ==========================================

interface SendEmailOptions {
    to: string;
    subject: string;
    html?: string;
    template?: string;
    data?: Record<string, unknown>;
    attachments?: Array<{
        filename: string;
        path?: string;
        content?: string;
        contentType?: string;
    }>;
}

interface SMTPConfig {
    host?: string;
    port?: number;
    secure: boolean;
    auth?: {
        user?: string;
        pass?: string;
    };
    from: string;
}

interface SettingRow {
    key: string;
    value: string;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let nodemailer: any;
let config: any;

/**
 * Initialize dependencies lazily
 */
async function initDeps(): Promise<void> {
    if (db && nodemailer) return;

    const [dbModule, nodemailerModule, configModule] = await Promise.all([
        import('../../src/database/index.js'),
        import('nodemailer'),
        import('../../config.js'),
    ]);

    db = dbModule.default || dbModule;
    nodemailer = nodemailerModule.default || nodemailerModule;
    config = configModule.default || configModule;
}

/**
 * Set dependencies for testing
 */
export function setDependencies(newDeps: { db?: IDatabase; nodemailer?: any; config?: any } = {}): void {
    if (newDeps.db) {
        db = newDeps.db;
    }
    if (newDeps.nodemailer) {
        nodemailer = newDeps.nodemailer;
    }
    if (newDeps.config) {
        config = newDeps.config;
    }
}

/**
 * Send an email
 */
export async function send(options: SendEmailOptions): Promise<boolean> {
    await initDeps();

    const { to, subject, html, template, data, attachments = [] } = options;

    // 1. Fetch SMTP Settings from DB
    const settingsRows = await DbPromise.all<SettingRow>(
        db,
        "SELECT key, value FROM settings WHERE key LIKE 'smtp_%'",
        [],
    );

    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
        settings[r.key] = r.value;
    });

    const portValue = settings['smtp_port'] || process.env.SMTP_PORT || '587';
    const portNumber = typeof portValue === 'string' ? parseInt(portValue, 10) : portValue;
    
    const smtpConfig: SMTPConfig = {
        host: settings['smtp_host'] || process.env.SMTP_HOST,
        port: Number(portNumber),
        secure: false, // true for 465, false for other ports
        auth: {
            user: settings['smtp_user'] || process.env.SMTP_USER,
            pass: settings['smtp_pass'] || process.env.SMTP_PASS,
        },
        from: settings['smtp_from'] || process.env.SMTP_FROM || '"Consultify System" <system@consultify.com>',
    };

    // For logging and debugging
    const displayHtml = html || `Template: ${template}`;
    console.log(`\n--- [EMAIL SERVICE] Sending to ${to} ---`);
    console.log(`Using Host: ${smtpConfig.host || 'Mock (Console)'}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${displayHtml.substring(0, 100)}...`);
    console.log('------------------------------------------\n');

    // IF REAL CONFIG EXISTS, TRY SENDING
    if (smtpConfig.host && smtpConfig.auth?.user) {
        try {
            const transporter = nodemailer.createTransport(smtpConfig);
            await transporter.sendMail({
                from: smtpConfig.from,
                to,
                subject,
                html:
                    html ||
                    `<h1>${subject}</h1><p>Template: ${template}</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
                attachments,
            });
            console.log('[EMAIL SERVICE] Sent successfully via SMTP');
        } catch (e: unknown) {
            const error = e as Error;
            console.error('[EMAIL SERVICE] SMTP Failed:', error.message);
        }
    }

    return true;
}

/**
 * Legacy method name
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    return send({ to, subject, html });
}

// Default export for backward compatibility
const EmailService = {
    setDependencies,
    send,
    sendEmail,
};

export default EmailService;
