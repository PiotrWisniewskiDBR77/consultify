/**
 * Billing Webhook Service
 * Handles triggering and recording of billing-related webhook events
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const webhookService = require('./webhookService');

/**
 * Billing Event Types
 * Standard event types for billing and subscription management
 */
const BILLING_EVENT_TYPES = {
    // Subscription Events
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_TRIAL_ENDING: 'subscription.trial_ending',
    SUBSCRIPTION_RENEWED: 'subscription.renewed',
    SUBSCRIPTION_PAUSED: 'subscription.paused',
    SUBSCRIPTION_RESUMED: 'subscription.resumed',
    
    // Invoice Events
    INVOICE_CREATED: 'invoice.created',
    INVOICE_SENT: 'invoice.sent',
    INVOICE_PAID: 'invoice.paid',
    INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
    INVOICE_OVERDUE: 'invoice.overdue',
    INVOICE_VOIDED: 'invoice.voided',
    INVOICE_FINALIZED: 'invoice.finalized',
    
    // Payment Events
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUNDED: 'payment.refunded',
    PAYMENT_DISPUTED: 'payment.disputed',
    
    // Credit Note Events
    CREDIT_NOTE_ISSUED: 'credit_note.issued',
    CREDIT_NOTE_APPLIED: 'credit_note.applied',
    CREDIT_NOTE_REFUNDED: 'credit_note.refunded',
    CREDIT_NOTE_VOIDED: 'credit_note.voided',
    
    // Customer Events
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    CUSTOMER_DELETED: 'customer.deleted',
    
    // Usage Events
    USAGE_LIMIT_APPROACHING: 'usage.limit_approaching',
    USAGE_LIMIT_EXCEEDED: 'usage.limit_exceeded',
    USAGE_RECORD_CREATED: 'usage.record_created',
    
    // Dunning Events
    DUNNING_STARTED: 'dunning.started',
    DUNNING_RETRY_SCHEDULED: 'dunning.retry_scheduled',
    DUNNING_FINAL_ATTEMPT: 'dunning.final_attempt',
    DUNNING_COMPLETED: 'dunning.completed',
    DUNNING_FAILED: 'dunning.failed'
};

class BillingWebhookService {
    constructor(dbInstance = null) {
        this.db = dbInstance || db;
    }

    /**
     * Record a billing webhook event in the database
     */
    async recordBillingWebhookEvent(organizationId, eventType, payload, targetUrl = null) {
        const id = uuidv4();
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO billing_webhook_events (
                    id, organization_id, event_type, payload, status, target_url, attempt_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
                [id, organizationId, eventType, JSON.stringify(payload), targetUrl, now, now],
                function (err) {
                    if (err) {
                        console.error('[BillingWebhook] Error recording event:', err);
                        return reject(err);
                    }
                    resolve({ id, organizationId, eventType, status: 'pending' });
                }
            );
        });
    }

    /**
     * Update the status of a billing webhook event
     */
    async updateEventStatus(eventId, status, responseInfo = null) {
        const updates = ['status = ?', 'attempt_count = attempt_count + 1', 'last_attempt_at = datetime(\'now\')', 'updated_at = datetime(\'now\')'];
        const params = [status];

        if (status === 'failed' || status === 'retrying') {
            // Schedule next retry with exponential backoff
            const event = await this.getEventById(eventId);
            const attemptCount = (event?.attempt_count || 0) + 1;
            const delayMinutes = Math.min(Math.pow(2, attemptCount) * 5, 1440); // Max 24 hours
            updates.push(`next_retry_at = datetime('now', '+${delayMinutes} minutes')`);
        }

        params.push(eventId);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE billing_webhook_events SET ${updates.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error('[BillingWebhook] Error updating event status:', err);
                        return reject(err);
                    }
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Get a billing webhook event by ID
     */
    async getEventById(eventId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM billing_webhook_events WHERE id = ?',
                [eventId],
                (err, row) => {
                    if (err) return reject(err);
                    if (row && row.payload) {
                        row.payload = JSON.parse(row.payload);
                    }
                    resolve(row);
                }
            );
        });
    }

    /**
     * Get pending events for retry
     */
    async getPendingRetries(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM billing_webhook_events 
                 WHERE status IN ('pending', 'retrying') 
                 AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
                 AND attempt_count < 5
                 ORDER BY created_at ASC
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows?.map(row => ({
                        ...row,
                        payload: row.payload ? JSON.parse(row.payload) : null
                    })) || []);
                }
            );
        });
    }

    /**
     * Trigger a billing webhook event
     * This will send the event to all subscribed webhooks and record it
     */
    async triggerEvent(organizationId, eventType, data, options = {}) {
        const { recordOnly = false } = options;

        // Build event payload
        const eventPayload = {
            id: uuidv4(),
            type: eventType,
            created: new Date().toISOString(),
            livemode: process.env.NODE_ENV === 'production',
            data: {
                object: data
            }
        };

        // Record the event
        const recordedEvent = await this.recordBillingWebhookEvent(
            organizationId,
            eventType,
            eventPayload
        );

        // If recordOnly, don't send to external webhooks
        if (recordOnly) {
            return { recorded: true, triggered: false, eventId: recordedEvent.id };
        }

        // Trigger through the main webhook service
        try {
            const result = await webhookService.trigger(organizationId, eventType, eventPayload);
            
            // Update status based on result
            if (result.triggered > 0) {
                await this.updateEventStatus(recordedEvent.id, 'sent');
            }
            
            return { 
                recorded: true, 
                triggered: result.triggered,
                eventId: recordedEvent.id,
                results: result.results 
            };
        } catch (error) {
            console.error('[BillingWebhook] Trigger error:', error);
            await this.updateEventStatus(recordedEvent.id, 'failed');
            return { 
                recorded: true, 
                triggered: false, 
                eventId: recordedEvent.id,
                error: error.message 
            };
        }
    }

    // ==========================================
    // Convenience Methods for Common Events
    // ==========================================

    /**
     * Subscription created event
     */
    async subscriptionCreated(organizationId, subscription) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED, subscription);
    }

    /**
     * Subscription updated event
     */
    async subscriptionUpdated(organizationId, subscription, previousAttributes = {}) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.SUBSCRIPTION_UPDATED, {
            ...subscription,
            previous_attributes: previousAttributes
        });
    }

    /**
     * Subscription canceled event
     */
    async subscriptionCanceled(organizationId, subscription) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.SUBSCRIPTION_CANCELED, subscription);
    }

    /**
     * Invoice paid event
     */
    async invoicePaid(organizationId, invoice) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.INVOICE_PAID, invoice);
    }

    /**
     * Invoice payment failed event
     */
    async invoicePaymentFailed(organizationId, invoice, error = null) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.INVOICE_PAYMENT_FAILED, {
            ...invoice,
            error: error
        });
    }

    /**
     * Payment succeeded event
     */
    async paymentSucceeded(organizationId, payment) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.PAYMENT_SUCCEEDED, payment);
    }

    /**
     * Payment failed event
     */
    async paymentFailed(organizationId, payment, error = null) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.PAYMENT_FAILED, {
            ...payment,
            error: error
        });
    }

    /**
     * Payment refunded event
     */
    async paymentRefunded(organizationId, payment, refund) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.PAYMENT_REFUNDED, {
            payment,
            refund
        });
    }

    /**
     * Credit note issued event
     */
    async creditNoteIssued(organizationId, creditNote) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.CREDIT_NOTE_ISSUED, creditNote);
    }

    /**
     * Credit note applied event
     */
    async creditNoteApplied(organizationId, creditNote, invoice) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.CREDIT_NOTE_APPLIED, {
            credit_note: creditNote,
            invoice: invoice
        });
    }

    /**
     * Usage limit approaching event
     */
    async usageLimitApproaching(organizationId, usageData) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.USAGE_LIMIT_APPROACHING, usageData);
    }

    /**
     * Usage limit exceeded event
     */
    async usageLimitExceeded(organizationId, usageData) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.USAGE_LIMIT_EXCEEDED, usageData);
    }

    /**
     * Dunning started event
     */
    async dunningStarted(organizationId, dunningData) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.DUNNING_STARTED, dunningData);
    }

    /**
     * Dunning completed event
     */
    async dunningCompleted(organizationId, dunningData) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.DUNNING_COMPLETED, dunningData);
    }

    /**
     * Dunning failed event (subscription will be canceled)
     */
    async dunningFailed(organizationId, dunningData) {
        return this.triggerEvent(organizationId, BILLING_EVENT_TYPES.DUNNING_FAILED, dunningData);
    }

    // ==========================================
    // Analytics and Reporting
    // ==========================================

    /**
     * Get event statistics for an organization
     */
    async getEventStats(organizationId, period = '30 days') {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    event_type,
                    status,
                    COUNT(*) as count
                 FROM billing_webhook_events
                 WHERE organization_id = ?
                 AND created_at >= datetime('now', '-${period}')
                 GROUP BY event_type, status
                 ORDER BY count DESC`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get recent events for an organization
     */
    async getRecentEvents(organizationId, limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM billing_webhook_events
                 WHERE organization_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [organizationId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows?.map(row => ({
                        ...row,
                        payload: row.payload ? JSON.parse(row.payload) : null
                    })) || []);
                }
            );
        });
    }

    /**
     * Get failed events for retry processing
     */
    async getFailedEvents(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM billing_webhook_events
                 WHERE status = 'failed'
                 AND attempt_count < 5
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows?.map(row => ({
                        ...row,
                        payload: row.payload ? JSON.parse(row.payload) : null
                    })) || []);
                }
            );
        });
    }
}

// Export singleton instance and event types
module.exports = new BillingWebhookService();
module.exports.BillingWebhookService = BillingWebhookService;
module.exports.BILLING_EVENT_TYPES = BILLING_EVENT_TYPES;




