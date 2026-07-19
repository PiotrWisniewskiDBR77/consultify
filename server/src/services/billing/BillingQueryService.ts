import type {
  BillingAlert,
  BillingModel,
  BillingPlan,
  BillingServiceDependencies,
  Invoice,
  OrganizationBilling,
  PaymentMethod,
  RevenueStats,
  SeatPricing,
  TaxSettings,
  UserLicensePlan,
} from './types.js';

type DepsAccessor = () => BillingServiceDependencies;

export class BillingQueryService {
  constructor(private readonly getDeps: DepsAccessor) {}

  private deps() {
    return this.getDeps();
  }

  async getPlans(): Promise<BillingPlan[]> {
    const deps = this.deps();
    const rows = await (deps.db.all<BillingPlan>(
      'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly DESC',
      []
    ) as Promise<BillingPlan[]>);
    return rows || [];
  }

  async getPlanById(planId: string): Promise<BillingPlan | null> {
    const deps = this.deps();
    const row = await (deps.db.get<BillingPlan>('SELECT * FROM subscription_plans WHERE id = ?', [
      planId,
    ]) as Promise<BillingPlan | null>);
    return row || null;
  }

  async getOrganizationBilling(orgId: string): Promise<OrganizationBilling | null> {
    const deps = this.deps();
    const row = await (deps.db.get<OrganizationBilling>(
      `SELECT ob.*, sp.name as plan_name, sp.price_monthly, sp.token_limit, sp.storage_limit_gb
       FROM organization_billing ob
       LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
       WHERE ob.organization_id = ?`,
      [orgId]
    ) as Promise<OrganizationBilling | null>);
    return row || null;
  }

  async getInvoices(orgId: string): Promise<Invoice[]> {
    const deps = this.deps();
    const rows = await (deps.db.all<Invoice>(
      'SELECT * FROM invoices WHERE organization_id = ? ORDER BY created_at DESC',
      [orgId]
    ) as Promise<Invoice[]>);
    return rows || [];
  }

  async getPaymentMethods(orgId: string): Promise<PaymentMethod[]> {
    const deps = this.deps();
    const rows = await (deps.db.all<PaymentMethod>(
      'SELECT * FROM payment_methods WHERE organization_id = ? ORDER BY is_default DESC, created_at DESC',
      [orgId]
    ) as Promise<PaymentMethod[]>);
    return rows || [];
  }

  async getPaymentMethod(paymentMethodId: string): Promise<PaymentMethod | null> {
    const deps = this.deps();
    const row = await (deps.db.get<PaymentMethod>('SELECT * FROM payment_methods WHERE id = ?', [
      paymentMethodId,
    ]) as Promise<PaymentMethod | null>);
    return row || null;
  }

  async getBillingAlerts(orgId: string): Promise<BillingAlert> {
    const deps = this.deps();
    const row = await (deps.db.get<BillingAlert>(
      'SELECT * FROM billing_alerts WHERE organization_id = ?',
      [orgId]
    ) as Promise<BillingAlert | null>);
    if (row) return row;
    return {
      organization_id: orgId,
      token_threshold_80: 1,
      token_threshold_90: 1,
      token_threshold_100: 1,
      storage_threshold_80: 1,
      storage_threshold_90: 1,
      storage_threshold_100: 1,
      auto_upgrade_enabled: 0,
      cost_cap_monthly: null,
      email_notifications: 1,
    };
  }

  async getTaxSettings(orgId: string): Promise<TaxSettings> {
    const deps = this.deps();
    const row = await (deps.db.get<TaxSettings>(
      'SELECT * FROM billing_tax_settings WHERE organization_id = ?',
      [orgId]
    ) as Promise<TaxSettings | null>);
    return row || { organization_id: orgId, tax_exempt: 0 };
  }

  async getSeatPricing(planId: string): Promise<SeatPricing> {
    const deps = this.deps();
    const row = await (deps.db.get<SeatPricing>(
      'SELECT seats_included, seat_price_monthly, max_seats FROM subscription_plans WHERE id = ?',
      [planId]
    ) as Promise<SeatPricing | null>);
    return row || { seats_included: 0, seat_price_monthly: 0, max_seats: -1 };
  }

  async getBillingModel(orgId: string): Promise<BillingModel> {
    const deps = this.deps();
    // RED invoices.amount (billing/seat variant): this used to join
    // organization_seats and select `os.billing_model` — that column never
    // existed on organization_seats (it only has id/organization_id/user_id/
    // seat_type/status/created_at, see migrations 000_initdb_core_tables.sql
    // and 900_prod_missing_tables_hotfix.sql). On Postgres that raised
    // 42703 (undefined_column) on every call; since the only callers
    // (usageService.recordTokenUsage/recordStorageUsage) invoke this inside
    // a try/catch that logs-and-swallows, PAYG/hybrid usage recording was
    // silently skipped for 100% of organizations regardless of their real
    // billing model. The real billing model lives on organization_billing
    // (billing_rail) and subscription_plans (billing_model) — no join to
    // organization_seats is needed for this lookup.
    const row = await (deps.db.get<{
      plan_billing_model: string | null;
      billing_rail: string | null;
    }>(
      `SELECT sp.billing_model as plan_billing_model, ob.billing_rail
             FROM organization_billing ob
             LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.organization_id = ?`,
      [orgId]
    ) as Promise<{
      plan_billing_model: string | null;
      billing_rail: string | null;
    } | null>);
    return {
      billingModel: row?.billing_rail || row?.plan_billing_model || 'subscription',
    };
  }

  async getRevenueStats(): Promise<RevenueStats> {
    const deps = this.deps();
    const stats: RevenueStats = {
      mrr: 0,
      arr: 0,
      activeSubscriptions: 0,
      planDistribution: [],
    };

    const mrrRow = await (deps.db.get<{ mrr: number; active_subscriptions: number }>(
      `SELECT COALESCE(SUM(sp.price_monthly), 0) as mrr, COUNT(ob.id) as active_subscriptions
             FROM organization_billing ob
             JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
             WHERE ob.status = 'active'`,
      []
    ) as Promise<{ mrr: number; active_subscriptions: number } | null>);

    if (mrrRow) {
      stats.mrr = mrrRow.mrr || 0;
      stats.activeSubscriptions = mrrRow.active_subscriptions || 0;
      stats.arr = stats.mrr * 12;
    }

    const distributionRows = await (deps.db.all<{
      name: string;
      price_monthly: number;
      count: number;
    }>(
      `SELECT sp.name, sp.price_monthly, COUNT(ob.id) as count
             FROM subscription_plans sp
             LEFT JOIN organization_billing ob ON sp.id = ob.subscription_plan_id AND ob.status = 'active'
             WHERE sp.is_active = 1
             GROUP BY sp.id`,
      []
    ) as Promise<{ name: string; price_monthly: number; count: number }[]>);

    stats.planDistribution = distributionRows || [];
    return stats;
  }

  async getUserPlans(): Promise<UserLicensePlan[]> {
    const deps = this.deps();
    const rows = await (deps.db.all<UserLicensePlan>(
      'SELECT * FROM user_license_plans WHERE is_active = 1',
      []
    ) as Promise<UserLicensePlan[]>);
    return rows || [];
  }
}
