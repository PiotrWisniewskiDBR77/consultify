/**
 * Dunning Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles automated collection retries and account suspension.
 * Fully migrated from server/services/dunningService.js
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface DunningStatus {
    id: string;
    organization_id: string;
    status: 'active' | 'retrying' | 'failed' | 'completed';
    current_attempt: number;
    max_attempts: number;
    next_retry_at: string | null;
    last_error: string | null;
    stripe_invoice_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface PaymentAttempt {
    id: string;
    organization_id: string;
    invoice_id: string;
    attempt_number: number;
    status: 'success' | 'failure';
    error_message?: string | null;
    created_at: string;
}

interface DunningServiceDeps {
    db: IDatabase;
    uuidv4: () => string;
    stripe: any;
    EmailService: any;
    NotificationService: any;
    AuditService: any;
}

// ==========================================
// CONSTANTS
// ==========================================

const DUNNING_SCHEDULE = [
    { day: 1, action: 'retry' },
    { day: 3, action: 'retry' },
    { day: 5, action: 'retry' },
    { day: 7, action: 'suspend' }
];

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class DunningServiceClass {
    #deps: DunningServiceDeps | null = null;
    #initialized = false;
    #initPromise: Promise<void> | null = null;

    constructor(deps?: Partial<DunningServiceDeps>) {
        if (deps?.db && deps?.uuidv4 && deps?.stripe && deps?.EmailService && deps?.NotificationService && deps?.AuditService) {
            this.#deps = deps as DunningServiceDeps;
            this.#initialized = true;
        }
    }

    async #initDeps() {
        if (this.#initialized) return;
        if (this.#initPromise) return this.#initPromise;

        this.#initPromise = (async () => {
            const [uuidModule, stripeModule, emailModule, notifyModule, auditModule] = await Promise.all([
                import('uuid'),
                import('stripe'),
                import('./emailService.js'),
                import('./NotificationService.js'),
                import('./auditService.js')
            ]);

            const { default: Stripe } = stripeModule;
            let stripe: any = null;
            if (process.env.STRIPE_SECRET_KEY) {
                try {
                    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                        apiVersion: '2025-12-15.clover' as any,
                    });
                } catch (e) {
                    logger.warn('Stripe not initialized in DunningService');
                }
            }

            this.#deps = {
                db: getDatabase(),
                uuidv4: uuidModule.v4,
                stripe,
                EmailService: emailModule.default || emailModule,
                NotificationService: notifyModule.default || notifyModule,
                AuditService: auditModule.default || auditModule
            };
            this.#initialized = true;
        })();

        return this.#initPromise;
    }

    setDependencies(newDeps: Partial<DunningServiceDeps>) {
        this.#deps = { ...this.#deps!, ...newDeps };
        this.#initialized = true;
    }

    private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.#initDeps();
        return DbPromise.get<T>(this.#deps!.db, sql, params);
    }

    private async dbRun(sql: string, params: any[] = []): Promise<{ lastID?: number; changes: number }> {
        await this.#initDeps();
        const result = await DbPromise.run(this.#deps!.db, sql, params);
        return {
            lastID: result.lastID,
            changes: result.changes || 0
        };
    }

    private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.#initDeps();
        return DbPromise.all<T>(this.#deps!.db, sql, params);
    }

    /**
     * Handle failed payment from Stripe
     */
    async handlePaymentFailed(organizationId: string, invoiceId: string, errorMsg: string): Promise<void> {
        await this.#initDeps();
        const { AuditService, NotificationService, uuidv4 } = this.#deps!;

        logger.info(`[Dunning] Payment failed for org ${organizationId}, invoice ${invoiceId}`);

        // 1. Log event
        await AuditService.logSystemEvent('PAYMENT_FAILED', 'INVOICE', invoiceId, organizationId, { error: errorMsg });

        // 2. Get or create dunning status
        let dunning = await this.dbGet<DunningStatus>(
            `SELECT * FROM dunning_status WHERE organization_id = ? AND status = 'retrying'`,
            [organizationId]
        );

        if (!dunning) {
            const id = uuidv4();
            await this.dbRun(
                `INSERT INTO dunning_status (id, organization_id, status, current_attempt, max_attempts, stripe_invoice_id)
                 VALUES (?, ?, 'retrying', 0, ?, ?)`,
                [id, organizationId, DUNNING_SCHEDULE.length, invoiceId]
            );
            dunning = { id, organization_id: organizationId, status: 'retrying', current_attempt: 0, max_attempts: DUNNING_SCHEDULE.length, stripe_invoice_id: invoiceId } as any;
        }

        // 3. Update dunning progress
        const nextAttempt = dunning!.current_attempt + 1;

        if (nextAttempt >= DUNNING_SCHEDULE.length) {
            await this.suspendOrganization(organizationId, 'Dunning failed after max attempts');
            return;
        }

        const screen = DUNNING_SCHEDULE[nextAttempt];
        const nextRetryAt = new Date();
        nextRetryAt.setDate(nextRetryAt.getDate() + screen.day);

        await this.dbRun(
            `UPDATE dunning_status SET current_attempt = ?, next_retry_at = ?, last_error = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [nextAttempt, nextRetryAt.toISOString(), errorMsg, dunning!.id]
        );

        // 4. Notify admin
        await NotificationService.sendToAdmins(organizationId, {
            type: 'billing.payment_failed',
            title: 'Payment Failed',
            message: `Your recent payment failed. We will retry automatically on ${nextRetryAt.toLocaleDateString()}.`,
            metadata: { invoiceId, nextRetryAt: nextRetryAt.toISOString() }
        });
    }

    /**
     * Handle successful payment (clear dunning)
     */
    async handlePaymentSucceeded(organizationId: string, invoiceId: string): Promise<void> {
        await this.#initDeps();
        const { AuditService } = this.#deps!;

        await this.dbRun(
            `UPDATE dunning_status SET status = 'completed', updated_at = datetime('now')
             WHERE organization_id = ? AND status = 'retrying'`,
            [organizationId]
        );

        await AuditService.logSystemEvent('PAYMENT_SUCCEEDED', 'INVOICE', invoiceId, organizationId);

        // Ensure org is active
        await this.reactivateOrganization(organizationId);
    }

    /**
     * Process scheduled retries (run via cron)
     */
    async processScheduledRetries(): Promise<number> {
        await this.#initDeps();
        const { stripe } = this.#deps!;

        const pending = await this.dbAll<DunningStatus>(
            `SELECT * FROM dunning_status 
             WHERE status = 'retrying' AND next_retry_at <= datetime('now')`
        );

        for (const item of pending) {
            try {
                logger.info(`[Dunning] Retrying payment for org ${item.organization_id}, invoice ${item.stripe_invoice_id}`);

                // Attempt to pay invoice via Stripe
                if (item.stripe_invoice_id) {
                    await stripe.invoices.pay(item.stripe_invoice_id);
                    // If success, stripe webhook will call handlePaymentSucceeded
                }
            } catch (err: any) {
                logger.error(`[Dunning] Retry failed for org ${item.organization_id}: ${err.message}`);
                await this.handlePaymentFailed(item.organization_id, item.stripe_invoice_id || 'unknown', err.message);
            }
        }

        return pending.length;
    }

    /**
     * Suspend organization's access
     */
    async suspendOrganization(organizationId: string, reason: string): Promise<void> {
        await this.#initDeps();
        const { AuditService, EmailService } = this.#deps!;

        await this.dbRun(
            `UPDATE organizations SET status = 'suspended', updated_at = datetime('now')
             WHERE id = ?`,
            [organizationId]
        );

        await this.dbRun(
            `UPDATE dunning_status SET status = 'failed', last_error = ?, updated_at = datetime('now')
             WHERE organization_id = ? AND status = 'retrying'`,
            [reason, organizationId]
        );

        await AuditService.logSystemEvent('ORG_SUSPENDED', 'ORGANIZATION', organizationId, organizationId, { reason });

        // Email Admins
        const admins = await this.dbAll<{ email: string }>(
            `SELECT email FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER')`,
            [organizationId]
        );

        for (const admin of admins) {
            await EmailService.send({
                to: admin.email,
                subject: 'Your account has been suspended',
                template: 'account_suspended',
                data: { reason }
            });
        }
    }

    /**
     * Reactivate organization
     */
    async reactivateOrganization(organizationId: string): Promise<void> {
        await this.#initDeps();
        const { AuditService } = this.#deps!;

        await this.dbRun(
            `UPDATE organizations SET status = 'active', updated_at = datetime('now')
             WHERE id = ? AND status = 'suspended'`,
            [organizationId]
        );

        await AuditService.logSystemEvent('ORG_ACTIVATED', 'ORGANIZATION', organizationId, organizationId);
    }
}

// ==========================================
// EXPORTS
// ==========================================

const DunningService = new DunningServiceClass();

export const handlePaymentFailed = (orgId: string, invId: string, err: string) => DunningService.handlePaymentFailed(orgId, invId, err);
export const handlePaymentSucceeded = (orgId: string, invId: string) => DunningService.handlePaymentSucceeded(orgId, invId);
export const processScheduledRetries = () => DunningService.processScheduledRetries();
export const suspendOrganization = (orgId: string, reason: string) => DunningService.suspendOrganization(orgId, reason);
export const reactivateOrganization = (orgId: string) => DunningService.reactivateOrganization(orgId);

export default DunningService;
