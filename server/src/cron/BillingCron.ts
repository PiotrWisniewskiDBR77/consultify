/**
 * Billing Cron Jobs
 * Handles scheduled tasks for billing system
 *
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface BudgetManagementService {
    resetMonthlyBudgets: () => Promise<void>;
}

interface AdminAlertService {
    checkAndTriggerAlerts: (orgId: string) => Promise<{ triggeredCount: number }>;
}

interface PayAsYouGoService {
    generatePayAsYouGoInvoice: (
        orgId: string,
        startDate: Date,
        endDate: Date,
    ) => Promise<{ invoiced: boolean; totalCost: number }>;
}

interface SeatManagementService {
    updateSeatCount: (orgId: string) => Promise<void>;
}

interface Organization {
    id: string;
}

interface OrganizationSeat {
    organization_id: string;
}

interface Dependencies {
    db: IDatabase;
    budgetManagementService: BudgetManagementService;
    adminAlertService: AdminAlertService;
    payAsYouGoService: PayAsYouGoService;
    seatManagementService: SeatManagementService;
}

// ==========================================
// BILLING CRON
// ==========================================

class BillingCron {
    private deps: Dependencies;

    constructor(deps?: Partial<Dependencies>) {
        this.deps = {
            db: deps?.db || getDatabase(),
            budgetManagementService: deps?.budgetManagementService,
            adminAlertService: deps?.adminAlertService,
            payAsYouGoService: deps?.payAsYouGoService,
            seatManagementService: deps?.seatManagementService,
        };
    }

    private async ensureDeps(): Promise<Dependencies> {
        if (!this.deps.budgetManagementService) {
            this.deps.budgetManagementService = await import('../services/budgetManagementService.js').then(
                (m) => m.default || m,
            );
        }
        if (!this.deps.adminAlertService) {
            this.deps.adminAlertService = await import('../../services/adminAlertService.js').then(
                (m) => m.default || m,
            );
        }
        if (!this.deps.payAsYouGoService) {
            this.deps.payAsYouGoService = await import('../../services/payAsYouGoService.js').then(
                (m) => m.default || m,
            );
        }
        if (!this.deps.seatManagementService) {
            this.deps.seatManagementService = await import('../../services/seatManagementService.js').then(
                (m) => m.default || m,
            );
        }
        return this.deps as Dependencies;
    }

    /**
     * Reset monthly budgets (runs daily, checks reset_day_of_month)
     */
    async resetMonthlyBudgets(): Promise<void> {
        const deps = await this.ensureDeps();
        try {
            logger.info('[BillingCron] Running resetMonthlyBudgets...');
            await deps.budgetManagementService.resetMonthlyBudgets();
            logger.info('[BillingCron] Monthly budgets reset completed');
        } catch (error: unknown) {
            logger.error('[BillingCron] Error resetting monthly budgets:', error instanceof Error ? error : null);
            throw error;
        }
    }

    /**
     * Check and trigger admin alerts (runs hourly)
     */
    async checkAndTriggerAlerts(): Promise<number> {
        const deps = await this.ensureDeps();
        try {
            logger.info('[BillingCron] Running checkAndTriggerAlerts...');

            // Get all active organizations
            const orgs = await new Promise<Organization[]>((resolve, reject) => {
                deps.db.all<Organization>(
                    'SELECT id FROM organizations WHERE status = ?',
                    ['active'],
                    (err: Error | null, rows: unknown) => {
                        if (err) reject(err);
                        else resolve((rows as Organization[]) || []);
                    },
                );
            });

            let triggeredCount = 0;
            for (const org of orgs) {
                try {
                    const result = await deps.adminAlertService.checkAndTriggerAlerts(org.id);
                    if (result.triggeredCount > 0) {
                        triggeredCount += result.triggeredCount;
                        logger.info(`[BillingCron] Triggered ${result.triggeredCount} alerts for org ${org.id}`);
                    }
                } catch (err: unknown) {
                    logger.error(`[BillingCron] Error checking alerts for org ${org.id}:`, err instanceof Error ? err : null);
                }
            }

            logger.info(`[BillingCron] Alert check completed. Triggered ${triggeredCount} alerts total`);
            return triggeredCount;
        } catch (error: unknown) {
            logger.error('[BillingCron] Error checking alerts:', error instanceof Error ? error : null);
            throw error;
        }
    }

    /**
     * Generate PAYG invoices (runs monthly)
     */
    async generatePayAsYouGoInvoices(): Promise<number> {
        const deps = await this.ensureDeps();
        try {
            logger.info('[BillingCron] Running generatePayAsYouGoInvoices...');

            const now = new Date();
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

            // Get all organizations with PAYG billing
            const orgs = await new Promise<OrganizationSeat[]>((resolve, reject) => {
                deps.db.all<OrganizationSeat>(
                    `SELECT os.organization_id
                     FROM organization_seats os
                     WHERE os.billing_model IN('pay_as_you_go', 'hybrid')`,
                    [],
                    (err: Error | null, rows: unknown) => {
                        if (err) reject(err);
                        else resolve((rows as OrganizationSeat[]) || []);
                    },
                );
            });

            let invoicesGenerated = 0;
            for (const org of orgs) {
                try {
                    const result = await deps.payAsYouGoService.generatePayAsYouGoInvoice(
                        org.organization_id,
                        lastMonthStart,
                        lastMonthEnd,
                    );
                    if (result.invoiced) {
                        invoicesGenerated++;
                        logger.info(
                            `[BillingCron] Generated invoice for org ${org.organization_id}: $${result.totalCost}`,
                        );
                    }
                } catch (err: unknown) {
                    logger.error(`[BillingCron] Error generating invoice for org ${org.organization_id}:`, err instanceof Error ? err : null);
                }
            }

            logger.info(`[BillingCron] Invoice generation completed. Generated ${invoicesGenerated} invoices`);
            return invoicesGenerated;
        } catch (error: unknown) {
            logger.error('[BillingCron] Error generating invoices:', error instanceof Error ? error : null);
            throw error;
        }
    }

    /**
     * Update seat counts (runs daily)
     */
    async updateSeatCounts(): Promise<number> {
        const deps = await this.ensureDeps();
        try {
            logger.info('[BillingCron] Running updateSeatCounts...');

            const orgs = await new Promise<Organization[]>((resolve, reject) => {
                deps.db.all<Organization>(
                    'SELECT id FROM organizations WHERE status = ?',
                    ['active'],
                    (err: Error | null, rows: unknown) => {
                        if (err) reject(err);
                        else resolve((rows as Organization[]) || []);
                    },
                );
            });

            let updated = 0;
            for (const org of orgs) {
                try {
                    await deps.seatManagementService.updateSeatCount(org.id);
                    updated++;
                } catch (err: unknown) {
                    logger.error(`[BillingCron] Error updating seat count for org ${org.id}:`, err instanceof Error ? err : null);
                }
            }

            logger.info(`[BillingCron] Seat count update completed. Updated ${updated} organizations`);
            return updated;
        } catch (error: unknown) {
            logger.error('[BillingCron] Error updating seat counts:', error instanceof Error ? error : null);
            throw error;
        }
    }

    /**
     * Calculate monthly usage (runs monthly)
     */
    async calculateMonthlyUsage(): Promise<void> {
        try {
            logger.info('[BillingCron] Running calculateMonthlyUsage...');
            // This would aggregate usage_records into usage_summaries
            // Implementation depends on your usage_summaries table structure
            logger.info('[BillingCron] Monthly usage calculation completed');
        } catch (error: unknown) {
            logger.error('[BillingCron] Error calculating monthly usage:', error instanceof Error ? error : null);
            throw error;
        }
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: BillingCron | null = null;

export function getBillingCron(deps?: Partial<Dependencies>): BillingCron {
    if (!instance) {
        instance = new BillingCron(deps);
    }
    return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export const resetMonthlyBudgets = async (deps?: Partial<Dependencies>): Promise<void> => {
    return getBillingCron(deps).resetMonthlyBudgets();
};

export const checkAndTriggerAlerts = async (deps?: Partial<Dependencies>): Promise<number> => {
    return getBillingCron(deps).checkAndTriggerAlerts();
};

export const generatePayAsYouGoInvoices = async (deps?: Partial<Dependencies>): Promise<number> => {
    return getBillingCron(deps).generatePayAsYouGoInvoices();
};

export const updateSeatCounts = async (deps?: Partial<Dependencies>): Promise<number> => {
    return getBillingCron(deps).updateSeatCounts();
};

export const calculateMonthlyUsage = async (deps?: Partial<Dependencies>): Promise<void> => {
    return getBillingCron(deps).calculateMonthlyUsage();
};

export default BillingCron;

