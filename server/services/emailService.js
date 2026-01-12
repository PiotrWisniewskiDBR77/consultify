/**
 * Email Service
 * Handles sending system notifications and alerts.
 * Includes billing-specific email methods for invoices, payments, and subscriptions.
 * Currently configured for console output, ready for SMTP integration.
 * 
 * @module services/emailService
 */
import nodemailer from 'nodemailer';
import config from '../config.js';
import db from '../database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependency injection for testing
const deps = {
    db: db,
    nodemailer,
    config,
};

// Template cache
const templateCache = new Map();

// Configuration
const EMAIL_CONFIG = {
    companyName: process.env.COMPANY_NAME || 'Consultify',
    companyEmail: process.env.COMPANY_EMAIL || 'billing@consultify.app',
    appUrl: process.env.APP_URL || 'https://app.consultify.app',
    supportUrl: process.env.SUPPORT_URL || 'https://consultify.app/support',
    billingTemplatesPath: path.join(__dirname, '../templates/emails/billing')
};

/**
 * Load and compile Handlebars template
 * @param {string} templateKey - Template key (filename without extension)
 * @returns {Function} Compiled template function
 */
function loadBillingTemplate(templateKey) {
    if (templateCache.has(templateKey)) {
        return templateCache.get(templateKey);
    }

    const templatePath = path.join(EMAIL_CONFIG.billingTemplatesPath, `${templateKey}.hbs`);
    
    if (!fs.existsSync(templatePath)) {
        console.warn(`[EmailService] Template not found: ${templatePath}`);
        return null;
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateSource);
    templateCache.set(templateKey, compiled);
    return compiled;
}

/**
 * Get default template variables
 */
function getDefaultTemplateVars() {
    return {
        companyName: EMAIL_CONFIG.companyName,
        companyAddress: process.env.COMPANY_ADDRESS || '123 Business Street, San Francisco, CA 94105',
        logoUrl: process.env.COMPANY_LOGO_URL || `${EMAIL_CONFIG.appUrl}/logo.png`,
        billingPortalUrl: `${EMAIL_CONFIG.appUrl}/settings/billing`,
        supportUrl: EMAIL_CONFIG.supportUrl,
        unsubscribeUrl: `${EMAIL_CONFIG.appUrl}/settings/notifications`,
        dashboardUrl: EMAIL_CONFIG.appUrl,
        year: new Date().getFullYear()
    };
}

const EmailService = {
    /**
     * Set dependencies for testing
     */
    setDependencies(newDeps) {
        Object.assign(deps, newDeps);
    },

    /**
     * Send an email
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email
     * @param {string} options.subject - Email subject
     * @param {string} [options.html] - HTML content
     * @param {string} [options.template] - Template name
     * @param {Object} [options.data] - Template data
     * @param {Array} [options.attachments] - Email attachments
     * @returns {Promise<boolean>}
     */
    send: async (options) => {
        const { to, subject, html, template, data, attachments = [] } = options;
        
        // 1. Fetch SMTP Settings from DB
        const settings = await new Promise((resolve) => {
            deps.db.all("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'", [], (err, rows) => {
                if (err || !rows)
                    return resolve({});
                const s = {};
                rows.forEach((r) => (s[r.key] = r.value));
                resolve(s);
            });
        });

        const smtpConfig = {
            host: settings['smtp_host'] || process.env.SMTP_HOST,
            port: settings['smtp_port'] || process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: settings['smtp_user'] || process.env.SMTP_USER,
                pass: settings['smtp_pass'] || process.env.SMTP_PASS,
            },
            from: settings['smtp_from'] || process.env.SMTP_FROM || `"${EMAIL_CONFIG.companyName}" <${EMAIL_CONFIG.companyEmail}>`,
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
                    html: html ||
                        `<h1>${subject}</h1><p>Template: ${template}</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
                    attachments,
                });
                console.log('[EMAIL SERVICE] Sent successfully via SMTP');
            }
            catch (e) {
                console.error('[EMAIL SERVICE] SMTP Failed:', e.message);
            }
        }
        return true;
    },

    /**
     * Legacy method name for backward compatibility
     */
    sendEmail: async (to, subject, html) => {
        return EmailService.send({ to, subject, html });
    },

    // ==========================================
    // BILLING-SPECIFIC EMAIL METHODS
    // ==========================================

    /**
     * Send invoice email with optional PDF attachment
     * @param {string} orgId - Organization ID
     * @param {string} invoiceId - Invoice ID
     * @param {string[]} recipientEmails - Recipient email addresses
     * @returns {Promise<boolean>}
     */
    sendInvoiceEmail: async (orgId, invoiceId, recipientEmails) => {
        try {
            // Get invoice data
            const invoice = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT i.*, o.name as organization_name
                    FROM invoices i
                    LEFT JOIN organizations o ON i.organization_id = o.id
                    WHERE i.id = ?
                `, [invoiceId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!invoice) {
                console.error('[EmailService] Invoice not found:', invoiceId);
                return false;
            }

            const template = loadBillingTemplate('invoice_created');
            if (!template) {
                console.error('[EmailService] Invoice template not found');
                return false;
            }

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: invoice.organization_name || 'Customer',
                invoiceNumber: invoice.invoice_number,
                amount: (invoice.total / 100).toFixed(2),
                currency: invoice.currency?.toUpperCase() || 'USD',
                invoiceDate: new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Upon receipt',
                billingPeriod: invoice.billing_period || 'Monthly',
                invoiceUrl: `${EMAIL_CONFIG.appUrl}/settings/billing/invoices/${invoiceId}`,
                autoPayEnabled: invoice.auto_pay
            };

            const html = template(templateData);
            const attachments = [];

            // Try to generate PDF attachment
            try {
                const invoicePdfService = await import('./invoicePdfService.js');
                const pdfBuffer = await invoicePdfService.generateInvoicePdf(invoiceId);
                attachments.push({
                    filename: `Invoice_${invoice.invoice_number}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                });
            } catch (pdfErr) {
                console.log('[EmailService] Could not generate PDF attachment:', pdfErr.message);
            }

            // Send to all recipients
            for (const email of recipientEmails) {
                await EmailService.send({
                    to: email,
                    subject: `New Invoice #${invoice.invoice_number} Available`,
                    html,
                    attachments
                });
            }

            return true;
        } catch (err) {
            console.error('[EmailService] sendInvoiceEmail error:', err);
            return false;
        }
    },

    /**
     * Send payment receipt email
     * @param {string} orgId - Organization ID
     * @param {string} paymentId - Payment/Invoice ID
     * @returns {Promise<boolean>}
     */
    sendPaymentReceipt: async (orgId, paymentId) => {
        try {
            // Get payment/invoice data
            const invoice = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT i.*, o.name as organization_name, ob.billing_email
                    FROM invoices i
                    LEFT JOIN organizations o ON i.organization_id = o.id
                    LEFT JOIN organization_billing ob ON i.organization_id = ob.organization_id
                    WHERE i.id = ? OR i.stripe_invoice_id = ?
                `, [paymentId, paymentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!invoice) return false;

            const template = loadBillingTemplate('invoice_paid');
            if (!template) return false;

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: invoice.organization_name || 'Customer',
                invoiceNumber: invoice.invoice_number,
                amount: (invoice.amount_paid / 100).toFixed(2),
                currency: invoice.currency?.toUpperCase() || 'USD',
                paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                paymentMethod: 'Card ending in ****',
                transactionId: invoice.stripe_payment_intent_id || paymentId,
                receiptUrl: `${EMAIL_CONFIG.appUrl}/settings/billing/invoices/${invoice.id}`,
            };

            const html = template(templateData);
            const recipientEmail = invoice.billing_email;

            if (recipientEmail) {
                await EmailService.send({
                    to: recipientEmail,
                    subject: `Payment Confirmation - Invoice #${invoice.invoice_number}`,
                    html
                });
            }

            return true;
        } catch (err) {
            console.error('[EmailService] sendPaymentReceipt error:', err);
            return false;
        }
    },

    /**
     * Send dunning email based on dunning step
     * @param {string} orgId - Organization ID
     * @param {number} step - Dunning step (1-4)
     * @returns {Promise<boolean>}
     */
    sendDunningEmail: async (orgId, step) => {
        try {
            // Get billing info
            const billing = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT ob.*, o.name as organization_name, ds.total_amount_due
                    FROM organization_billing ob
                    LEFT JOIN organizations o ON ob.organization_id = o.id
                    LEFT JOIN dunning_states ds ON ob.organization_id = ds.organization_id
                    WHERE ob.organization_id = ?
                `, [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!billing?.billing_email) return false;

            // Select template based on step
            let templateKey = 'payment_failed';
            let subject = 'Payment Failed - Action Required';

            if (step >= 2) {
                templateKey = 'invoice_overdue';
                subject = `⚠️ Payment Overdue - Step ${step} of 4`;
            }

            const template = loadBillingTemplate(templateKey);
            if (!template) return false;

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: billing.organization_name || 'Customer',
                amount: ((billing.total_amount_due || 0) / 100).toFixed(2),
                currency: 'USD',
                daysOverdue: step * 3,
                dunningStep: step,
                maxSteps: 4,
                paymentUrl: `${EMAIL_CONFIG.appUrl}/settings/billing`,
                updatePaymentUrl: `${EMAIL_CONFIG.appUrl}/settings/billing?tab=payment`
            };

            const html = template(templateData);

            await EmailService.send({
                to: billing.billing_email,
                subject,
                html
            });

            // Update dunning state
            await new Promise((resolve) => {
                deps.db.run(`
                    UPDATE dunning_states 
                    SET emails_sent = emails_sent + 1, last_email_sent_at = datetime('now')
                    WHERE organization_id = ?
                `, [orgId], resolve);
            });

            return true;
        } catch (err) {
            console.error('[EmailService] sendDunningEmail error:', err);
            return false;
        }
    },

    /**
     * Send billing alert email (usage threshold, expiring card, etc.)
     * @param {string} orgId - Organization ID
     * @param {string} alertType - Alert type
     * @param {Object} data - Alert data
     * @returns {Promise<boolean>}
     */
    sendBillingAlertEmail: async (orgId, alertType, data) => {
        try {
            // Get billing info
            const billing = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT ob.*, o.name as organization_name
                    FROM organization_billing ob
                    LEFT JOIN organizations o ON ob.organization_id = o.id
                    WHERE ob.organization_id = ?
                `, [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!billing?.billing_email) return false;

            // Get additional recipients from alert
            let recipients = [billing.billing_email];
            if (data.notifyEmails && Array.isArray(data.notifyEmails)) {
                recipients = [...new Set([...recipients, ...data.notifyEmails])];
            }

            let templateKey = 'payment_method_expiring';
            let subject = 'Billing Alert';

            switch (alertType) {
                case 'payment_method_expiring':
                    templateKey = 'payment_method_expiring';
                    subject = '💳 Your Payment Method is Expiring Soon';
                    break;
                case 'usage_threshold':
                    templateKey = 'invoice_created'; // Reuse for now
                    subject = `⚠️ Usage Alert: ${data.threshold}% of ${data.metricName} limit reached`;
                    break;
                case 'subscription_renewing':
                    templateKey = 'subscription_renewed';
                    subject = '📅 Subscription Renewal Reminder';
                    break;
                default:
                    subject = `Billing Alert: ${alertType}`;
            }

            const template = loadBillingTemplate(templateKey);
            if (!template) {
                // Fallback to simple email
                for (const email of recipients) {
                    await EmailService.send({
                        to: email,
                        subject,
                        html: `<h1>${subject}</h1><p>Organization: ${billing.organization_name}</p><pre>${JSON.stringify(data, null, 2)}</pre>`
                    });
                }
                return true;
            }

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: billing.organization_name || 'Customer',
                alertType,
                ...data
            };

            const html = template(templateData);

            for (const email of recipients) {
                await EmailService.send({
                    to: email,
                    subject,
                    html
                });
            }

            return true;
        } catch (err) {
            console.error('[EmailService] sendBillingAlertEmail error:', err);
            return false;
        }
    },

    /**
     * Attach invoice PDF to email options
     * @param {Object} emailOptions - Email options
     * @param {string} invoiceId - Invoice ID
     * @returns {Promise<Object>} Updated email options with attachment
     */
    attachInvoicePdf: async (emailOptions, invoiceId) => {
        try {
            const invoicePdfService = await import('./invoicePdfService.js');
            const pdfBuffer = await invoicePdfService.generateInvoicePdf(invoiceId);

            // Get invoice number for filename
            const invoice = await new Promise((resolve, reject) => {
                deps.db.get('SELECT invoice_number FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            const filename = invoice?.invoice_number 
                ? `Invoice_${invoice.invoice_number}.pdf`
                : `Invoice_${invoiceId}.pdf`;

            emailOptions.attachments = emailOptions.attachments || [];
            emailOptions.attachments.push({
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf'
            });

            return emailOptions;
        } catch (err) {
            console.error('[EmailService] attachInvoicePdf error:', err);
            return emailOptions;
        }
    },

    /**
     * Send subscription canceled confirmation
     * @param {string} orgId - Organization ID
     * @param {Object} data - Cancellation data
     * @returns {Promise<boolean>}
     */
    sendSubscriptionCanceledEmail: async (orgId, data) => {
        try {
            const billing = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT ob.*, o.name as organization_name
                    FROM organization_billing ob
                    LEFT JOIN organizations o ON ob.organization_id = o.id
                    WHERE ob.organization_id = ?
                `, [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!billing?.billing_email) return false;

            const template = loadBillingTemplate('subscription_canceled');
            if (!template) return false;

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: billing.organization_name || 'Customer',
                planName: data.planName || 'Subscription',
                accessUntilDate: data.accessUntilDate 
                    ? new Date(data.accessUntilDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : 'End of billing period',
                cancellationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                amount: data.amount ? (data.amount / 100).toFixed(2) : '0.00',
                currency: data.currency || 'USD',
                refundAmount: data.refundAmount ? (data.refundAmount / 100).toFixed(2) : null,
                resubscribeUrl: `${EMAIL_CONFIG.appUrl}/settings/billing?action=resubscribe`,
                feedbackUrl: `${EMAIL_CONFIG.supportUrl}/feedback`
            };

            const html = template(templateData);

            await EmailService.send({
                to: billing.billing_email,
                subject: 'Subscription Cancellation Confirmation',
                html
            });

            return true;
        } catch (err) {
            console.error('[EmailService] sendSubscriptionCanceledEmail error:', err);
            return false;
        }
    },

    /**
     * Send credit note notification
     * @param {string} orgId - Organization ID
     * @param {Object} data - Credit note data
     * @returns {Promise<boolean>}
     */
    sendCreditNoteEmail: async (orgId, data) => {
        try {
            const billing = await new Promise((resolve, reject) => {
                deps.db.get(`
                    SELECT ob.*, o.name as organization_name
                    FROM organization_billing ob
                    LEFT JOIN organizations o ON ob.organization_id = o.id
                    WHERE ob.organization_id = ?
                `, [orgId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!billing?.billing_email) return false;

            const template = loadBillingTemplate('credit_note_issued');
            if (!template) return false;

            const templateData = {
                ...getDefaultTemplateVars(),
                recipientName: billing.organization_name || 'Customer',
                creditNoteNumber: data.noteNumber || data.id,
                amount: ((data.amount || 0) / 100).toFixed(2),
                currency: data.currency || 'USD',
                reason: data.reason || 'Credit applied to your account',
                originalInvoiceNumber: data.originalInvoiceNumber,
                issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                isRefund: data.isRefund || false,
                refundMethod: data.refundMethod,
                creditNoteUrl: `${EMAIL_CONFIG.appUrl}/settings/billing/credits/${data.id}`
            };

            const html = template(templateData);

            await EmailService.send({
                to: billing.billing_email,
                subject: `Credit Note #${data.noteNumber || data.id} Issued`,
                html
            });

            return true;
        } catch (err) {
            console.error('[EmailService] sendCreditNoteEmail error:', err);
            return false;
        }
    }
};

export default EmailService;
//# sourceMappingURL=emailService.js.map