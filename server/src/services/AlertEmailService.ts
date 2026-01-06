/**
 * Alert Email Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Sends email notifications for critical alerts
 * Integrates with emailService.ts for actual email delivery
 */

import logger from '../utils/Logger.js';
import { send as sendEmail } from './emailService.js';

// ==========================================
// TYPES
// ==========================================

interface AlertEmailData {
    alertType: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
    environment?: string;
}

interface EmailTemplate {
    subject: string;
    html: string;
}

// ==========================================
// CONFIGURATION
// ==========================================

// Rate limiting: max 1 email per 5 minutes for the same alert type
const emailRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

// Alert recipients (can be configured via environment variables)
const getAlertRecipients = (): string[] => {
    const recipients = process.env.ALERT_EMAIL_RECIPIENTS;
    if (recipients) {
        return recipients.split(',').map((email) => email.trim());
    }
    // Default: admin email from config or empty array
    const adminEmail = process.env.ADMIN_EMAIL;
    return adminEmail ? [adminEmail] : [];
};

// ==========================================
// EMAIL TEMPLATES
// ==========================================

/**
 * Generate email template for alert
 */
function generateEmailTemplate(alert: AlertEmailData): EmailTemplate {
    const severityColors = {
        info: '#2196F3',
        warning: '#FF9800',
        error: '#F44336',
        critical: '#D32F2F',
    };

    const severityIcons = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '❌',
        critical: '🚨',
    };

    const color = severityColors[alert.severity] || severityColors.info;
    const icon = severityIcons[alert.severity] || severityIcons.info;

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
        .alert-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${color}; }
        .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .data-table th, .data-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        .data-table th { background-color: #f5f5f5; font-weight: bold; }
        .timestamp { color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>${icon} ${alert.title}</h2>
        </div>
        <div class="content">
            <div class="alert-box">
                <p><strong>Alert Type:</strong> ${alert.alertType}</p>
                <p><strong>Severity:</strong> <span style="color: ${color}; font-weight: bold;">${alert.severity.toUpperCase()}</span></p>
                <p><strong>Message:</strong></p>
                <p>${alert.message.replace(/\n/g, '<br>')}</p>
                <p class="timestamp">Time: ${new Date(alert.timestamp).toLocaleString()}</p>
                ${alert.environment ? `<p class="timestamp">Environment: ${alert.environment}</p>` : ''}
            </div>
            
            ${
                alert.data && Object.keys(alert.data).length > 0
                    ? `
            <h3>Additional Details:</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(alert.data)
                        .map(([key, value]) => `<tr><td>${key}</td><td>${String(value)}</td></tr>`)
                        .join('')}
                </tbody>
            </table>
            `
                    : ''
            }
        </div>
        <div class="footer">
            <p>This is an automated alert from Consultify Enterprise SaaS Platform</p>
            <p>Please do not reply to this email</p>
        </div>
    </div>
</body>
</html>
    `;

    return { subject, html };
}

// ==========================================
// ALERT EMAIL SERVICE
// ==========================================

class AlertEmailService {
    private enabled: boolean;
    private recipients: string[];

    constructor() {
        this.enabled = process.env.ALERT_EMAIL_ENABLED !== 'false';
        this.recipients = getAlertRecipients();
    }

    /**
     * Send alert email
     */
    async sendAlert(alert: AlertEmailData): Promise<boolean> {
        if (!this.enabled) {
            logger.debug('[AlertEmail] Email alerts disabled, skipping');
            return false;
        }

        if (this.recipients.length === 0) {
            logger.warn('[AlertEmail] No alert recipients configured, skipping email');
            return false;
        }

        // Rate limiting check
        const rateLimitKey = `${alert.alertType}:${alert.severity}`;
        const lastSent = emailRateLimit.get(rateLimitKey);
        const now = Date.now();

        if (lastSent && now - lastSent < RATE_LIMIT_MS) {
            logger.debug(
                `[AlertEmail] Rate limited: ${alert.alertType} (last sent ${Math.round((now - lastSent) / 1000)}s ago)`,
            );
            return false;
        }

        // Generate email template
        const template = generateEmailTemplate(alert);

        // Send to all recipients
        const sendPromises = this.recipients.map((recipient) =>
            sendEmail({
                to: recipient,
                subject: template.subject,
                html: template.html,
            }).catch((error: unknown) => {
                const err = error instanceof Error ? error : new Error(String(error));
                logger.error(`[AlertEmail] Failed to send email to ${recipient}:`, err.message);
                return false;
            }),
        );

        const results = await Promise.allSettled(sendPromises);
        const successCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;

        if (successCount > 0) {
            // Update rate limit
            emailRateLimit.set(rateLimitKey, now);
            logger.info(`[AlertEmail] Alert email sent to ${successCount}/${this.recipients.length} recipients`);
            return true;
        }

        return false;
    }

    /**
     * Send critical alert (bypasses rate limiting)
     */
    async sendCriticalAlert(alert: AlertEmailData): Promise<boolean> {
        // For critical alerts, we still respect rate limiting but with shorter window
        const originalRateLimit = RATE_LIMIT_MS;
        const criticalRateLimit = 1 * 60 * 1000; // 1 minute for critical

        const rateLimitKey = `${alert.alertType}:${alert.severity}`;
        const lastSent = emailRateLimit.get(rateLimitKey);
        const now = Date.now();

        if (lastSent && now - lastSent < criticalRateLimit) {
            logger.debug(
                `[AlertEmail] Critical alert rate limited (last sent ${Math.round((now - lastSent) / 1000)}s ago)`,
            );
            return false;
        }

        return this.sendAlert(alert);
    }

    /**
     * Update recipients list
     */
    updateRecipients(recipients: string[]): void {
        this.recipients = recipients;
        logger.info(`[AlertEmail] Updated recipients: ${recipients.join(', ')}`);
    }

    /**
     * Enable/disable email alerts
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        logger.info(`[AlertEmail] Email alerts ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: AlertEmailService | null = null;

export function getAlertEmailService(): AlertEmailService {
    if (!instance) {
        instance = new AlertEmailService();
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default AlertEmailService;
export type { AlertEmailData };


