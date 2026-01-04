/**
 * Subscription Analytics Service
 * Handles MRR tracking, churn analysis, LTV calculations, and cohort analysis
 */

// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies
 */
async function initDeps() {
    if (deps.db && deps.uuidv4) return;

    const [dbModule, uuidModule] = await Promise.all([
        import('../src/database/Database.ts'),
        import('uuid')
    ]);
    const { getDatabase } = dbModule;
    deps.db = getDatabase();
    deps.uuidv4 = uuidModule.v4;
}

/**
 * Set dependencies (for testing)
 */
export function setDependencies(newDeps = {}) {
    deps = { ...deps, ...newDeps };
}

// ==========================================
// MRR (Monthly Recurring Revenue) ANALYTICS
// ==========================================

/**
 * Get current MRR and breakdown
 */
export async function getCurrentMRR() {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT 
                COALESCE(SUM(sp.price_monthly), 0) as total_mrr,
                COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
            [],
            (err, row) => {
                if (err) return reject(err);

                const mrr = row?.total_mrr || 0;

                // Get breakdown by plan
                deps.db.all(
                    `SELECT 
                        sp.id as plan_id,
                        sp.name as plan_name,
                        sp.price_monthly,
                        COUNT(ob.id) as subscriber_count,
                        COUNT(ob.id) * sp.price_monthly as plan_mrr
                     FROM subscription_plans sp
                     LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id AND ob.status = 'active'
                     WHERE sp.is_active = 1
                     GROUP BY sp.id
                     ORDER BY plan_mrr DESC`,
                    [],
                    (err, plans) => {
                        if (err) return reject(err);

                        resolve({
                            totalMRR: mrr,
                            arr: mrr * 12,
                            activeSubscriptions: row?.active_subscriptions || 0,
                            byPlan: plans || []
                        });
                    }
                );
            }
        );
    });
}

/**
 * Get MRR trend over time
 */
export async function getMRRTrend(options = {}) {
    const { days = 30, granularity = 'daily' } = options;
    await initDeps();

    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT 
                snapshot_date as date,
                total_mrr as mrr,
                new_mrr,
                expansion_mrr,
                contraction_mrr,
                churn_mrr,
                reactivation_mrr,
                net_mrr_change,
                total_customers,
                new_customers,
                churned_customers
             FROM mrr_snapshots
             WHERE snapshot_date >= date('now', '-${days} days')
             ORDER BY snapshot_date ASC`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else {
                    // Calculate growth metrics
                    const data = rows || [];
                    let previousMRR = data[0]?.mrr || 0;

                    const enriched = data.map((row, index) => {
                        const growth = previousMRR > 0
                            ? ((row.mrr - previousMRR) / previousMRR * 100).toFixed(2)
                            : 0;
                        previousMRR = row.mrr;

                        return {
                            ...row,
                            growth: parseFloat(growth)
                        };
                    });

                    resolve({
                        period: { days, granularity },
                        data: enriched,
                        summary: calculateTrendSummary(enriched)
                    });
                }
            }
        );
    });
}

/**
 * Calculate MRR movement (new, expansion, churn, etc.)
 */
export async function calculateMRRMovement(startDate, endDate) {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT 
                event_type,
                SUM(mrr_change) as total_change,
                COUNT(*) as event_count
             FROM subscription_events
             WHERE occurred_at BETWEEN ? AND ?
             AND mrr_change IS NOT NULL
             GROUP BY event_type`,
            [startDate, endDate],
            (err, rows) => {
                if (err) return reject(err);

                const movement = {
                    newMRR: 0,
                    expansionMRR: 0,
                    contractionMRR: 0,
                    churnMRR: 0,
                    reactivationMRR: 0
                };

                (rows || []).forEach(row => {
                    switch (row.event_type) {
                        case 'subscription_created':
                        case 'trial_converted':
                            movement.newMRR += Math.abs(row.total_change || 0);
                            break;
                        case 'plan_upgraded':
                        case 'expansion':
                        case 'seat_added':
                            movement.expansionMRR += Math.abs(row.total_change || 0);
                            break;
                        case 'plan_downgraded':
                        case 'contraction':
                        case 'seat_removed':
                            movement.contractionMRR += Math.abs(row.total_change || 0);
                            break;
                        case 'subscription_canceled':
                        case 'churn':
                            movement.churnMRR += Math.abs(row.total_change || 0);
                            break;
                        case 'reactivation':
                        case 'subscription_resumed':
                            movement.reactivationMRR += Math.abs(row.total_change || 0);
                            break;
                    }
                });

                movement.netMRRChange = movement.newMRR + movement.expansionMRR +
                    movement.reactivationMRR - movement.contractionMRR - movement.churnMRR;

                resolve(movement);
            }
        );
    });
}

// ==========================================
// CHURN ANALYTICS
// ==========================================

/**
 * Get churn rate and analysis
 */
export async function getChurnRate(options = {}) {
    const { months = 6 } = options;
    await initDeps();

    return new Promise((resolve, reject) => {
        // Get churn events
        deps.db.all(
            `SELECT 
                strftime('%Y-%m', occurred_at) as month,
                COUNT(*) as churned_count,
                SUM(ABS(mrr_change)) as churned_mrr
             FROM subscription_events
             WHERE event_type IN ('subscription_canceled', 'churn')
             AND occurred_at >= date('now', '-${months} months')
             GROUP BY month
             ORDER BY month ASC`,
            [],
            async (err, churnData) => {
                if (err) return reject(err);

                // Get starting MRR for each month
                deps.db.all(
                    `SELECT 
                        snapshot_date,
                        total_mrr,
                        total_customers
                     FROM mrr_snapshots
                     WHERE snapshot_date >= date('now', '-${months} months')
                     AND strftime('%d', snapshot_date) = '01'
                     ORDER BY snapshot_date ASC`,
                    [],
                    (err, mrrData) => {
                        if (err) return reject(err);

                        // Calculate churn rates
                        const results = (churnData || []).map(churn => {
                            const monthStart = mrrData?.find(m => m.snapshot_date?.startsWith(churn.month));
                            const startingMRR = monthStart?.total_mrr || 1;
                            const startingCustomers = monthStart?.total_customers || 1;

                            return {
                                month: churn.month,
                                churnedCustomers: churn.churned_count,
                                churnedMRR: churn.churned_mrr,
                                customerChurnRate: ((churn.churned_count / startingCustomers) * 100).toFixed(2),
                                mrrChurnRate: ((churn.churned_mrr / startingMRR) * 100).toFixed(2)
                            };
                        });

                        // Calculate averages
                        const avgCustomerChurn = results.length > 0
                            ? results.reduce((sum, r) => sum + parseFloat(r.customerChurnRate), 0) / results.length
                            : 0;
                        const avgMRRChurn = results.length > 0
                            ? results.reduce((sum, r) => sum + parseFloat(r.mrrChurnRate), 0) / results.length
                            : 0;

                        resolve({
                            period: { months },
                            data: results,
                            averages: {
                                customerChurnRate: avgCustomerChurn.toFixed(2),
                                mrrChurnRate: avgMRRChurn.toFixed(2)
                            }
                        });
                    }
                );
            }
        );
    });
}

/**
 * Get churn reasons breakdown
 */
export async function getChurnReasons(options = {}) {
    const { months = 3 } = options;
    await initDeps();

    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT 
                sh.reason,
                COUNT(*) as count,
                SUM(sp.price_monthly) as mrr_lost
             FROM subscription_history sh
             LEFT JOIN organization_billing ob ON sh.organization_id = ob.organization_id
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE sh.action = 'canceled'
             AND sh.created_at >= date('now', '-${months} months')
             GROUP BY sh.reason
             ORDER BY count DESC`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const total = (rows || []).reduce((sum, r) => sum + r.count, 0);
                    const enriched = (rows || []).map(r => ({
                        ...r,
                        percentage: total > 0 ? ((r.count / total) * 100).toFixed(1) : 0
                    }));
                    resolve(enriched);
                }
            }
        );
    });
}

// ==========================================
// LTV (Lifetime Value) ANALYTICS
// ==========================================

/**
 * Calculate customer lifetime value
 */
export async function getLTV(options = {}) {
    await initDeps();

    return new Promise((resolve, reject) => {
        // Get average revenue per account and average lifespan
        deps.db.get(
            `SELECT 
                AVG(total_revenue) as avg_revenue,
                AVG(lifespan_months) as avg_lifespan
             FROM (
                SELECT 
                    o.id,
                    COALESCE(SUM(i.total), 0) as total_revenue,
                    CASE 
                        WHEN o.created_at IS NOT NULL 
                        THEN MAX(1, CAST((julianday('now') - julianday(o.created_at)) / 30 AS INTEGER))
                        ELSE 1
                    END as lifespan_months
                FROM organizations o
                LEFT JOIN invoices i ON o.id = i.organization_id AND i.status = 'paid'
                GROUP BY o.id
             )`,
            [],
            async (err, row) => {
                if (err) return reject(err);

                const avgRevenue = row?.avg_revenue || 0;
                const avgLifespan = row?.avg_lifespan || 1;

                // Get current MRR for ARPA calculation
                const mrrData = await getCurrentMRR();
                const arpa = mrrData.activeSubscriptions > 0
                    ? mrrData.totalMRR / mrrData.activeSubscriptions
                    : 0;

                // Get churn rate for LTV calculation
                const churnData = await getChurnRate({ months: 12 });
                const monthlyChurn = parseFloat(churnData.averages.customerChurnRate) / 100 || 0.05;

                // LTV = ARPA / Monthly Churn Rate
                const ltv = monthlyChurn > 0 ? arpa / monthlyChurn : arpa * 24;

                // Customer Acquisition Cost (placeholder - would need actual data)
                const cac = 0; // To be implemented with marketing data

                resolve({
                    ltv: Math.round(ltv),
                    arpa: Math.round(arpa),
                    avgLifespanMonths: Math.round(avgLifespan),
                    avgRevenuePerCustomer: Math.round(avgRevenue),
                    monthlyChurnRate: (monthlyChurn * 100).toFixed(2),
                    ltvToCac: cac > 0 ? (ltv / cac).toFixed(2) : null
                });
            }
        );
    });
}

/**
 * Get LTV by plan/segment
 */
export async function getLTVBySegment(segmentField = 'plan') {
    await initDeps();
    return new Promise((resolve, reject) => {
        const query = segmentField === 'plan'
            ? `SELECT 
                sp.name as segment,
                sp.id as segment_id,
                COUNT(DISTINCT o.id) as customer_count,
                AVG(COALESCE(rev.total_revenue, 0)) as avg_revenue,
                sp.price_monthly as monthly_price
               FROM subscription_plans sp
               LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id
               LEFT JOIN organizations o ON ob.organization_id = o.id
               LEFT JOIN (
                   SELECT organization_id, SUM(total) as total_revenue
                   FROM invoices WHERE status = 'paid'
                   GROUP BY organization_id
               ) rev ON o.id = rev.organization_id
               WHERE sp.is_active = 1
               GROUP BY sp.id`
            : `SELECT 
                o.billing_country as segment,
                COUNT(DISTINCT o.id) as customer_count,
                AVG(COALESCE(rev.total_revenue, 0)) as avg_revenue
               FROM organizations o
               LEFT JOIN (
                   SELECT organization_id, SUM(total) as total_revenue
                   FROM invoices WHERE status = 'paid'
                   GROUP BY organization_id
               ) rev ON o.id = rev.organization_id
               GROUP BY o.billing_country`;

        deps.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ==========================================
// COHORT ANALYSIS
// ==========================================

/**
 * Get cohort retention analysis
 */
export async function getCohortAnalysis(options = {}) {
    const { cohortMonths = 6, retentionMonths = 12 } = options;
    await initDeps();

    return new Promise((resolve, reject) => {
        // Get cohorts (customers grouped by signup month)
        deps.db.all(
            `SELECT 
                strftime('%Y-%m', o.created_at) as cohort,
                o.id as org_id,
                o.created_at,
                ob.status as current_status
              FROM organizations o
              LEFT JOIN organization_billing ob ON o.id = ob.organization_id
              WHERE o.created_at >= date('now', '-${cohortMonths} months')
              ORDER BY cohort ASC`,
            [],
            async (err, orgs) => {
                if (err) return reject(err);

                // Group by cohort
                const cohorts = {};
                (orgs || []).forEach(org => {
                    if (!cohorts[org.cohort]) {
                        cohorts[org.cohort] = {
                            cohort: org.cohort,
                            startingCount: 0,
                            organizations: []
                        };
                    }
                    cohorts[org.cohort].startingCount++;
                    cohorts[org.cohort].organizations.push(org);
                });

                // Calculate retention for each cohort
                const cohortData = Object.values(cohorts).map(cohort => {
                    const activeCount = cohort.organizations.filter(o =>
                        o.current_status === 'active'
                    ).length;

                    return {
                        cohort: cohort.cohort,
                        startingCount: cohort.startingCount,
                        currentActive: activeCount,
                        retentionRate: cohort.startingCount > 0
                            ? ((activeCount / cohort.startingCount) * 100).toFixed(1)
                            : 0
                    };
                });

                resolve({
                    period: { cohortMonths, retentionMonths },
                    cohorts: cohortData
                });
            }
        );
    });
}

// ==========================================
// EXPANSION REVENUE
// ==========================================

/**
 * Get expansion revenue metrics
 */
export async function getExpansionRevenue(options = {}) {
    const { months = 6 } = options;
    await initDeps();

    return new Promise((resolve, reject) => {
        deps.db.all(
            `SELECT 
                strftime('%Y-%m', occurred_at) as month,
                SUM(CASE WHEN event_type IN ('plan_upgraded', 'expansion', 'seat_added') 
                    THEN ABS(mrr_change) ELSE 0 END) as expansion_mrr,
                SUM(CASE WHEN event_type IN ('plan_downgraded', 'contraction', 'seat_removed') 
                    THEN ABS(mrr_change) ELSE 0 END) as contraction_mrr,
                COUNT(CASE WHEN event_type IN ('plan_upgraded', 'expansion', 'seat_added') 
                    THEN 1 END) as expansion_count,
                COUNT(CASE WHEN event_type IN ('plan_downgraded', 'contraction', 'seat_removed') 
                    THEN 1 END) as contraction_count
             FROM subscription_events
             WHERE occurred_at >= date('now', '-${months} months')
             AND mrr_change IS NOT NULL
             GROUP BY month
             ORDER BY month ASC`,
            [],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const data = (rows || []).map(row => ({
                        ...row,
                        netExpansion: (row.expansion_mrr || 0) - (row.contraction_mrr || 0)
                    }));

                    const totals = data.reduce((acc, row) => ({
                        totalExpansion: acc.totalExpansion + (row.expansion_mrr || 0),
                        totalContraction: acc.totalContraction + (row.contraction_mrr || 0),
                        netTotal: acc.netTotal + row.netExpansion
                    }), { totalExpansion: 0, totalContraction: 0, netTotal: 0 });

                    resolve({
                        period: { months },
                        data,
                        totals
                    });
                }
            }
        );
    });
}

// ==========================================
// SNAPSHOT MANAGEMENT
// ==========================================

/**
 * Create daily MRR snapshot
 */
export async function createDailySnapshot() {
    await initDeps();
    const today = new Date().toISOString().split('T')[0];

    // Get current MRR data
    const mrrData = await getCurrentMRR();

    // Get today's movement
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;
    const movement = await calculateMRRMovement(startOfDay, endOfDay);

    // Get customer counts
    const customerCounts = await getCustomerCounts();

    const snapshotId = `snap-${deps.uuidv4()}`;

    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT OR REPLACE INTO mrr_snapshots (
                id, snapshot_date, total_mrr, new_mrr, expansion_mrr, contraction_mrr,
                churn_mrr, reactivation_mrr, total_customers, new_customers, churned_customers,
                mrr_by_plan, net_mrr_change
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                snapshotId,
                today,
                mrrData.totalMRR,
                movement.newMRR,
                movement.expansionMRR,
                movement.contractionMRR,
                movement.churnMRR,
                movement.reactivationMRR,
                customerCounts.total,
                customerCounts.new,
                customerCounts.churned,
                JSON.stringify(mrrData.byPlan),
                movement.netMRRChange
            ],
            function (err) {
                if (err) reject(err);
                else resolve({ id: snapshotId, date: today });
            }
        );
    });
}

/**
 * Get customer counts for snapshot
 */
export async function getCustomerCounts() {
    await initDeps();
    return new Promise((resolve, reject) => {
        deps.db.get(
            `SELECT 
                (SELECT COUNT(*) FROM organization_billing WHERE status = 'active') as total,
                (SELECT COUNT(*) FROM organization_billing 
                 WHERE status = 'active' 
                 AND created_at >= date('now', 'start of day')) as new,
                (SELECT COUNT(*) FROM subscription_history 
                 WHERE action = 'canceled' 
                 AND created_at >= date('now', 'start of day')) as churned`,
            [],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || { total: 0, new: 0, churned: 0 });
            }
        );
    });
}

/**
 * Record subscription event for analytics
 */
export async function recordSubscriptionEvent(data) {
    await initDeps();
    const id = `evt-${deps.uuidv4()}`;

    return new Promise((resolve, reject) => {
        deps.db.run(
            `INSERT INTO subscription_events (
                id, organization_id, event_type, from_plan_id, to_plan_id,
                from_mrr, to_mrr, mrr_change, amount, currency,
                trigger, triggered_by, invoice_id, payment_id, discount_code_id, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.organizationId,
                data.eventType,
                data.fromPlanId || null,
                data.toPlanId || null,
                data.fromMRR || null,
                data.toMRR || null,
                data.mrrChange || null,
                data.amount || null,
                data.currency || 'USD',
                data.trigger || 'system',
                data.triggeredBy || null,
                data.invoiceId || null,
                data.paymentId || null,
                data.discountCodeId || null,
                JSON.stringify(data.metadata || {})
            ],
            function (err) {
                if (err) reject(err);
                else resolve({ id });
            }
        );
    });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateTrendSummary(data) {
    if (!data || data.length === 0) {
        return { startMRR: 0, endMRR: 0, totalGrowth: 0, avgGrowth: 0 };
    }

    const startMRR = data[0].mrr || 0;
    const endMRR = data[data.length - 1].mrr || 0;
    const totalGrowth = startMRR > 0 ? ((endMRR - startMRR) / startMRR * 100) : 0;
    const avgGrowth = data.reduce((sum, d) => sum + (d.growth || 0), 0) / data.length;

    return {
        startMRR,
        endMRR,
        totalGrowth: totalGrowth.toFixed(2),
        avgGrowth: avgGrowth.toFixed(2)
    };
}

export {
setDependencies,
    // MRR
    getCurrentMRR,
    getMRRTrend,
    calculateMRRMovement,
    // Churn
    getChurnRate,
    getChurnReasons,
    // LTV
    getLTV,
    getLTVBySegment,
    // Cohorts
    getCohortAnalysis,
    // Expansion
    getExpansionRevenue,
    // Snapshots
    createDailySnapshot,
    recordSubscriptionEvent
};

export default {
    setDependencies,
    // MRR
    getCurrentMRR,
    getMRRTrend,
    calculateMRRMovement,
    // Churn
    getChurnRate,
    getChurnReasons,
    // LTV
    getLTV,
    getLTVBySegment,
    // Cohorts
    getCohortAnalysis,
    // Expansion
    getExpansionRevenue,
    // Snapshots
    createDailySnapshot,
    recordSubscriptionEvent
};








