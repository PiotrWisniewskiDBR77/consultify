import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

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

export class ChurnAnalyticsService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  /**
   * Get churn rate and analysis
   */
  async getChurnRate(options: ChurnRateOptions = {}): Promise<ChurnRateData> {
    const { period = 'monthly', months = 6 } = options;

    // Get churn events
    const churnData = await this.db.all<{
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
    const mrrData = await this.db.all<{
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
    const results = (churnData || []).map((churn) => {
      const monthStart = mrrData?.find((m) => m.snapshot_date?.startsWith(churn.month));
      const startingMRR = monthStart?.total_mrr || 1;
      const startingCustomers = monthStart?.total_customers || 1;

      return {
        month: churn.month,
        churnedCustomers: churn.churned_count,
        churnedMRR: churn.churned_mrr,
        customerChurnRate: ((churn.churned_count / startingCustomers) * 100).toFixed(2),
        mrrChurnRate: ((churn.churned_mrr / startingMRR) * 100).toFixed(2),
      };
    });

    // Calculate averages
    const avgCustomerChurn =
      results.length > 0
        ? results.reduce((sum, r) => sum + parseFloat(r.customerChurnRate), 0) / results.length
        : 0;
    const avgMRRChurn =
      results.length > 0
        ? results.reduce((sum, r) => sum + parseFloat(r.mrrChurnRate), 0) / results.length
        : 0;

    return {
      period: { months },
      data: results,
      averages: {
        customerChurnRate: avgCustomerChurn.toFixed(2),
        mrrChurnRate: avgMRRChurn.toFixed(2),
      },
    };
  }

  /**
   * Get churn reasons breakdown
   */
  async getChurnReasons(options: { months?: number } = {}): Promise<ChurnReason[]> {
    const { months = 3 } = options;

    const rows = await this.db.all<{
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
    const enriched = (rows || []).map((r) => ({
      ...r,
      percentage: total > 0 ? ((r.count / total) * 100).toFixed(1) : '0',
    }));

    return enriched;
  }
}
