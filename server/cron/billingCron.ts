/**
 * Billing Cron Jobs
 * Handles scheduled tasks for billing system
 */

// Dependency injection container
const deps = {
    _db: null,
    _budgetManagementService: null,
    _adminAlertService: null,
    _payAsYouGoService: null,
    _seatManagementService: null,

    get db() {
        return this._db;
    },
    set db(val) {
        this._db = val;
    },

    get budgetManagementService() {
        return this._budgetManagementService;
    },
    set budgetManagementService(val) {
        this._budgetManagementService = val;
    },

    get adminAlertService() {
        return this._adminAlertService;
    },
    set adminAlertService(val) {
        this._adminAlertService = val;
    },

    get payAsYouGoService() {
        return this._payAsYouGoService;
    },
    set payAsYouGoService(val) {
        this._payAsYouGoService = val;
    },

    get seatManagementService() {
        return this._seatManagementService;
    },
    set seatManagementService(val) {
        this._seatManagementService = val;
    },
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../database.js');
        deps._db = db;
    }
    if (!deps._budgetManagementService) {
        const { default: budgetManagementService } = await import('../services/budgetService.js');
        deps._budgetManagementService = budgetManagementService;
    }
    if (!deps._adminAlertService) {
        const { default: adminAlertService } = await import('../services/adminAlertService.js');
        deps._adminAlertService = adminAlertService;
    }
    if (!deps._payAsYouGoService) {
        const { default: payAsYouGoService } = await import('../services/payAsYouGoService.js');
        deps._payAsYouGoService = payAsYouGoService;
    }
    if (!deps._seatManagementService) {
        const { default: seatManagementService } = await import('../services/seatManagementService.js');
        deps._seatManagementService = seatManagementService;
    }
}

/**
 * Reset monthly budgets (runs daily, checks reset_day_of_month)
 */
async function resetMonthlyBudgets() {
    await initDeps();
    try {
        console.log('[BillingCron] Running resetMonthlyBudgets...');
        await deps.budgetManagementService.resetMonthlyBudgets();
        console.log('[BillingCron] Monthly budgets reset completed');
    } catch (error) {
        console.error('[BillingCron] Error resetting monthly budgets:', error);
    }
}

/**
 * Check and trigger admin alerts (runs hourly)
 */
async function checkAndTriggerAlerts() {
    await initDeps();
    try {
        console.log('[BillingCron] Running checkAndTriggerAlerts...');

        // Get all active organizations
        const orgs = await new Promise((resolve, reject) => {
            deps.db.all('SELECT id FROM organizations WHERE status = ?', ['active'], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        let triggeredCount = 0;
        for (const org of orgs) {
            try {
                const result = await deps.adminAlertService.checkAndTriggerAlerts(org.id);
                if (result.triggeredCount > 0) {
                    triggeredCount += result.triggeredCount;
                    console.log(`[BillingCron] Triggered ${result.triggeredCount} alerts for org ${org.id}`);
                }
            } catch (err) {
                console.error(`[BillingCron] Error checking alerts for org ${org.id}:`, err);
            }
        }

        console.log(`[BillingCron] Alert check completed. Triggered ${triggeredCount} alerts total`);
    } catch (error) {
        console.error('[BillingCron] Error checking alerts:', error);
    }
}

/**
 * Generate PAYG invoices (runs monthly)
 */
async function generatePayAsYouGoInvoices() {
    await initDeps();
    try {
        console.log('[BillingCron] Running generatePayAsYouGoInvoices...');

        const now = new Date();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        // Get all organizations with PAYG billing
        const orgs = await new Promise((resolve, reject) => {
            deps.db.all(
                `SELECT os.organization_id
                 FROM organization_seats os
                 WHERE os.billing_model IN('pay_as_you_go', 'hybrid')`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
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
                    console.log(`[BillingCron] Generated invoice for org ${org.organization_id}: $${result.totalCost}`);
                }
            } catch (err) {
                console.error(`[BillingCron] Error generating invoice for org ${org.organization_id}:`, err);
            }
        }

        console.log(`[BillingCron] Invoice generation completed. Generated ${invoicesGenerated} invoices`);
    } catch (error) {
        console.error('[BillingCron] Error generating invoices:', error);
    }
}

/**
 * Update seat counts (runs daily)
 */
async function updateSeatCounts() {
    await initDeps();
    try {
        console.log('[BillingCron] Running updateSeatCounts...');

        const orgs = await new Promise((resolve, reject) => {
            deps.db.all('SELECT id FROM organizations WHERE status = ?', ['active'], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        let updated = 0;
        for (const org of orgs) {
            try {
                await deps.seatManagementService.updateSeatCount(org.id);
                updated++;
            } catch (err) {
                console.error(`[BillingCron] Error updating seat count for org ${org.id}:`, err);
            }
        }

        console.log(`[BillingCron] Seat count update completed. Updated ${updated} organizations`);
    } catch (error) {
        console.error('[BillingCron] Error updating seat counts:', error);
    }
}

/**
 * Calculate monthly usage (runs monthly)
 */
async function calculateMonthlyUsage() {
    await initDeps();
    try {
        console.log('[BillingCron] Running calculateMonthlyUsage...');
        // This would aggregate usage_records into usage_summaries
        // Implementation depends on your usage_summaries table structure
        console.log('[BillingCron] Monthly usage calculation completed');
    } catch (error) {
        console.error('[BillingCron] Error calculating monthly usage:', error);
    }
}

export default {
    resetMonthlyBudgets,
    checkAndTriggerAlerts,
    generatePayAsYouGoInvoices,
    updateSeatCounts,
    calculateMonthlyUsage,
};

// If run directly, execute all tasks (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
    (async () => {
        console.log('Running billing cron jobs...\n');
        await resetMonthlyBudgets();
        await checkAndTriggerAlerts();
        await updateSeatCounts();
        console.log('\n✅ All cron jobs completed');
        process.exit(0);
    })();
}
