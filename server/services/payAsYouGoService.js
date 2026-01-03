/**
 * Pay-as-You-Go Service
 * Handles PAYG usage tracking, cost calculation, and invoice generation
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../database.js');
        deps.db = dbModule.default || dbModule;
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }
}

/**
 * Set dependencies for testing
 */
function setDependencies(newDeps) {
    deps = { ...deps, ...newDeps };
}


/**
 * Record usage for PAYG billing
 */
async function recordUsage(orgId, usageType, quantity, unitPrice, metadata = {}, userId = null, projectId = null) {
    await initDeps();
    return new Promise((resolve, reject) => {
        if (!['tokens', 'storage', 'seats', 'api_calls'].includes(usageType)) {
            reject(new Error(`Invalid usage type: ${usageType}`));
            return;
        }

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const totalCost = quantity * unitPrice;
        const id = `payg-${deps.uuidv4()}`;

        deps.db.run(
            `INSERT INTO pay_as_you_go_usage(
                id, organization_id, user_id, project_id, usage_type, quantity,
                unit_price, total_cost, billing_period_start, billing_period_end, metadata
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, orgId, userId, projectId, usageType, quantity, unitPrice, totalCost, periodStart.toISOString(), periodEnd.toISOString(), JSON.stringify(metadata)],
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, totalCost });
                }
            }
        );
    });
}

/**
 * Get current period usage
 */
async function getCurrentPeriodUsage(orgId, periodStart = null, periodEnd = null) {
    await initDeps();
    return new Promise((resolve, reject) => {
        const now = new Date();
        const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
        const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        deps.db.all(
            `SELECT 
                usage_type,
                SUM(quantity) as total_quantity,
                AVG(unit_price) as avg_unit_price,
                SUM(total_cost) as total_cost,
                COUNT(*) as usage_count
             FROM pay_as_you_go_usage
             WHERE organization_id = ?
               AND billing_period_start >= ?
               AND billing_period_end <= ?
               AND invoiced = 0
             GROUP BY usage_type`,
            [orgId, start.toISOString(), end.toISOString()],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const summary = {
                        periodStart: start.toISOString(),
                        periodEnd: end.toISOString(),
                        totalCost: 0,
                        byType: {}
                    };

                    rows.forEach(row => {
                        summary.byType[row.usage_type] = {
                            quantity: row.total_quantity,
                            avgUnitPrice: row.avg_unit_price,
                            totalCost: row.total_cost,
                            usageCount: row.usage_count
                        };
                        summary.totalCost += row.total_cost || 0;
                    });

                    resolve(summary);
                }
            }
        );
    });
}

/**
 * Generate PAYG invoice (mark usage as invoiced)
 */
async function generatePayAsYouGoInvoice(orgId, periodStart, periodEnd) {
    await initDeps();
    return new Promise((resolve, reject) => {
        getCurrentPeriodUsage(orgId, periodStart, periodEnd)
            .then((usage) => {
                if (usage.totalCost === 0) {
                    resolve({ invoiced: false, reason: 'No usage to invoice' });
                    return;
                }

                // Mark all usage records as invoiced
                deps.db.run(
                    `UPDATE pay_as_you_go_usage
                     SET invoiced = 1
                     WHERE organization_id = ?
                       AND billing_period_start >= ?
                       AND billing_period_end <= ?
                       AND invoiced = 0`,
                    [orgId, periodStart.toISOString(), periodEnd.toISOString()],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                invoiced: true,
                                periodStart: periodStart.toISOString(),
                                periodEnd: periodEnd.toISOString(),
                                totalCost: usage.totalCost,
                                usageByType: usage.byType
                            });
                        }
                    }
                );
            })
            .catch(reject);
    });
}

/**
 * Calculate usage cost
 */
async function calculateUsageCost(orgId, usageType, quantity) {
    await initDeps();
    return new Promise((resolve, reject) => {
        // Get billing model and pricing from organization
        deps.db.get(
            `SELECT os.billing_model, os.seat_price_monthly, sp.seat_price_monthly as plan_seat_price
             FROM organization_seats os
             LEFT JOIN organization_billing ob ON os.organization_id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE os.organization_id = ?`,
            [orgId],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                const billingModel = row?.billing_model || 'subscription';
                if (billingModel === 'subscription') {
                    resolve({ cost: 0, reason: 'Subscription model - no PAYG cost' });
                    return;
                }

                // Get unit price based on usage type
                let unitPrice = 0;
                switch (usageType) {
                    case 'tokens':
                        // Get token pricing from billing_margins
                        deps.db.get(
                            `SELECT base_cost_per_1k, margin_percent FROM billing_margins WHERE source_type = 'platform' AND is_active = 1`,
                            [],
                            (err, marginRow) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                const baseCost = marginRow?.base_cost_per_1k || 0.03;
                                const margin = marginRow?.margin_percent || 30;
                                unitPrice = (baseCost * (1 + margin / 100)) / 1000; // per token
                                resolve({ cost: quantity * unitPrice, unitPrice });
                            }
                        );
                        return;
                    case 'storage':
                        // Storage pricing (per GB/month)
                        unitPrice = 0.10; // $0.10 per GB/month
                        resolve({ cost: quantity * unitPrice, unitPrice });
                        return;
                    case 'seats':
                        unitPrice = row?.seat_price_monthly || row?.plan_seat_price || 0;
                        resolve({ cost: quantity * unitPrice, unitPrice });
                        return;
                    case 'api_calls':
                        unitPrice = 0.001; // $0.001 per API call
                        resolve({ cost: quantity * unitPrice, unitPrice });
                        return;
                    default:
                        reject(new Error(`Unknown usage type: ${usageType}`));
                }
            }
        );
    });
}

/**
 * Check PAYG limits before usage
 */
async function checkPayAsYouGoLimits(orgId, usageType, quantity) {
    await initDeps();
    return new Promise((resolve, reject) => {
        // For now, PAYG has no hard limits (can be extended with budget checks)
        // This method can be extended to check against budgets or org limits
        resolve({ allowed: true });
    });
}

/**
 * Get PAYG forecast (projected costs for current period)
 */
async function getPayAsYouGoForecast(orgId) {
    await initDeps();
    return new Promise((resolve, reject) => {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const daysElapsed = now.getDate();
        const daysInMonth = periodEnd.getDate();

        getCurrentPeriodUsage(orgId, periodStart, periodEnd)
            .then((usage) => {
                const projectedCost = usage.totalCost * (daysInMonth / daysElapsed);
                resolve({
                    currentCost: usage.totalCost,
                    projectedCost,
                    daysElapsed,
                    daysInMonth,
                    usageByType: usage.byType
                });
            })
            .catch(reject);
    });
}

export default {
    setDependencies,
    recordUsage,
    getCurrentPeriodUsage,
    generatePayAsYouGoInvoice,
    calculateUsageCost,
    checkPayAsYouGoLimits,
    getPayAsYouGoForecast
};







