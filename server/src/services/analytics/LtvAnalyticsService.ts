import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';

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

export class LtvAnalyticsService {
  private db: IDatabase;

  constructor(db?: IDatabase) {
    this.db = db || getDatabase();
  }

  /**
   * Calculate customer lifetime value
   */
  async getLTV(
    _options: LTVOptions = {},
    currentArpa: number,
    monthlyChurnRate: number
  ): Promise<LTVData> {
    const row = await this.db.get<{
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
                        THEN GREATEST(1, CAST((julianday('now') - julianday(o.created_at)) / 30 AS INTEGER))
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

    // LTV = ARPA / Monthly Churn Rate
    // If churn is 0, fall back to ARPA * 24 months
    const ltv = monthlyChurnRate > 0 ? currentArpa / monthlyChurnRate : currentArpa * 24;

    // Customer Acquisition Cost (placeholder - would need actual data)
    const cac = 0; // To be implemented with marketing data

    return {
      ltv: Math.round(ltv),
      arpa: Math.round(currentArpa),
      avgLifespanMonths: Math.round(avgLifespan),
      avgRevenuePerCustomer: Math.round(avgRevenue),
      monthlyChurnRate: (monthlyChurnRate * 100).toFixed(2),
      ltvToCac: cac > 0 ? (ltv / cac).toFixed(2) : null,
    };
  }

  /**
   * Get LTV by plan/segment
   */
  async getLTVBySegment(segmentField: string = 'plan'): Promise<
    Array<{
      segment: string;
      segment_id?: string;
      customer_count: number;
      avg_revenue: number;
      monthly_price?: number;
    }>
  > {
    const query =
      segmentField === 'plan'
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
                bts.billing_country as segment,
                COUNT(DISTINCT o.id) as customer_count,
                AVG(COALESCE(rev.total_revenue, 0)) as avg_revenue
               FROM organizations o
               LEFT JOIN billing_tax_settings bts ON bts.organization_id = o.id
               LEFT JOIN (
                   SELECT organization_id, SUM(total) as total_revenue
                   FROM invoices WHERE status = 'paid'
                   GROUP BY organization_id
               ) rev ON o.id = rev.organization_id
               GROUP BY bts.billing_country`;

    const rows = await this.db.all<{
      segment: string;
      segment_id?: string;
      customer_count: number;
      avg_revenue: number;
      monthly_price?: number;
    }>(query, []);

    return rows || [];
  }
}
