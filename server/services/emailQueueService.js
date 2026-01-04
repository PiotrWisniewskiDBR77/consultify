/**
 * Email Queue Service
 * 
 * Manages asynchronous email delivery with retry logic.
 * Uses BullMQ when available, falls back to simple queue for development.
 * 
 * @module services/emailQueueService
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.ts';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = getDatabase();

// Queue configuration
const CONFIG = {
    maxRetries: 3,
    retryDelays: [60000, 300000, 900000], // 1min, 5min, 15min
    defaultPriority: 5,
    batchSize: 10,
    processingInterval: 5000, // 5 seconds
    templatesPath: path.join(__dirname, '../templates/emails/billing')
};

// BullMQ queue (lazy loaded)
let emailQueue = null;
let emailWorker = null;
let bullMQAvailable = false;

// Simple in-memory queue fallback
const memoryQueue = [];
let processingActive = false;

// Template cache
const templateCache = new Map();

// Database helpers
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Initialize BullMQ if Redis is available
 */
async function initBullMQ() {
    if (emailQueue) return true;

    try {
        const { Queue, Worker } = await import('bullmq');
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        // Parse Redis URL
        const url = new URL(redisUrl);
        const connection = {
            host: url.hostname,
            port: parseInt(url.port) || 6379,
            password: url.password || undefined
        };

        emailQueue = new Queue('billing-emails', { connection });
        
        emailWorker = new Worker('billing-emails', processEmailJob, { connection });
        
        emailWorker.on('completed', (job) => {
            console.log(`[EmailQueue] Job ${job.id} completed`);
        });

        emailWorker.on('failed', (job, err) => {
            console.error(`[EmailQueue] Job ${job?.id} failed:`, err.message);
        });

        bullMQAvailable = true;
        console.log('[EmailQueue] BullMQ initialized with Redis');
        return true;
    } catch (err) {
        console.log('[EmailQueue] BullMQ not available, using memory queue:', err.message);
        bullMQAvailable = false;
        return false;
    }
}

/**
 * Load and compile Handlebars template
 * @param {string} templateKey - Template key (filename without extension)
 * @returns {Function} Compiled template
 */
function loadTemplate(templateKey) {
    if (templateCache.has(templateKey)) {
        return templateCache.get(templateKey);
    }

    const templatePath = path.join(CONFIG.templatesPath, `${templateKey}.hbs`);
    
    if (!fs.existsSync(templatePath)) {
        console.warn(`[EmailQueue] Template not found: ${templatePath}`);
        // Return a simple fallback template
        const fallback = Handlebars.compile(`
            <html>
            <body>
                <h1>{{subject}}</h1>
                <p>{{message}}</p>
            </body>
            </html>
        `);
        templateCache.set(templateKey, fallback);
        return fallback;
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateSource);
    templateCache.set(templateKey, compiled);
    return compiled;
}

/**
 * Get default template data
 * @returns {Object} Default template variables
 */
function getDefaultTemplateData() {
    return {
        companyName: process.env.COMPANY_NAME || 'Consultify',
        companyAddress: process.env.COMPANY_ADDRESS || '123 Business Street, San Francisco, CA 94105',
        logoUrl: process.env.COMPANY_LOGO_URL || 'https://consultify.app/logo.png',
        billingPortalUrl: `${process.env.APP_URL || 'https://app.consultify.app'}/settings/billing`,
        supportUrl: `${process.env.APP_URL || 'https://app.consultify.app'}/support`,
        unsubscribeUrl: `${process.env.APP_URL || 'https://app.consultify.app'}/settings/notifications`,
        year: new Date().getFullYear()
    };
}

/**
 * Queue a billing email for sending
 * @param {Object} options - Email options
 * @param {string} options.type - Email type (matches template key)
 * @param {string} options.orgId - Organization ID
 * @param {Object} options.data - Template data
 * @param {Object} [options.options] - Additional options
 * @returns {Promise<{id: string}>}
 */
export async function queueBillingEmail(options) {
    const {
        type,
        orgId,
        data,
        options: emailOptions = {}
    } = options;

    const id = uuidv4();
    const priority = emailOptions.priority || CONFIG.defaultPriority;
    const scheduledAt = emailOptions.scheduledAt || new Date();

    // Get recipient email
    let recipientEmail = emailOptions.recipientEmail;
    let recipientName = emailOptions.recipientName;

    if (!recipientEmail) {
        // Get from organization billing
        const billing = await dbGet(
            'SELECT billing_email FROM organization_billing WHERE organization_id = ?',
            [orgId]
        );
        recipientEmail = billing?.billing_email;

        if (!recipientEmail) {
            // Fallback to organization admin
            const admin = await dbGet(`
                SELECT u.email, u.name FROM users u
                JOIN organization_members om ON u.id = om.user_id
                WHERE om.organization_id = ? AND om.role IN ('ADMIN', 'OWNER')
                LIMIT 1
            `, [orgId]);
            recipientEmail = admin?.email;
            recipientName = admin?.name;
        }
    }

    if (!recipientEmail) {
        console.warn(`[EmailQueue] No recipient email found for org ${orgId}`);
        return { id, skipped: true, reason: 'No recipient email' };
    }

    // Merge template data with defaults
    const templateData = {
        ...getDefaultTemplateData(),
        recipientName: recipientName || 'Customer',
        recipientEmail,
        ...data
    };

    const subject = getEmailSubject(type, templateData);

    // Store in database
    try {
        await dbRun(`
            INSERT INTO billing_email_queue (
                id, organization_id, email_type, recipient_email, recipient_name,
                subject, template_key, template_data, priority, scheduled_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [
            id, orgId, type, recipientEmail, recipientName,
            subject, type, JSON.stringify(templateData), priority,
            scheduledAt instanceof Date ? scheduledAt.toISOString() : scheduledAt
        ]);
    } catch (err) {
        console.log('[EmailQueue] Could not store in database:', err.message);
    }

    // Queue for processing
    if (bullMQAvailable && emailQueue) {
        await emailQueue.add('send-email', {
            id,
            type,
            orgId,
            recipientEmail,
            recipientName,
            subject,
            templateData,
            priority
        }, {
            priority,
            delay: scheduledAt > new Date() ? scheduledAt.getTime() - Date.now() : 0,
            attempts: CONFIG.maxRetries,
            backoff: {
                type: 'exponential',
                delay: 60000
            }
        });
    } else {
        // Use memory queue
        memoryQueue.push({
            id,
            type,
            orgId,
            recipientEmail,
            recipientName,
            subject,
            templateData,
            priority,
            scheduledAt,
            retryCount: 0
        });
        
        // Start processing if not already running
        startMemoryQueueProcessing();
    }

    return { id };
}

/**
 * Get email subject by type
 * @param {string} type - Email type
 * @param {Object} data - Template data
 * @returns {string} Subject line
 */
function getEmailSubject(type, data) {
    const subjects = {
        'invoice_created': `New Invoice #${data.invoiceNumber || ''} Available`,
        'invoice_paid': `Payment Confirmation - Invoice #${data.invoiceNumber || ''}`,
        'invoice_overdue': `⚠️ Invoice #${data.invoiceNumber || ''} is Overdue`,
        'payment_failed': '⚠️ Payment Failed - Action Required',
        'payment_method_expiring': '💳 Your Payment Method is Expiring Soon',
        'subscription_renewed': '✅ Subscription Renewed Successfully',
        'subscription_canceled': 'Subscription Cancellation Confirmation',
        'credit_note_issued': `Credit Note #${data.creditNoteNumber || ''} Issued`
    };
    return subjects[type] || `Billing Notification - ${data.companyName}`;
}

/**
 * Process email job (BullMQ worker)
 * @param {Object} job - BullMQ job
 * @returns {Promise<void>}
 */
async function processEmailJob(job) {
    const { id, type, recipientEmail, subject, templateData } = job.data;
    
    try {
        await sendEmail({
            id,
            type,
            recipientEmail,
            subject,
            templateData
        });

        // Update database
        await dbRun(`
            UPDATE billing_email_queue 
            SET status = 'sent', sent_at = datetime('now')
            WHERE id = ?
        `, [id]);

    } catch (err) {
        // Update database with error
        await dbRun(`
            UPDATE billing_email_queue 
            SET status = 'failed', error_message = ?, retry_count = retry_count + 1
            WHERE id = ?
        `, [err.message, id]);

        throw err; // Re-throw for BullMQ retry
    }
}

/**
 * Send email using configured provider
 * @param {Object} options - Email options
 */
async function sendEmail(options) {
    const { id, type, recipientEmail, subject, templateData } = options;

    // Load and render template
    const template = loadTemplate(type);
    const html = template(templateData);

    // Import email service
    const emailService = await import('./emailService.js');
    const sendFn = emailService.default?.sendEmail || emailService.sendEmail;

    if (typeof sendFn === 'function') {
        await sendFn({
            to: recipientEmail,
            subject,
            html
        });
    } else {
        // Fallback - just log
        console.log(`[EmailQueue] Would send email to ${recipientEmail}: ${subject}`);
        
        // In development, save HTML to file
        if (process.env.NODE_ENV !== 'production') {
            const debugDir = path.join(__dirname, '../debug/emails');
            if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(debugDir, `${id}_${type}.html`),
                html
            );
        }
    }
}

/**
 * Start memory queue processing (fallback when BullMQ unavailable)
 */
function startMemoryQueueProcessing() {
    if (processingActive) return;
    processingActive = true;

    const processNext = async () => {
        if (memoryQueue.length === 0) {
            processingActive = false;
            return;
        }

        // Sort by priority and scheduled time
        memoryQueue.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return new Date(a.scheduledAt) - new Date(b.scheduledAt);
        });

        // Get next batch
        const batch = memoryQueue.splice(0, CONFIG.batchSize);
        
        for (const job of batch) {
            // Check if scheduled time has passed
            if (new Date(job.scheduledAt) > new Date()) {
                memoryQueue.push(job); // Put back in queue
                continue;
            }

            try {
                await sendEmail(job);
                
                // Update database
                try {
                    await dbRun(`
                        UPDATE billing_email_queue 
                        SET status = 'sent', sent_at = datetime('now')
                        WHERE id = ?
                    `, [job.id]);
                } catch (err) {
                    // Ignore database errors
                }
            } catch (err) {
                console.error(`[EmailQueue] Failed to send email ${job.id}:`, err.message);
                
                job.retryCount++;
                if (job.retryCount < CONFIG.maxRetries) {
                    // Schedule retry
                    job.scheduledAt = new Date(Date.now() + CONFIG.retryDelays[job.retryCount - 1]);
                    memoryQueue.push(job);
                    
                    try {
                        await dbRun(`
                            UPDATE billing_email_queue 
                            SET retry_count = ?, error_message = ?
                            WHERE id = ?
                        `, [job.retryCount, err.message, job.id]);
                    } catch (err) {
                        // Ignore database errors
                    }
                } else {
                    // Max retries reached
                    try {
                        await dbRun(`
                            UPDATE billing_email_queue 
                            SET status = 'failed', error_message = ?
                            WHERE id = ?
                        `, [`Max retries exceeded: ${err.message}`, job.id]);
                    } catch (err) {
                        // Ignore database errors
                    }
                }
            }
        }

        // Continue processing
        setTimeout(processNext, CONFIG.processingInterval);
    };

    processNext();
}

/**
 * Process email queue (manual trigger)
 * @returns {Promise<{processed: number, failed: number}>}
 */
export async function processEmailQueue() {
    await initBullMQ();

    if (bullMQAvailable) {
        // BullMQ handles processing automatically
        return { processed: 0, failed: 0, message: 'Queue processing handled by BullMQ worker' };
    }

    // Process memory queue
    let processed = 0;
    let failed = 0;

    const pending = [...memoryQueue];
    memoryQueue.length = 0;

    for (const job of pending) {
        try {
            await sendEmail(job);
            processed++;
        } catch (err) {
            failed++;
            job.retryCount++;
            if (job.retryCount < CONFIG.maxRetries) {
                memoryQueue.push(job);
            }
        }
    }

    return { processed, failed };
}

/**
 * Retry failed emails
 * @returns {Promise<{queued: number}>}
 */
export async function retryFailedEmails() {
    const failed = await dbAll(`
        SELECT * FROM billing_email_queue
        WHERE status = 'failed' AND retry_count < ?
        ORDER BY created_at DESC
        LIMIT 100
    `, [CONFIG.maxRetries]);

    for (const email of failed) {
        await dbRun(`
            UPDATE billing_email_queue 
            SET status = 'pending', retry_count = retry_count + 1
            WHERE id = ?
        `, [email.id]);

        let templateData;
        try {
            templateData = JSON.parse(email.template_data);
        } catch (e) {
            templateData = {};
        }

        if (bullMQAvailable && emailQueue) {
            await emailQueue.add('send-email', {
                id: email.id,
                type: email.email_type,
                orgId: email.organization_id,
                recipientEmail: email.recipient_email,
                recipientName: email.recipient_name,
                subject: email.subject,
                templateData,
                priority: email.priority
            });
        } else {
            memoryQueue.push({
                id: email.id,
                type: email.email_type,
                orgId: email.organization_id,
                recipientEmail: email.recipient_email,
                recipientName: email.recipient_name,
                subject: email.subject,
                templateData,
                priority: email.priority,
                scheduledAt: new Date(),
                retryCount: email.retry_count
            });
            startMemoryQueueProcessing();
        }
    }

    return { queued: failed.length };
}

/**
 * Get email status
 * @param {string} emailId - Email ID
 * @returns {Promise<Object>}
 */
export async function getEmailStatus(emailId) {
    const email = await dbGet(
        'SELECT * FROM billing_email_queue WHERE id = ?',
        [emailId]
    );

    if (!email) {
        return { found: false };
    }

    return {
        found: true,
        id: email.id,
        status: email.status,
        type: email.email_type,
        recipient: email.recipient_email,
        subject: email.subject,
        sentAt: email.sent_at,
        createdAt: email.created_at,
        retryCount: email.retry_count,
        error: email.error_message
    };
}

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
export async function getQueueStats() {
    const stats = await dbGet(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM billing_email_queue
        WHERE created_at > datetime('now', '-7 days')
    `);

    return {
        ...stats,
        memoryQueueSize: memoryQueue.length,
        bullMQAvailable,
        processingActive
    };
}

/**
 * Clear old emails from queue
 * @param {number} daysOld - Days to keep
 * @returns {Promise<{deleted: number}>}
 */
export async function clearOldEmails(daysOld = 30) {
    const result = await dbRun(`
        DELETE FROM billing_email_queue
        WHERE status IN ('sent', 'failed')
        AND created_at < datetime('now', '-' || ? || ' days')
    `, [daysOld]);

    return { deleted: result.changes };
}

// Initialize on load
initBullMQ().catch(() => {
    console.log('[EmailQueue] Starting with memory queue fallback');
});

export default {
    queueBillingEmail,
    processEmailQueue,
    retryFailedEmails,
    getEmailStatus,
    getQueueStats,
    clearOldEmails
};

