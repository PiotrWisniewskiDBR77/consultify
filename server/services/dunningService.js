/**
 * Dunning Service
 * 
 * Manages payment retry logic and subscription recovery.
 * Implements a multi-step dunning process:
 * - Step 1: 3 days after failure - Soft reminder
 * - Step 2: 7 days after failure - Warning
 * - Step 3: 14 days after failure - Final warning
 * - Step 4: 21 days after failure - Account suspension
 * 
 * @module services/dunningService
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.ts';
import EmailService from './emailService.js';

const db = getDatabase();

// Configuration (can be overridden via settings table)
const DEFAULT_CONFIG = {
    steps: [
        { days: 3, action: 'reminder', severity: 'low' },
        { days: 7, action: 'warning', severity: 'medium' },
        { days: 14, action: 'final_warning', severity: 'high' },
        { days: 21, action: 'suspend', severity: 'critical' }
    ],
    maxRetries: 4,
    gracePeriodDays: 3,
    suspendOnMaxStep: true
};

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
 * Get dunning configuration
 * @returns {Promise<Object>}
 */
async function getConfig() {
    const settings = await dbAll("SELECT key, value FROM settings WHERE key LIKE 'dunning_%'");
    const config = { ...DEFAULT_CONFIG };

    for (const setting of settings) {
        switch (setting.key) {
            case 'dunning_step_1_days':
                config.steps[0].days = parseInt(setting.value);
                break;
            case 'dunning_step_2_days':
                config.steps[1].days = parseInt(setting.value);
                break;
            case 'dunning_step_3_days':
                config.steps[2].days = parseInt(setting.value);
                break;
            case 'dunning_step_4_days':
                config.steps[3].days = parseInt(setting.value);
                break;
            case 'dunning_max_retries':
                config.maxRetries = parseInt(setting.value);
                break;
        }
    }

    return config;
}

/**
 * Initialize dunning state for an organization
 * @param {string} orgId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 * @param {number} amountDue - Amount due in cents
 * @returns {Promise<{id: string}>}
 */
export async function initializeDunning(orgId, subscriptionId, amountDue) {
    // Check if dunning already exists
    const existing = await dbGet(
        'SELECT * FROM dunning_states WHERE organization_id = ? AND status = ?',
        [orgId, 'active']
    );

    if (existing) {
        // Update existing dunning
        await dbRun(`
            UPDATE dunning_states 
            SET total_amount_due = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [amountDue, existing.id]);
        return { id: existing.id, updated: true };
    }

    const config = await getConfig();
    const id = uuidv4();
    const nextAttemptDate = new Date();
    nextAttemptDate.setDate(nextAttemptDate.getDate() + config.steps[0].days);

    try {
        await dbRun(`
            INSERT INTO dunning_states (
                id, organization_id, subscription_id, current_step, max_steps,
                last_attempt_at, next_attempt_at, status, total_amount_due
            ) VALUES (?, ?, ?, 0, ?, datetime('now'), ?, 'active', ?)
        `, [id, orgId, subscriptionId, config.maxRetries, nextAttemptDate.toISOString(), amountDue]);
    } catch (err) {
        console.log('[DunningService] Could not create dunning state:', err.message);
        return { id: null, error: err.message };
    }

    console.log(`[DunningService] Initialized dunning for org ${orgId}`);
    return { id };
}

/**
 * Get dunning state for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object|null>}
 */
export async function getDunningState(orgId) {
    return await dbGet(
        'SELECT * FROM dunning_states WHERE organization_id = ? AND status = ?',
        [orgId, 'active']
    );
}

/**
 * Advance dunning to next step
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>}
 */
export async function advanceDunningStep(orgId) {
    const config = await getConfig();
    const dunning = await getDunningState(orgId);

    if (!dunning) {
        return { success: false, error: 'No active dunning state' };
    }

    const newStep = dunning.current_step + 1;

    if (newStep >= config.steps.length) {
        // Max steps reached - take final action
        if (config.suspendOnMaxStep) {
            await suspendSubscription(orgId, dunning.subscription_id);
        }
        
        await dbRun(`
            UPDATE dunning_states 
            SET status = 'exhausted', current_step = ?, updated_at = datetime('now')
            WHERE organization_id = ?
        `, [newStep, orgId]);

        return { success: true, action: 'suspended', step: newStep };
    }

    const stepConfig = config.steps[newStep];
    const nextAttemptDate = new Date();
    nextAttemptDate.setDate(nextAttemptDate.getDate() + (config.steps[newStep + 1]?.days || 7) - stepConfig.days);

    await dbRun(`
        UPDATE dunning_states 
        SET current_step = ?, next_attempt_at = ?, last_attempt_at = datetime('now'), updated_at = datetime('now')
        WHERE organization_id = ?
    `, [newStep, nextAttemptDate.toISOString(), orgId]);

    // Send notification email
    await EmailService.sendDunningEmail(orgId, newStep + 1);

    return { 
        success: true, 
        step: newStep, 
        action: stepConfig.action,
        severity: stepConfig.severity,
        nextAttempt: nextAttemptDate.toISOString()
    };
}

/**
 * Resolve dunning (payment successful)
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>}
 */
export async function resolveDunning(orgId) {
    const dunning = await getDunningState(orgId);

    if (!dunning) {
        return { success: true, message: 'No active dunning to resolve' };
    }

    await dbRun(`
        UPDATE dunning_states 
        SET status = 'resolved', updated_at = datetime('now')
        WHERE organization_id = ?
    `, [orgId]);

    // Reactivate subscription if it was suspended
    await reactivateSubscription(orgId);

    console.log(`[DunningService] Resolved dunning for org ${orgId}`);
    return { success: true };
}

/**
 * Process all pending dunning steps
 * Called by a cron job or scheduler
 * @returns {Promise<Object>}
 */
export async function processPendingDunning() {
    const pending = await dbAll(`
        SELECT * FROM dunning_states 
        WHERE status = 'active' 
        AND next_attempt_at <= datetime('now')
        ORDER BY next_attempt_at ASC
        LIMIT 100
    `);

    const results = {
        processed: 0,
        advanced: 0,
        suspended: 0,
        errors: 0
    };

    for (const dunning of pending) {
        try {
            // Try to retry payment first
            const paymentResult = await retryPayment(dunning.organization_id);
            
            if (paymentResult.success) {
                await resolveDunning(dunning.organization_id);
                results.processed++;
            } else {
                // Payment failed, advance dunning step
                const advanceResult = await advanceDunningStep(dunning.organization_id);
                results.processed++;
                results.advanced++;

                if (advanceResult.action === 'suspended') {
                    results.suspended++;
                }
            }
        } catch (err) {
            console.error(`[DunningService] Error processing dunning for org ${dunning.organization_id}:`, err);
            results.errors++;
        }
    }

    console.log(`[DunningService] Processed ${results.processed} dunning states`);
    return results;
}

/**
 * Retry payment for organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<{success: boolean}>}
 */
async function retryPayment(orgId) {
    try {
        // Get billing info
        const billing = await dbGet(
            'SELECT * FROM organization_billing WHERE organization_id = ?',
            [orgId]
        );

        if (!billing?.stripe_subscription_id) {
            return { success: false, error: 'No subscription found' };
        }

        // Import Stripe service
        const stripeService = await import('./stripeService.js');
        
        // Get latest unpaid invoice
        const invoice = await dbGet(`
            SELECT * FROM invoices 
            WHERE organization_id = ? AND status IN ('open', 'past_due')
            ORDER BY created_at DESC LIMIT 1
        `, [orgId]);

        if (!invoice?.stripe_invoice_id) {
            return { success: false, error: 'No unpaid invoice found' };
        }

        // Try to pay invoice via Stripe
        if (process.env.STRIPE_SECRET_KEY) {
            const { default: Stripe } = await import('stripe');
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            
            try {
                await stripe.invoices.pay(invoice.stripe_invoice_id);
                return { success: true };
            } catch (stripeErr) {
                console.log('[DunningService] Stripe payment retry failed:', stripeErr.message);
                return { success: false, error: stripeErr.message };
            }
        }

        return { success: false, error: 'Stripe not configured' };
    } catch (err) {
        console.error('[DunningService] retryPayment error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Suspend subscription
 * @param {string} orgId - Organization ID
 * @param {string} subscriptionId - Subscription ID
 */
async function suspendSubscription(orgId, subscriptionId) {
    try {
        // Update billing status
        await dbRun(`
            UPDATE organization_billing 
            SET status = 'suspended', updated_at = datetime('now')
            WHERE organization_id = ?
        `, [orgId]);

        // Record state transition
        await dbRun(`
            INSERT INTO subscription_state_history (
                id, organization_id, subscription_id, previous_state, new_state, trigger_event
            ) VALUES (?, ?, ?, 'past_due', 'suspended', 'dunning_exhausted')
        `, [uuidv4(), orgId, subscriptionId]);

        // Suspend in Stripe if available
        if (process.env.STRIPE_SECRET_KEY && subscriptionId) {
            const { default: Stripe } = await import('stripe');
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            
            try {
                await stripe.subscriptions.update(subscriptionId, {
                    pause_collection: { behavior: 'void' }
                });
            } catch (stripeErr) {
                console.log('[DunningService] Could not pause Stripe subscription:', stripeErr.message);
            }
        }

        // Notify admins
        await createNotification(orgId, 'subscription_suspended',
            'Subscription Suspended',
            'Your subscription has been suspended due to non-payment. Please update your payment method to restore access.',
            'critical'
        );

        console.log(`[DunningService] Suspended subscription for org ${orgId}`);
    } catch (err) {
        console.error('[DunningService] suspendSubscription error:', err);
    }
}

/**
 * Reactivate subscription after payment
 * @param {string} orgId - Organization ID
 */
async function reactivateSubscription(orgId) {
    try {
        const billing = await dbGet(
            'SELECT * FROM organization_billing WHERE organization_id = ?',
            [orgId]
        );

        if (billing?.status === 'suspended') {
            await dbRun(`
                UPDATE organization_billing 
                SET status = 'active', updated_at = datetime('now')
                WHERE organization_id = ?
            `, [orgId]);

            // Record state transition
            await dbRun(`
                INSERT INTO subscription_state_history (
                    id, organization_id, subscription_id, previous_state, new_state, trigger_event
                ) VALUES (?, ?, ?, 'suspended', 'active', 'payment_received')
            `, [uuidv4(), orgId, billing.stripe_subscription_id]);

            // Resume in Stripe if available
            if (process.env.STRIPE_SECRET_KEY && billing.stripe_subscription_id) {
                const { default: Stripe } = await import('stripe');
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                
                try {
                    await stripe.subscriptions.update(billing.stripe_subscription_id, {
                        pause_collection: ''
                    });
                } catch (stripeErr) {
                    console.log('[DunningService] Could not resume Stripe subscription:', stripeErr.message);
                }
            }

            // Notify admins
            await createNotification(orgId, 'subscription_reactivated',
                'Subscription Reactivated',
                'Your subscription has been reactivated. Thank you for your payment!',
                'normal'
            );

            console.log(`[DunningService] Reactivated subscription for org ${orgId}`);
        }
    } catch (err) {
        console.error('[DunningService] reactivateSubscription error:', err);
    }
}

/**
 * Create notification for organization admins
 */
async function createNotification(orgId, type, title, message, priority = 'normal') {
    try {
        const users = await dbAll(
            'SELECT id FROM users WHERE organization_id = ? AND role IN (?, ?, ?)',
            [orgId, 'ADMIN', 'SUPERADMIN', 'OWNER']
        );

        const data = JSON.stringify({ entity_type: 'billing', priority });

        for (const user of users) {
            const notifId = uuidv4();
            await dbRun(
                'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)',
                [notifId, user.id, type, title, message, data]
            );
        }
    } catch (err) {
        console.error('[DunningService] createNotification error:', err);
    }
}

/**
 * Get dunning statistics
 * @returns {Promise<Object>}
 */
export async function getDunningStats() {
    const stats = await dbGet(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            SUM(CASE WHEN status = 'exhausted' THEN 1 ELSE 0 END) as exhausted,
            SUM(total_amount_due) as total_amount_due
        FROM dunning_states
        WHERE created_at > datetime('now', '-30 days')
    `);

    const byStep = await dbAll(`
        SELECT current_step, COUNT(*) as count
        FROM dunning_states
        WHERE status = 'active'
        GROUP BY current_step
    `);

    return {
        ...stats,
        byStep: byStep.reduce((acc, row) => {
            acc[`step_${row.current_step}`] = row.count;
            return acc;
        }, {})
    };
}

export default {
    initializeDunning,
    getDunningState,
    advanceDunningStep,
    resolveDunning,
    processPendingDunning,
    getDunningStats
};

