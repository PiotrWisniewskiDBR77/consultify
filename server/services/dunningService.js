/**
 * Dunning Service
 * 
 * Handles payment failure recovery with automated retry schedule.
 * 
 * Dunning Schedule:
 * - Day 0: Initial failure - immediate notification
 * - Day 3: First retry + email
 * - Day 7: Second retry + email  
 * - Day 14: Third retry + email
 * - Day 21: Final notice email
 * - Day 28: Account suspension
 * 
 * Features:
 * - Automated payment retries via Stripe
 * - Email notifications at each stage
 * - Graceful degradation (feature limits before suspension)
 * - Recovery flow when payment succeeds
 * - Audit trail of all dunning actions
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const EmailService = require('./emailService');
const AuditService = require('./auditService');

// Dunning schedule configuration (days from initial failure)
const DUNNING_SCHEDULE = {
    RETRY_1: 3,      // First retry after 3 days
    RETRY_2: 7,      // Second retry after 7 days
    RETRY_3: 14,     // Third retry after 14 days
    FINAL_NOTICE: 21, // Final warning
    SUSPENSION: 28,   // Account suspension
};

const DUNNING_STAGES = {
    CURRENT: 0,
    INITIAL_FAILURE: 1,
    RETRY_1: 2,
    RETRY_2: 3,
    RETRY_3: 4,
    FINAL_NOTICE: 5,
    SUSPENDED: 6,
};

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
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

const DunningService = {
    /**
     * Handle initial payment failure from Stripe webhook
     * @param {Object} paymentIntent - Stripe PaymentIntent object
     */
    async handlePaymentFailed(paymentIntent) {
        const { id, amount, currency, last_payment_error, metadata } = paymentIntent;
        const orgId = metadata?.organization_id;

        if (!orgId) {
            console.error('[Dunning] No organization_id in payment metadata');
            return;
        }

        console.log(`[Dunning] Payment failed for org ${orgId}: ${last_payment_error?.message}`);

        // Record payment attempt
        await dbRun(
            `INSERT INTO payment_attempts 
             (id, organization_id, stripe_payment_intent_id, amount, currency, status, failure_code, failure_reason, attempt_number)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, 1)`,
            [
                uuidv4(),
                orgId,
                id,
                amount,
                currency,
                last_payment_error?.code || 'unknown',
                last_payment_error?.message || 'Payment failed'
            ]
        );

        // Get current dunning state
        const org = await dbGet(`SELECT * FROM organizations WHERE id = ?`, [orgId]);

        if (!org) {
            console.error(`[Dunning] Organization not found: ${orgId}`);
            return;
        }

        // If already in dunning, don't restart
        if (org.dunning_stage > 0) {
            console.log(`[Dunning] Org ${orgId} already in dunning stage ${org.dunning_stage}`);
            return;
        }

        // Start dunning process
        await this._startDunning(orgId);
    },

    /**
     * Handle successful payment
     * @param {Object} paymentIntent - Stripe PaymentIntent object
     */
    async handlePaymentSucceeded(paymentIntent) {
        const { id, amount, currency, metadata } = paymentIntent;
        const orgId = metadata?.organization_id;

        if (!orgId) return;

        console.log(`[Dunning] Payment succeeded for org ${orgId}`);

        // Record successful payment
        await dbRun(
            `INSERT INTO payment_attempts 
             (id, organization_id, stripe_payment_intent_id, amount, currency, status)
             VALUES (?, ?, ?, ?, ?, 'succeeded')`,
            [uuidv4(), orgId, id, amount, currency]
        );

        // Exit dunning if active
        const org = await dbGet(`SELECT dunning_stage FROM organizations WHERE id = ?`, [orgId]);

        if (org && org.dunning_stage > 0) {
            await this._exitDunning(orgId, 'payment_recovered');
        }

        // Update last successful payment
        await dbRun(
            `UPDATE organizations SET last_successful_payment_at = datetime('now') WHERE id = ?`,
            [orgId]
        );
    },

    /**
     * Process scheduled retries (run via cron)
     */
    async processScheduledRetries() {
        console.log('[Dunning] Processing scheduled retries...');

        // Get organizations needing action
        const orgsToProcess = await dbAll(
            `SELECT o.*, 
                    julianday('now') - julianday(o.dunning_started_at) as days_since_start
             FROM organizations o
             WHERE o.dunning_stage > 0 
               AND o.dunning_stage < ?
               AND o.status = 'active'`,
            [DUNNING_STAGES.SUSPENDED]
        );

        for (const org of orgsToProcess) {
            try {
                await this._processOrgDunning(org);
            } catch (error) {
                console.error(`[Dunning] Error processing org ${org.id}:`, error);
            }
        }

        console.log(`[Dunning] Processed ${orgsToProcess.length} organizations`);
    },

    /**
     * Get dunning status for organization
     * @param {string} orgId 
     */
    async getDunningStatus(orgId) {
        const org = await dbGet(
            `SELECT payment_status, dunning_stage, dunning_started_at, 
                    last_payment_attempt_at, suspension_scheduled_at
             FROM organizations WHERE id = ?`,
            [orgId]
        );

        if (!org || org.dunning_stage === 0) {
            return { inDunning: false, status: 'current' };
        }

        const daysSinceStart = org.dunning_started_at
            ? Math.floor((Date.now() - new Date(org.dunning_started_at).getTime()) / (24 * 60 * 60 * 1000))
            : 0;

        const daysUntilSuspension = DUNNING_SCHEDULE.SUSPENSION - daysSinceStart;

        return {
            inDunning: true,
            status: org.payment_status,
            stage: org.dunning_stage,
            stageName: Object.keys(DUNNING_STAGES).find(k => DUNNING_STAGES[k] === org.dunning_stage),
            daysSinceStart,
            daysUntilSuspension: Math.max(0, daysUntilSuspension),
            suspensionScheduledAt: org.suspension_scheduled_at,
        };
    },

    /**
     * Manually retry payment for organization
     * @param {string} orgId 
     */
    async manualRetry(orgId) {
        const org = await dbGet(`SELECT * FROM organizations WHERE id = ?`, [orgId]);

        if (!org) {
            throw new Error('Organization not found');
        }

        // Get Stripe customer/subscription
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        if (!org.stripe_customer_id) {
            throw new Error('No Stripe customer linked');
        }

        // Get latest invoice
        const invoices = await stripe.invoices.list({
            customer: org.stripe_customer_id,
            status: 'open',
            limit: 1,
        });

        if (invoices.data.length === 0) {
            throw new Error('No open invoices to retry');
        }

        // Attempt to pay the invoice
        try {
            await stripe.invoices.pay(invoices.data[0].id);
            return { success: true, message: 'Payment retry initiated' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Suspend organization manually
     * @param {string} orgId 
     * @param {string} reason 
     */
    async suspendOrganization(orgId, reason = 'manual') {
        await dbRun(
            `UPDATE organizations SET 
                status = 'suspended',
                payment_status = 'unpaid',
                dunning_stage = ?,
                suspension_reason = ?
             WHERE id = ?`,
            [DUNNING_STAGES.SUSPENDED, reason, orgId]
        );

        // Log subscription history
        await this._logSubscriptionHistory(orgId, 'suspended', null, null, reason, 'system');

        // Send suspension notification
        await this._sendDunningEmail(orgId, 'suspension');

        // Audit
        AuditService.logSystemEvent('ACCOUNT_SUSPENDED', 'organization', orgId, null, { reason });
    },

    /**
     * Reactivate suspended organization
     * @param {string} orgId 
     */
    async reactivateOrganization(orgId) {
        await dbRun(
            `UPDATE organizations SET 
                status = 'active',
                payment_status = 'current',
                dunning_stage = 0,
                dunning_started_at = NULL,
                suspension_reason = NULL,
                suspension_scheduled_at = NULL
             WHERE id = ?`,
            [orgId]
        );

        // Log subscription history
        await this._logSubscriptionHistory(orgId, 'reactivated', null, null, 'payment_recovered', 'system');

        // Send recovery notification
        await this._sendDunningEmail(orgId, 'recovery');

        // Audit
        AuditService.logSystemEvent('ACCOUNT_REACTIVATED', 'organization', orgId, null);
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    async _startDunning(orgId) {
        const suspensionDate = new Date(Date.now() + DUNNING_SCHEDULE.SUSPENSION * 24 * 60 * 60 * 1000);

        await dbRun(
            `UPDATE organizations SET 
                payment_status = 'past_due',
                dunning_stage = ?,
                dunning_started_at = datetime('now'),
                last_payment_attempt_at = datetime('now'),
                suspension_scheduled_at = ?
             WHERE id = ?`,
            [DUNNING_STAGES.INITIAL_FAILURE, suspensionDate.toISOString(), orgId]
        );

        // Send initial failure notification
        await this._sendDunningEmail(orgId, 'initial_failure');

        // Log
        await this._logSubscriptionHistory(orgId, 'dunning_started', null, null, 'payment_failed', 'system');

        AuditService.logSystemEvent('DUNNING_STARTED', 'organization', orgId, null);
    },

    async _exitDunning(orgId, reason) {
        await dbRun(
            `UPDATE organizations SET 
                payment_status = 'current',
                dunning_stage = 0,
                dunning_started_at = NULL,
                suspension_scheduled_at = NULL
             WHERE id = ?`,
            [orgId]
        );

        // Send recovery notification
        await this._sendDunningEmail(orgId, 'recovery');

        // Log
        await this._logSubscriptionHistory(orgId, 'dunning_exited', null, null, reason, 'system');

        AuditService.logSystemEvent('DUNNING_EXITED', 'organization', orgId, null, { reason });
    },

    async _processOrgDunning(org) {
        const daysSinceStart = org.days_since_start || 0;
        const currentStage = org.dunning_stage;

        // Determine next action based on days
        if (daysSinceStart >= DUNNING_SCHEDULE.SUSPENSION && currentStage < DUNNING_STAGES.SUSPENDED) {
            // Suspend account
            await this.suspendOrganization(org.id, 'dunning_complete');
        } else if (daysSinceStart >= DUNNING_SCHEDULE.FINAL_NOTICE && currentStage < DUNNING_STAGES.FINAL_NOTICE) {
            // Final notice
            await this._advanceStage(org.id, DUNNING_STAGES.FINAL_NOTICE, 'final_notice');
        } else if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_3 && currentStage < DUNNING_STAGES.RETRY_3) {
            // Third retry
            await this._advanceStage(org.id, DUNNING_STAGES.RETRY_3, 'retry_3');
            await this._attemptRetry(org.id);
        } else if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_2 && currentStage < DUNNING_STAGES.RETRY_2) {
            // Second retry
            await this._advanceStage(org.id, DUNNING_STAGES.RETRY_2, 'retry_2');
            await this._attemptRetry(org.id);
        } else if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_1 && currentStage < DUNNING_STAGES.RETRY_1) {
            // First retry
            await this._advanceStage(org.id, DUNNING_STAGES.RETRY_1, 'retry_1');
            await this._attemptRetry(org.id);
        }
    },

    async _advanceStage(orgId, newStage, notificationType) {
        await dbRun(
            `UPDATE organizations SET dunning_stage = ?, payment_status = 'unpaid' WHERE id = ?`,
            [newStage, orgId]
        );

        await this._sendDunningEmail(orgId, notificationType);

        AuditService.logSystemEvent('DUNNING_STAGE_ADVANCED', 'organization', orgId, null, { stage: newStage });
    },

    async _attemptRetry(orgId) {
        try {
            const result = await this.manualRetry(orgId);
            console.log(`[Dunning] Retry for ${orgId}: ${result.success ? 'success' : result.error}`);
        } catch (error) {
            console.error(`[Dunning] Retry failed for ${orgId}:`, error);
        }
    },

    async _sendDunningEmail(orgId, notificationType) {
        try {
            // Get org admin email
            const admin = await dbGet(
                `SELECT email, first_name FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER') LIMIT 1`,
                [orgId]
            );

            if (!admin) {
                console.warn(`[Dunning] No admin found for org ${orgId}`);
                return;
            }

            const org = await dbGet(`SELECT name, suspension_scheduled_at FROM organizations WHERE id = ?`, [orgId]);

            // Send email
            await EmailService.send({
                to: admin.email,
                subject: this._getEmailSubject(notificationType),
                template: `dunning_${notificationType}`,
                data: {
                    firstName: admin.first_name,
                    organizationName: org?.name,
                    suspensionDate: org?.suspension_scheduled_at,
                    updatePaymentUrl: `${process.env.FRONTEND_URL}/settings/billing`,
                }
            });

            // Log notification
            await dbRun(
                `INSERT INTO dunning_notifications (id, organization_id, notification_type, email_to)
                 VALUES (?, ?, ?, ?)`,
                [uuidv4(), orgId, notificationType, admin.email]
            );
        } catch (error) {
            console.error(`[Dunning] Email send failed:`, error);
        }
    },

    _getEmailSubject(notificationType) {
        const subjects = {
            initial_failure: '⚠️ Payment failed - Action required',
            retry_1: '🔄 Payment retry failed - Please update your payment method',
            retry_2: '⚠️ Second payment attempt failed',
            retry_3: '🚨 Third payment attempt failed - Action required urgently',
            final_notice: '🚨 FINAL NOTICE: Your account will be suspended',
            suspension: '❌ Your account has been suspended',
            recovery: '✅ Payment received - Your account is restored',
        };
        return subjects[notificationType] || 'Payment notification';
    },

    async _logSubscriptionHistory(orgId, action, fromPlan, toPlan, reason, performedBy) {
        await dbRun(
            `INSERT INTO subscription_history (id, organization_id, action, from_plan, to_plan, reason, performed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), orgId, action, fromPlan, toPlan, reason, performedBy]
        );
    },
};

module.exports = DunningService;
