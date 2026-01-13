import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

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

export class MrrAnalyticsService {
    private db: IDatabase;

    constructor(db?: IDatabase) {
        this.db = db || getDatabase();
    }

    /**
     * Get current MRR and breakdown
     */
    async getCurrentMRR(): Promise<MRRData> {
        const row = (await this.db.get<{ total_mrr: number; active_subscriptions: number }>(
            `SELECT 
                COALESCE(SUM(sp.price_monthly), 0) as total_mrr,
                COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
            [],
        ));

        const mrr = row?.total_mrr || 0;

        // Get breakdown by plan
        const plans = await this.db.all<{
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
            [],
        );

        return {
            totalMRR: mrr,
            arr: mrr * 12,
            activeSubscriptions: row?.active_subscriptions || 0,
            byPlan: plans || [],
        };
    }

    /**
     * Get MRR trend over time
     */
    async getMRRTrend(options: MRRTrendOptions = {}): Promise<MRRTrendData> {
        const { days = 30, granularity = 'daily' } = options;

        const rows = (await this.db.all<{
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
             WHERE snapshot_date >= date('now', '-' || ? || ' days')
             ORDER BY snapshot_date ASC`,
            [days],
        ));

        // Calculate growth metrics
        const data = rows || [];
        let previousMRR = data[0]?.mrr || 0;

        const enriched = data.map((row) => {
            const growth = previousMRR > 0 ? ((row.mrr - previousMRR) / previousMRR) * 100 : 0;
            previousMRR = row.mrr;

            return {
                ...row,
                growth: parseFloat(growth.toFixed(2)),
            };
        });

        return {
            period: { days, granularity },
            data: enriched,
            summary: this.calculateTrendSummary(enriched),
        };
    }

    /**
     * Calculate MRR movement (new, expansion, churn, etc.)
     */
    async calculateMRRMovement(startDate: string, endDate: string): Promise<MRRMovement> {
        const rows = (await this.db.all<{
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
            [startDate, endDate],
        ));

        const movement: MRRMovement = {
            newMRR: 0,
            expansionMRR: 0,
            contractionMRR: 0,
            churnMRR: 0,
            reactivationMRR: 0,
            netMRRChange: 0,
        };

        (rows || []).forEach((row) => {
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

        movement.netMRRChange =
            movement.newMRR +
            movement.expansionMRR +
            movement.reactivationMRR -
            movement.contractionMRR -
            movement.churnMRR;

        return movement;
    }

    /**
     * Get expansion revenue metrics
     */
    async getExpansionRevenue(options: ExpansionRevenueOptions = {}): Promise<ExpansionRevenueData> {
        const { months = 6 } = options;

        const rows = (await this.db.all<{
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
             WHERE occurred_at >= date('now', '-' || ? || ' months')
             AND mrr_change IS NOT NULL
             GROUP BY month
             ORDER BY month ASC`,
            [months],
        ));

        const data = (rows || []).map((row) => ({
            ...row,
            netExpansion: (row.expansion_mrr || 0) - (row.contraction_mrr || 0),
        }));

        const totals = data.reduce(
            (acc, row) => ({
                totalExpansion: acc.totalExpansion + (row.expansion_mrr || 0),
                totalContraction: acc.totalContraction + (row.contraction_mrr || 0),
                netTotal: acc.netTotal + row.netExpansion,
            }),
            { totalExpansion: 0, totalContraction: 0, netTotal: 0 },
        );

        return {
            period: { months },
            data,
            totals,
        };
    }

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
        const totalGrowth = startMRR > 0 ? ((endMRR - startMRR) / startMRR) * 100 : 0;
        const avgGrowth = data.reduce((sum, d) => sum + (d.growth || 0), 0) / data.length;

        return {
            startMRR,
            endMRR,
            totalGrowth: totalGrowth.toFixed(2),
            avgGrowth: avgGrowth.toFixed(2),
        };
    }
}
