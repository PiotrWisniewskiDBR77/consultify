import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import { MRRData, MRRMovement } from './MrrAnalyticsService.js';

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

export class SnapshotService {
  private db: IDatabase;
  private uuidGenerator: () => string;

  constructor(db?: IDatabase, uuidGenerator?: () => string) {
    this.db = db || getDatabase();
    this.uuidGenerator = uuidGenerator || uuidv4;
  }

  /**
   * Create daily MRR snapshot
   */
  async createDailySnapshot(mrrData: MRRData, movement: MRRMovement): Promise<SnapshotResult> {
    const today = new Date().toISOString().split('T')[0];

    // Get customer counts
    const customerCounts = await this.getCustomerCounts();

    const snapshotId = `snap-${this.uuidGenerator()}`;

    // Postgres parity note: mrr_snapshots has a UNIQUE constraint on
    // snapshot_date (not id — id is a fresh uuid every call), so the upsert
    // must target snapshot_date explicitly. The SQLite `INSERT OR REPLACE`
    // form was auto-adapted by PostgresDatabase.adaptQuery() with
    // `ON CONFLICT (id)` (first column in the INSERT list), which never
    // matches on a same-day re-run and instead 500s with 23505
    // (duplicate key value violates unique constraint
    // "mrr_snapshots_snapshot_date_key") — verified against parity :5443.
    // Also fixed: the column is `by_plan`, not `mrr_by_plan` (42703 — column
    // does not exist).
    await this.db.run(
      `INSERT INTO mrr_snapshots (
                id, snapshot_date, total_mrr, new_mrr, expansion_mrr, contraction_mrr,
                churn_mrr, reactivation_mrr, total_customers, new_customers, churned_customers,
                by_plan, net_mrr_change
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (snapshot_date) DO UPDATE SET
                total_mrr = EXCLUDED.total_mrr,
                new_mrr = EXCLUDED.new_mrr,
                expansion_mrr = EXCLUDED.expansion_mrr,
                contraction_mrr = EXCLUDED.contraction_mrr,
                churn_mrr = EXCLUDED.churn_mrr,
                reactivation_mrr = EXCLUDED.reactivation_mrr,
                total_customers = EXCLUDED.total_customers,
                new_customers = EXCLUDED.new_customers,
                churned_customers = EXCLUDED.churned_customers,
                by_plan = EXCLUDED.by_plan,
                net_mrr_change = EXCLUDED.net_mrr_change`,
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
        movement.netMRRChange,
      ]
    );

    return { id: snapshotId, date: today };
  }

  /**
   * Get customer counts for snapshot
   */
  async getCustomerCounts(): Promise<CustomerCounts> {
    const row = await this.db.get<{
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
    const id = `evt-${this.uuidGenerator()}`;

    await this.db.run(
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
        JSON.stringify(data.metadata || {}),
      ]
    );

    return { id };
  }
}
