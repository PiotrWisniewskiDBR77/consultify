/**
 * Subscription Analytics Service
 * Handles MRR tracking, churn analysis, LTV calculations, and cohort analysis
 * Fully migrated from server/services/subscriptionAnalyticsService.js to TypeScript
 */

import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/Logger.js';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface MRRData {
    totalMRR: number;
    arr: number;
    activeSubscriptions: number;
    byPlan: Array<{
        plan_id: string;
        plan_name: string;
        price_monthly: number;
        subscriber_count: number;
        plan_mrr: number;
    }>;
}

export interface MRRTrendOptions {
    days?: number;
    granularity?: 'daily' | 'monthly';
}

export interface MRRTrendData {
    period: { days: number; granularity: string };
    data: Array<{
        date: string;
        mrr: number;
        new_mrr: number;
        expansion_mrr: number;
        contraction_mrr: number;
        churn_mrr: number;
        reactivation_mrr: number;
        net_mrr_change: number;
        total_customers: number;
        new_customers: number;
        churned_customers: number;
        growth?: number;
    }>;
    summary: {
        startMRR: number;
        endMRR: number;
        totalGrowth: string;
        avgGrowth: string;
    };
}

export interface MRRMovement {
    newMRR: number;
    expansionMRR: number;
    contractionMRR: number;
    churnMRR: number;
    reactivationMRR: number;
    netMRRChange: number;
}

export interface ChurnRateOptions {
    period?: 'monthly' | 'yearly';
    months?: number;
}

export interface ChurnRateData {
    period: { months: number };
    data: Array<{
        month: string;
        churnedCustomers: number;
        churnedMRR: number;
        customerChurnRate: string;
        mrrChurnRate: string;
    }>;
    averages: {
        customerChurnRate: string;
        mrrChurnRate: string;
    };
}

export interface ChurnReason {
    reason: string | null;
    count: number;
    mrr_lost: number;
    percentage: string;
}

export interface LTVOptions {
    segmentBy?: string | null;
}

export interface LTVData {
    ltv: number;
    arpa: number;
    avgLifespanMonths: number;
    avgRevenuePerCustomer: number;
    monthlyChurnRate: string;
    ltvToCac: string | null;
}

export interface CohortAnalysisOptions {
    cohortMonths?: number;
    retentionMonths?: number;
}

export interface CohortData {
    period: { cohortMonths: number; retentionMonths: number };
    cohorts: Array<{
        cohort: string;
        startingCount: number;
        currentActive: number;
        retentionRate: string;
    }>;
}

export interface ExpansionRevenueOptions {
    months?: number;
}

export interface ExpansionRevenueData {
    period: { months: number };
    data: Array<{
        month: string;
        expansion_mrr: number;
        contraction_mrr: number;
        expansion_count: number;
        contraction_count: number;
        netExpansion: number;
    }>;
    totals: {
        totalExpansion: number;
        totalContraction: number;
        netTotal: number;
    };
}

export interface SubscriptionEventData {
    organizationId: string;
    eventType: string;
    fromPlanId?: string | null;
    toPlanId?: string | null;
    fromMRR?: number | null;
    toMRR?: number | null;
    mrrChange?: number | null;
    amount?: number | null;
    currency?: string;
    trigger?: string;
    triggeredBy?: string | null;
    invoiceId?: string | null;
    paymentId?: string | null;
    discountCodeId?: string | null;
    metadata?: Record<string, unknown>;
}

export interface CustomerCounts {
    total: number;
    new: number;
    churned: number;
}

export interface SnapshotResult {
    id: string;
    date: string;
}

export interface RevenueForecast {
    projectedMRR: number;
    projectedARR: number;
    confidence: string;
    assumptions: string[];
}

export interface SubscriptionHealth {
    overall: 'healthy' | 'warning' | 'critical';
    metrics: {
        churnRate: number;
        mrrGrowth: number;
        ltv: number;
        ltvToCac: number | null;
    };
    recommendations: string[];
}

// Dependency injection interface for testing
export interface SubscriptionAnalyticsDependencies {
    db: IDatabase;
    uuidv4: () => string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class SubscriptionAnalyticsService {
    private deps: SubscriptionAnalyticsDependencies;

    constructor(deps?: Partial<SubscriptionAnalyticsDependencies>) {
        this.deps = {
            db: deps?.db ?? getDatabase(),
            uuidv4: deps?.uuidv4 ?? uuidv4
        };
    }

    /**
     * Set dependencies (for testing)
     */
    setDependencies(newDeps: Partial<SubscriptionAnalyticsDependencies>): void {
        this.deps = { ...this.deps, ...newDeps };
    }

    // ==========================================
    // MRR (Monthly Recurring Revenue) ANALYTICS
    // ==========================================

    /**
     * Get current MRR and breakdown
     */
    async getCurrentMRR(): Promise<MRRData> {
        const row = await this.deps.db.get<{ total_mrr: number; active_subscriptions: number }>(
            `SELECT 
                COALESCE(SUM(sp.price_monthly), 0) as total_mrr,
                COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
            []
        );

        const mrr = row?.total_mrr || 0;

        // Get breakdown by plan
        const plans = await this.deps.db.all<{
            plan_id: string;
            plan_name: string;
            price_monthly: number;
            subscriber_count: number;
            plan_mrr: number;
        }>(
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
            []
        );

        return {
            totalMRR: mrr,
            arr: mrr * 12,
            activeSubscriptions: row?.active_subscriptions || 0,
            byPlan: plans || []
        };
    }

    /**
     * Get MRR trend over time
     */
    async getMRRTrend(options: MRRTrendOptions = {}): Promise<MRRTrendData> {
        const { days = 30, granularity = 'daily' } = options;
        const dateFormat = granularity === 'monthly' ? '%Y-%m' : '%Y-%m-%d';

        const rows = await this.deps.db.all<{
            date: string;
            mrr: number;
            new_mrr: number;
            expansion_mrr: number;
            contraction_mrr: number;
            churn_mrr: number;
            reactivation_mrr: number;
            net_mrr_change: number;
            total_customers: number;
            new_customers: number;
            churned_customers: number;
        }>(
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
            []
        );

        // Calculate growth metrics
        const data = rows || [];
        let previousMRR = data[0]?.mrr || 0;

        const enriched = data.map((row) => {
            const growth = previousMRR > 0
                ? ((row.mrr - previousMRR) / previousMRR * 100)
                : 0;
            previousMRR = row.mrr;

            return {
                ...row,
                growth: parseFloat(growth.toFixed(2))
            };
        });

        return {
            period: { days, granularity },
            data: enriched,
            summary: this.calculateTrendSummary(enriched)
        };
    }

    /**
     * Calculate MRR movement (new, expansion, churn, etc.)
     */
    async calculateMRRMovement(startDate: string, endDate: string): Promise<MRRMovement> {
        const rows = await this.deps.db.all<{
            event_type: string;
            total_change: number;
            event_count: number;
        }>(
            `SELECT 
                event_type,
                SUM(mrr_change) as total_change,
                COUNT(*) as event_count
             FROM subscription_events
             WHERE occurred_at BETWEEN ? AND ?
             AND mrr_change IS NOT NULL
             GROUP BY event_type`,
            [startDate, endDate]
        );

        const movement: MRRMovement = {
            newMRR: 0,
            expansionMRR: 0,
            contractionMRR: 0,
            churnMRR: 0,
            reactivationMRR: 0,
            netMRRChange: 0
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

        return movement;
    }

    // ==========================================
    // CHURN ANALYTICS
    // ==========================================

    /**
     * Get churn rate and analysis
     */
    async getChurnRate(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
        const { period = 'monthly', months = 6 } = options;

        // Get churn events
        const churnData = await this.deps.db.all<{
            month: string;
            churned_count: number;
            churned_mrr: number;
        }>(
            `SELECT 
                strftime('%Y-%m', occurred_at) as month,
                COUNT(*) as churned_count,
                SUM(ABS(mrr_change)) as churned_mrr
             FROM subscription_events
             WHERE event_type IN ('subscription_canceled', 'churn')
             AND occurred_at >= date('now', '-${months} months')
             GROUP BY month
             ORDER BY month ASC`,
            []
        );

        // Get starting MRR for each month
        const mrrData = await this.deps.db.all<{
            snapshot_date: string;
            total_mrr: number;
            total_customers: number;
        }>(
            `SELECT 
                snapshot_date,
                total_mrr,
                total_customers
             FROM mrr_snapshots
             WHERE snapshot_date >= date('now', '-${months} months')
             AND strftime('%d', snapshot_date) = '01'
             ORDER BY snapshot_date ASC`,
            []
        );

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

        return {
            period: { months },
            data: results,
            averages: {
                customerChurnRate: avgCustomerChurn.toFixed(2),
                mrrChurnRate: avgMRRChurn.toFixed(2)
            }
        };
    }

    /**
     * Get churn reasons breakdown
     */
    async getChurnReasons(options: { months?: number } = {}): Promise<ChurnReason[]> {
        const { months = 3 } = options;

        const rows = await this.deps.db.all<{
            reason: string | null;
            count: number;
            mrr_lost: number;
        }>(
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
            []
        );

        const total = (rows || []).reduce((sum, r) => sum + r.count, 0);
        const enriched = (rows || []).map(r => ({
            ...r,
            percentage: total > 0 ? ((r.count / total) * 100).toFixed(1) : '0'
        }));

        return enriched;
    }

    // ==========================================
    // LTV (Lifetime Value) ANALYTICS
    // ==========================================

    /**
     * Calculate customer lifetime value
     */
    async getLTV(options: LTVOptions = {}): Promise<LTVData> {
        const row = await this.deps.db.get<{
            avg_revenue: number;
            avg_lifespan: number;
        }>(
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
            []
        );

        const avgRevenue = row?.avg_revenue || 0;
        const avgLifespan = row?.avg_lifespan || 1;

        // Get current MRR for ARPA calculation
        const mrrData = await this.getCurrentMRR();
        const arpa = mrrData.activeSubscriptions > 0
            ? mrrData.totalMRR / mrrData.activeSubscriptions
            : 0;

        // Get churn rate for LTV calculation
        const churnData = await this.getChurnRate({ months: 12 });
        const monthlyChurn = parseFloat(churnData.averages.customerChurnRate) / 100 || 0.05;

        // LTV = ARPA / Monthly Churn Rate
        const ltv = monthlyChurn > 0 ? arpa / monthlyChurn : arpa * 24;

        // Customer Acquisition Cost (placeholder - would need actual data)
        const cac = 0; // To be implemented with marketing data

        return {
            ltv: Math.round(ltv),
            arpa: Math.round(arpa),
            avgLifespanMonths: Math.round(avgLifespan),
            avgRevenuePerCustomer: Math.round(avgRevenue),
            monthlyChurnRate: (monthlyChurn * 100).toFixed(2),
            ltvToCac: cac > 0 ? (ltv / cac).toFixed(2) : null
        };
    }

    /**
     * Get LTV by plan/segment
     */
    async getLTVBySegment(segmentField: string = 'plan'): Promise<Array<{
        segment: string;
        segment_id?: string;
        customer_count: number;
        avg_revenue: number;
        monthly_price?: number;
    }>> {
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

        const rows = await this.deps.db.all<{
            segment: string;
            segment_id?: string;
            customer_count: number;
            avg_revenue: number;
            monthly_price?: number;
        }>(query, []);

        return rows || [];
    }

    // ==========================================
    // COHORT ANALYSIS
    // ==========================================

    /**
     * Get cohort retention analysis
     */
    async getCohortAnalysis(options: CohortAnalysisOptions = {}): Promise<CohortData> {
        const { cohortMonths = 6, retentionMonths = 12 } = options;

        // Get cohorts (customers grouped by signup month)
        const orgs = await this.deps.db.all<{
            cohort: string;
            org_id: string;
            created_at: string;
            current_status: string;
        }>(
            `SELECT 
                strftime('%Y-%m', o.created_at) as cohort,
                o.id as org_id,
                o.created_at,
                ob.status as current_status
             FROM organizations o
             LEFT JOIN organization_billing ob ON o.id = ob.organization_id
             WHERE o.created_at >= date('now', '-${cohortMonths} months')
             ORDER BY cohort ASC`,
            []
        );

        // Group by cohort
        const cohorts: Record<string, {
            cohort: string;
            startingCount: number;
            organizations: Array<{ org_id: string; created_at: string; current_status: string }>;
        }> = {};

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
                    : '0'
            };
        });

        return {
            period: { cohortMonths, retentionMonths },
            cohorts: cohortData
        };
    }

    // ==========================================
    // EXPANSION REVENUE
    // ==========================================

    /**
     * Get expansion revenue metrics
     */
    async getExpansionRevenue(options: ExpansionRevenueOptions = {}): Promise<ExpansionRevenueData> {
        const { months = 6 } = options;

        const rows = await this.deps.db.all<{
            month: string;
            expansion_mrr: number;
            contraction_mrr: number;
            expansion_count: number;
            contraction_count: number;
        }>(
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
            []
        );

        const data = (rows || []).map(row => ({
            ...row,
            netExpansion: (row.expansion_mrr || 0) - (row.contraction_mrr || 0)
        }));

        const totals = data.reduce((acc, row) => ({
            totalExpansion: acc.totalExpansion + (row.expansion_mrr || 0),
            totalContraction: acc.totalContraction + (row.contraction_mrr || 0),
            netTotal: acc.netTotal + row.netExpansion
        }), { totalExpansion: 0, totalContraction: 0, netTotal: 0 });

        return {
            period: { months },
            data,
            totals
        };
    }

    // ==========================================
    // SNAPSHOT MANAGEMENT
    // ==========================================

    /**
     * Create daily MRR snapshot
     */
    async createDailySnapshot(): Promise<SnapshotResult> {
        const today = new Date().toISOString().split('T')[0];

        // Get current MRR data
        const mrrData = await this.getCurrentMRR();

        // Get today's movement
        const startOfDay = `${today}T00:00:00`;
        const endOfDay = `${today}T23:59:59`;
        const movement = await this.calculateMRRMovement(startOfDay, endOfDay);

        // Get customer counts
        const customerCounts = await this.getCustomerCounts();

        const snapshotId = `snap-${this.deps.uuidv4()}`;

        await this.deps.db.run(
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
            ]
        );

        return { id: snapshotId, date: today };
    }

    /**
     * Get customer counts for snapshot
     */
    async getCustomerCounts(): Promise<CustomerCounts> {
        const row = await this.deps.db.get<{
            total: number;
            new: number;
            churned: number;
        }>(
            `SELECT 
                (SELECT COUNT(*) FROM organization_billing WHERE status = 'active') as total,
                (SELECT COUNT(*) FROM organization_billing 
                 WHERE status = 'active' 
                 AND created_at >= date('now', 'start of day')) as new,
                (SELECT COUNT(*) FROM subscription_history 
                 WHERE action = 'canceled' 
                 AND created_at >= date('now', 'start of day')) as churned`,
            []
        );

        return row || { total: 0, new: 0, churned: 0 };
    }

    /**
     * Record subscription event for analytics
     */
    async recordSubscriptionEvent(data: SubscriptionEventData): Promise<{ id: string }> {
        const id = `evt-${this.deps.uuidv4()}`;

        await this.deps.db.run(
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
            ]
        );

        return { id };
    }

    // ==========================================
    // ADDITIONAL METHODS (from wrapper exports)
    // ==========================================

    /**
     * Get MRR history (alias for getMRRTrend)
     */
    async getMRRHistory(options: MRRTrendOptions = {}): Promise<MRRTrendData> {
        return this.getMRRTrend(options);
    }

    /**
     * Calculate churn rate (alias for getChurnRate)
     */
    async calculateChurnRate(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
        return this.getChurnRate(options);
    }

    /**
     * Get churn analysis (alias for getChurnRate)
     */
    async getChurnAnalysis(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
        return this.getChurnRate(options);
    }

    /**
     * Calculate LTV (alias for getLTV)
     */
    async calculateLTV(options: LTVOptions = {}): Promise<LTVData> {
        return this.getLTV(options);
    }

    /**
     * Get revenue forecast (placeholder implementation)
     */
    async getRevenueForecast(): Promise<RevenueForecast> {
        const mrrData = await this.getCurrentMRR();
        const trend = await this.getMRRTrend({ days: 90 });

        // Simple projection based on current growth
        const avgGrowth = parseFloat(trend.summary.avgGrowth) || 0;
        const projectedMRR = mrrData.totalMRR * (1 + avgGrowth / 100);
        const projectedARR = projectedMRR * 12;

        return {
            projectedMRR: Math.round(projectedMRR),
            projectedARR: Math.round(projectedARR),
            confidence: avgGrowth > 0 ? 'medium' : 'low',
            assumptions: [
                'Current growth rate continues',
                'No major market changes',
                'Customer acquisition remains stable'
            ]
        };
    }

    /**
     * Get subscription health score
     */
    async getSubscriptionHealth(): Promise<SubscriptionHealth> {
        const churnData = await this.getChurnRate({ months: 3 });
        const trend = await this.getMRRTrend({ days: 30 });
        const ltvData = await this.getLTV();

        const churnRate = parseFloat(churnData.averages.customerChurnRate) || 0;
        const mrrGrowth = parseFloat(trend.summary.totalGrowth) || 0;
        const ltv = ltvData.ltv;
        const ltvToCac = ltvData.ltvToCac ? parseFloat(ltvData.ltvToCac) : null;

        let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
        const recommendations: string[] = [];

        if (churnRate > 5) {
            overall = 'critical';
            recommendations.push('High churn rate detected - investigate cancellation reasons');
        } else if (churnRate > 3) {
            overall = 'warning';
            recommendations.push('Monitor churn rate - consider retention strategies');
        }

        if (mrrGrowth < 0) {
            overall = overall === 'healthy' ? 'warning' : 'critical';
            recommendations.push('Negative MRR growth - focus on expansion and retention');
        }

        if (ltvToCac && ltvToCac < 3) {
            overall = overall === 'healthy' ? 'warning' : overall;
            recommendations.push('LTV:CAC ratio below optimal - optimize acquisition costs');
        }

        return {
            overall,
            metrics: {
                churnRate,
                mrrGrowth,
                ltv,
                ltvToCac
            },
            recommendations
        };
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    private calculateTrendSummary(data: Array<{ mrr: number; growth?: number }>): {
        startMRR: number;
        endMRR: number;
        totalGrowth: string;
        avgGrowth: string;
    } {
        if (!data || data.length === 0) {
            return { startMRR: 0, endMRR: 0, totalGrowth: '0', avgGrowth: '0' };
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
}

// Create singleton instance
const subscriptionAnalyticsServiceInstance = new SubscriptionAnalyticsService();

// Export individual functions for backward compatibility
export const setDependencies = (newDeps: Partial<SubscriptionAnalyticsDependencies>) => {
    subscriptionAnalyticsServiceInstance.setDependencies(newDeps);
};

export const getCurrentMRR = () => subscriptionAnalyticsServiceInstance.getCurrentMRR();
export const getMRRHistory = (options?: MRRTrendOptions) => subscriptionAnalyticsServiceInstance.getMRRHistory(options);
export const calculateChurnRate = (options?: ChurnRateOptions) => subscriptionAnalyticsServiceInstance.calculateChurnRate(options);
export const getChurnAnalysis = (options?: ChurnRateOptions) => subscriptionAnalyticsServiceInstance.getChurnAnalysis(options);
export const calculateLTV = (options?: LTVOptions) => subscriptionAnalyticsServiceInstance.calculateLTV(options);
export const getCohortAnalysis = (options?: CohortAnalysisOptions) => subscriptionAnalyticsServiceInstance.getCohortAnalysis(options);
export const getRevenueForecast = () => subscriptionAnalyticsServiceInstance.getRevenueForecast();
export const getSubscriptionHealth = () => subscriptionAnalyticsServiceInstance.getSubscriptionHealth();

// Default export for backward compatibility
const subscriptionAnalyticsService = {
    setDependencies,
    getCurrentMRR,
    getMRRHistory,
    calculateChurnRate,
    getChurnAnalysis,
    calculateLTV,
    getCohortAnalysis,
    getRevenueForecast,
    getSubscriptionHealth
};

export default subscriptionAnalyticsService;
