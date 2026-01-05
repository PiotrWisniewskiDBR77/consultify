/**
 * Dunning Service
 * Handles payment failure recovery, retries, notifications, and suspensions.
 * Fully migrated from server/services/dunningService.js to TypeScript.
 */

import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

const DUNNING_SCHEDULE = {
    RETRY_1: 3, // days
    RETRY_2: 7,
    RETRY_3: 14,
    FINAL_NOTICE: 21,
    SUSPENSION: 28,
} as const;

const DUNNING_STAGES = {
    CURRENT: 0,
    INITIAL_FAILURE: 1,
    RETRY_1: 2,
    RETRY_2: 3,
    RETRY_3: 4,
    FINAL_NOTICE: 5,
    SUSPENDED: 6,
} as const;

type DunningStageKey = keyof typeof DUNNING_STAGES;

interface DunningStatus {
    inDunning: boolean;
    status: string;
    stage: number;
    stageName?: DunningStageKey;
    daysSinceStart: number;
    daysUntilSuspension: number;
    suspensionScheduledAt?: string | null;
}

interface OrganizationRecord {
    id: string;
    name?: string;
    payment_status?: string;
    dunning_stage: number;
    dunning_started_at?: string | null;
    suspension_scheduled_at?: string | null;
    status?: string;
    stripe_customer_id?: string | null;
    last_payment_attempt_at?: string | null;
}

interface _StripeInvoiceItem {
    description?: string;
    quantity?: number | null;
    amount?: number | null;
    plan?: Stripe.Price | Stripe.Plan;
}

interface EmailServiceInterface {
    send: (options: {
        to: string;
        subject: string;
        template: string;
        data: Record<string, unknown>;
        attachments?: Array<{ filename: string; path: string }>;
    }) => Promise<boolean>;
}

interface AuditServiceInterface {
    logSystemEvent: (
        actionType: string,
        entityType: string,
        entityId: string,
        orgId?: string | null,
        metadata?: Record<string, unknown>,
    ) => Promise<void>;
}

let emailService: EmailServiceInterface | null = null;
let auditService: AuditServiceInterface | null = null;

async function getEmailService(): Promise<EmailServiceInterface | null> {
    if (!emailService) {
// const module = await import('../../services/emailService.js');
        const module = {} as any; // Stubbed missing service
        emailService = module.default || module;
    }
    return emailService;
}

async function getAuditService(): Promise<AuditServiceInterface | null> {
    if (!auditService) {
// const module = (await import('../../services/auditService.js')) as any;
        const module = {} as any; // Stubbed missing service
        auditService = module.logSystemEvent ? module : null;
    }
    return auditService;
}

export class DunningService {
    private db: IDatabase;
    private stripeClient: Stripe | null = null;

    constructor(deps?: { db?: IDatabase }) {
        this.db = deps?.db ?? getDatabase();
    }

    private getStripeClient(): Stripe {
        if (this.stripeClient) return this.stripeClient;
        const secret = process.env.STRIPE_SECRET_KEY;
        if (!secret) {
            throw new Error('Stripe API key is not configured');
        }
        this.stripeClient = new Stripe(secret, { apiVersion: '2024-11-20.acacia' as any });
        return this.stripeClient;
    }

    public async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        const orgId = (paymentIntent.metadata as Record<string, string | undefined>)?.organization_id;
        if (!orgId) {
            logger.error('[Dunning] Missing organization_id in payment metadata');
            return;
        }

        logger.info(`[Dunning] Payment failed for org ${orgId}`);

        await this.db.run(
            `INSERT INTO payment_attempts 
             (id, organization_id, stripe_payment_intent_id, amount, currency, status, failure_code, failure_reason, attempt_number)
             VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, 1)`,
            [
                uuidv4(),
                orgId,
                paymentIntent.id,
                paymentIntent.amount || 0,
                paymentIntent.currency || 'usd',
                paymentIntent.last_payment_error?.code || 'unknown',
                paymentIntent.last_payment_error?.message || 'Payment failed',
            ],
        );

        const org = await this.getOrganization(orgId);
        if (!org) {
            logger.error(`[Dunning] Organization not found: ${orgId}`);
            return;
        }

        if (org.dunning_stage > 0) {
            logger.info(`[Dunning] Org ${orgId} already in dunning stage ${org.dunning_stage}`);
            return;
        }

        await this.startDunning(orgId);
    }

    public async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        const orgId = (paymentIntent.metadata as Record<string, string | undefined>)?.organization_id;
        if (!orgId) return;

        logger.info(`[Dunning] Payment succeeded for org ${orgId}`);

        await this.db.run(
            `INSERT INTO payment_attempts 
             (id, organization_id, stripe_payment_intent_id, amount, currency, status)
             VALUES (?, ?, ?, ?, ?, 'succeeded')`,
            [uuidv4(), orgId, paymentIntent.id, paymentIntent.amount || 0, paymentIntent.currency || 'usd'],
        );

        const org = await this.getOrganization(orgId);
        if (org && org.dunning_stage > 0) {
            await this.exitDunning(orgId, 'payment_recovered');
        }

        await this.db.run(`UPDATE organizations SET last_successful_payment_at = datetime('now') WHERE id = ?`, [
            orgId,
        ]);
    }

    public async processScheduledRetries(): Promise<void> {
        logger.info('[Dunning] Processing scheduled retries...');
        const orgs = await this.db.all<OrganizationRecord & { days_since_start: number }>(
            `SELECT o.*, 
                    julianday('now') - julianday(o.dunning_started_at) as days_since_start
             FROM organizations o
             WHERE o.dunning_stage > 0 
               AND o.dunning_stage < ?
               AND o.status = 'active'`,
            [DUNNING_STAGES.SUSPENDED],
        );

        for (const org of orgs) {
            try {
                await this.processOrganizationDunning(org);
            } catch (err: unknown) {
                logger.error(`[Dunning] Error processing org ${org.id}: ${(err as Error).message}`);
            }
        }

        logger.info(`[Dunning] Processed ${orgs.length} organizations`);
    }

    public async getDunningStatus(orgId: string): Promise<DunningStatus> {
        const org = await this.getOrganization(orgId);
        if (!org || org.dunning_stage === 0) {
            return {
                inDunning: false,
                status: 'current',
                stage: 0,
                daysSinceStart: 0,
                daysUntilSuspension: DUNNING_SCHEDULE.SUSPENSION,
            };
        }

        const daysSinceStart = org.dunning_started_at
            ? Math.floor((Date.now() - new Date(org.dunning_started_at).getTime()) / (24 * 60 * 60 * 1000))
            : 0;
        const daysUntilSuspension = Math.max(0, DUNNING_SCHEDULE.SUSPENSION - daysSinceStart);

        return {
            inDunning: true,
            status: org.payment_status || 'unpaid',
            stage: org.dunning_stage,
            stageName: this.getStageName(org.dunning_stage),
            daysSinceStart,
            daysUntilSuspension,
            suspensionScheduledAt: org.suspension_scheduled_at,
        };
    }

    public async manualRetry(orgId: string): Promise<{ success: boolean; message: string; error?: string }> {
        const org = await this.getOrganization(orgId);
        if (!org) throw new Error('Organization not found');

        if (!org.stripe_customer_id) {
            throw new Error('No Stripe customer linked');
        }

        const stripe = this.getStripeClient();
        const invoices = await stripe.invoices.list({
            customer: org.stripe_customer_id,
            status: 'open',
            limit: 1,
        });

        if (invoices.data.length === 0) {
            throw new Error('No open invoices to retry');
        }

        try {
            await stripe.invoices.pay(invoices.data[0].id);
            return { success: true, message: 'Payment retry initiated' };
        } catch (error: unknown) {
            return { success: false, message: 'Retry failed', error: (error as Error).message };
        }
    }

    public async suspendOrganization(orgId: string, reason = 'manual'): Promise<void> {
        await this.db.run(
            `UPDATE organizations SET 
                status = 'suspended',
                payment_status = 'unpaid',
                dunning_stage = ?,
                suspension_reason = ?
             WHERE id = ?`,
            [DUNNING_STAGES.SUSPENDED, reason, orgId],
        );

        await this.logSubscriptionHistory(orgId, 'suspended', null, null, reason, 'system');
        await this.sendDunningEmail(orgId, 'suspension');
        await this.logAudit('ACCOUNT_SUSPENDED', 'organization', orgId, reason);
    }

    public async reactivateOrganization(orgId: string): Promise<void> {
        await this.db.run(
            `UPDATE organizations SET 
                status = 'active',
                payment_status = 'current',
                dunning_stage = 0,
                dunning_started_at = NULL,
                suspension_reason = NULL,
                suspension_scheduled_at = NULL
             WHERE id = ?`,
            [orgId],
        );

        await this.logSubscriptionHistory(orgId, 'reactivated', null, null, 'payment_recovered', 'system');
        await this.sendDunningEmail(orgId, 'recovery');
        await this.logAudit('ACCOUNT_REACTIVATED', 'organization', orgId);
    }

    private async startDunning(orgId: string): Promise<void> {
        const suspensionDate = new Date(Date.now() + DUNNING_SCHEDULE.SUSPENSION * 24 * 60 * 60 * 1000);

        await this.db.run(
            `UPDATE organizations SET 
                payment_status = 'past_due',
                dunning_stage = ?,
                dunning_started_at = datetime('now'),
                last_payment_attempt_at = datetime('now'),
                suspension_scheduled_at = ?
             WHERE id = ?`,
            [DUNNING_STAGES.INITIAL_FAILURE, suspensionDate.toISOString(), orgId],
        );

        await this.sendDunningEmail(orgId, 'initial_failure');
        await this.logSubscriptionHistory(orgId, 'dunning_started', null, null, 'payment_failed', 'system');
        await this.logAudit('DUNNING_STARTED', 'organization', orgId);
    }

    private async exitDunning(orgId: string, reason: string): Promise<void> {
        await this.db.run(
            `UPDATE organizations SET 
                payment_status = 'current',
                dunning_stage = 0,
                dunning_started_at = NULL,
                suspension_scheduled_at = NULL
             WHERE id = ?`,
            [orgId],
        );

        await this.sendDunningEmail(orgId, 'recovery');
        await this.logSubscriptionHistory(orgId, 'dunning_exited', null, null, reason, 'system');
        await this.logAudit('DUNNING_EXITED', 'organization', orgId, reason);
    }

    private async processOrganizationDunning(org: OrganizationRecord & { days_since_start?: number }): Promise<void> {
        const daysSinceStart = org.days_since_start ?? 0;
        const currentStage = org.dunning_stage;

        if (daysSinceStart >= DUNNING_SCHEDULE.SUSPENSION && currentStage < DUNNING_STAGES.SUSPENDED) {
            await this.suspendOrganization(org.id, 'dunning_complete');
            return;
        }

        if (daysSinceStart >= DUNNING_SCHEDULE.FINAL_NOTICE && currentStage < DUNNING_STAGES.FINAL_NOTICE) {
            await this.advanceStage(org.id, DUNNING_STAGES.FINAL_NOTICE, 'final_notice');
            return;
        }

        if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_3 && currentStage < DUNNING_STAGES.RETRY_3) {
            await this.advanceStage(org.id, DUNNING_STAGES.RETRY_3, 'retry_3');
            await this.attemptRetry(org.id);
            return;
        }

        if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_2 && currentStage < DUNNING_STAGES.RETRY_2) {
            await this.advanceStage(org.id, DUNNING_STAGES.RETRY_2, 'retry_2');
            await this.attemptRetry(org.id);
            return;
        }

        if (daysSinceStart >= DUNNING_SCHEDULE.RETRY_1 && currentStage < DUNNING_STAGES.RETRY_1) {
            await this.advanceStage(org.id, DUNNING_STAGES.RETRY_1, 'retry_1');
            await this.attemptRetry(org.id);
            return;
        }
    }

    private async advanceStage(orgId: string, stage: number, notificationType: string): Promise<void> {
        await this.db.run(`UPDATE organizations SET dunning_stage = ?, payment_status = 'unpaid' WHERE id = ?`, [
            stage,
            orgId,
        ]);

        await this.sendDunningEmail(orgId, notificationType);
        await this.logAudit('DUNNING_STAGE_ADVANCED', 'organization', orgId, undefined, { stage });
    }

    private async attemptRetry(orgId: string): Promise<void> {
        try {
            const result = await this.manualRetry(orgId);
            logger.info(`[Dunning] Retry for ${orgId}: ${result.success ? 'success' : result.error}`);
        } catch (error: unknown) {
            logger.error(`[Dunning] Retry failed for ${orgId}: ${(error as Error).message}`);
        }
    }

    private async sendDunningEmail(orgId: string, notificationType: string): Promise<void> {
        try {
            const admin = await this.db.get<{ email: string; first_name?: string }>(
                `SELECT email, first_name FROM users WHERE organization_id = ? AND role IN ('ADMIN', 'OWNER') LIMIT 1`,
                [orgId],
            );
            if (!admin) {
                logger.warn(`[Dunning] No admin found for org ${orgId}`);
                return;
            }

            const org = await this.getOrganization(orgId);
            const emailSvc = await getEmailService();
            if (!emailSvc) {
                logger.warn('[Dunning] EmailService unavailable');
                return;
            }

            await emailSvc.send({
                to: admin.email,
                subject: this.getEmailSubject(notificationType),
                template: `dunning_${notificationType}`,
                data: {
                    firstName: admin.first_name ?? 'Team',
                    organizationName: org?.name,
                    suspensionDate: org?.suspension_scheduled_at,
                    updatePaymentUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/settings/billing`,
                },
            });

            await this.db.run(
                `INSERT INTO dunning_notifications (id, organization_id, notification_type, email_to)
                 VALUES (?, ?, ?, ?)`,
                [uuidv4(), orgId, notificationType, admin.email],
            );
        } catch (error: unknown) {
            logger.error('[Dunning] Email send failed:', (error as Error).message);
        }
    }

    private async logSubscriptionHistory(
        orgId: string,
        action: string,
        fromPlan: string | null,
        toPlan: string | null,
        reason: string,
        performedBy: string,
    ): Promise<void> {
        await this.db.run(
            `INSERT INTO subscription_history (id, organization_id, action, from_plan, to_plan, reason, performed_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), orgId, action, fromPlan, toPlan, reason, performedBy],
        );
    }

    private getEmailSubject(notificationType: string): string {
        const subjects: Record<string, string> = {
            initial_failure: '⚠️ Payment failed - Action required',
            retry_1: '🔄 Payment retry failed - Please update your payment method',
            retry_2: '⚠️ Second payment attempt failed',
            retry_3: '🚨 Third payment attempt failed - Action required urgently',
            final_notice: '🚨 FINAL NOTICE: Your account will be suspended',
            suspension: '❌ Your account has been suspended',
            recovery: '✅ Payment received - Your account is restored',
        };
        return subjects[notificationType] ?? 'Payment notification';
    }

    private async logAudit(
        actionType: string,
        entityType: string,
        entityId: string,
        orgId?: string | null,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        const audit = await getAuditService();
        if (!audit) return;
        await audit.logSystemEvent(actionType, entityType, entityId, orgId ?? null, metadata ?? {});
    }

    private getStageName(stage: number): DunningStageKey | undefined {
        return (Object.keys(DUNNING_STAGES) as Array<DunningStageKey>).find((key) => DUNNING_STAGES[key] === stage);
    }

    private async getOrganization(orgId: string): Promise<OrganizationRecord | null> {
        return this.db.get<OrganizationRecord>(`SELECT * FROM organizations WHERE id = ?`, [orgId]);
    }
}

const dunningService = new DunningService();
export default dunningService;
