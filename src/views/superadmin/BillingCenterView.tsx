import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  Edit2,
  Package,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Server,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { SubscriptionAnalytics } from '../../components/billing';
import { InfoButton } from '../../components/shared/InfoButton';
import { LoadingState } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { EMPTY_VALUE, safeDate, safeMoney, safeNumber, safePercent } from '../../utils/safeFormat';
import { AdminLLMMultipliers } from '../admin/AdminLLMMultipliers';
import { AdminMarginConfig } from '../admin/AdminMarginConfig';
import { AdminTokenPackages } from '../admin/AdminTokenPackages';

type BillingTab =
  | 'overview'
  | 'plans'
  | 'contracts'
  | 'token-economy'
  | 'transactions'
  | 'analytics';

// ==================== OVERVIEW TAB ====================
interface RevenueStats {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  planDistribution: {
    name: string;
    price_monthly: number;
    count: number;
  }[];
}

interface UsageStats {
  totalTokensThisMonth?: number | null;
  totalStorageGB?: number | null;
  activeOrganizations?: number | null;
}

const normalizeRevenueStats = (payload: any): RevenueStats | null => {
  const source = payload?.data ?? payload;
  if (!source || typeof source !== 'object' || source.type === 'not_configured') return null;
  const planDistribution = Array.isArray(source.planDistribution)
    ? source.planDistribution.map((plan: any) => ({
        name: plan.name ?? plan.plan ?? plan.plan_name ?? EMPTY_VALUE,
        price_monthly: safeNumber(plan.price_monthly ?? plan.price ?? plan.monthlyPrice, 0),
        count: safeNumber(plan.count ?? plan.subscribers ?? plan.subscriber_count, 0),
      }))
    : [];
  return {
    mrr: safeNumber(source.mrr, Number.NaN),
    arr: safeNumber(source.arr, Number.NaN),
    activeSubscriptions: safeNumber(source.activeSubscriptions, Number.NaN),
    planDistribution,
  };
};

const normalizeUsageStats = (payload: any): UsageStats | null => {
  const source = payload?.data ?? payload;
  if (!source || typeof source !== 'object' || source.type === 'not_configured') return null;
  return {
    totalTokensThisMonth: safeNumber(source.totalTokensThisMonth, Number.NaN),
    totalStorageGB:
      source.totalStorageGB === null ? null : safeNumber(source.totalStorageGB, Number.NaN),
    activeOrganizations: safeNumber(source.activeOrganizations, Number.NaN),
  };
};

const normalizeOperationalCosts = (payload: any): { items: any[]; totalCost: number } | null => {
  const source = payload?.data ?? payload;
  if (!source || typeof source !== 'object' || source.type === 'not_configured') return null;
  const items = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.costs)
      ? source.costs
      : [];
  return {
    items,
    totalCost: safeNumber(source.totalCost, Number.NaN),
  };
};

const normalizePlansPayload = (payload: any) => {
  const source = payload?.data ?? payload;
  const plans = Array.isArray(source) ? source : Array.isArray(source?.plans) ? source.plans : [];
  return {
    plans: plans.map((plan: any) => ({
      ...plan,
      price_monthly: safeNumber(plan.price_monthly ?? plan.priceMonthly, 0),
      token_limit: safeNumber(
        plan.token_limit ?? plan.limits?.token_limit ?? plan.limits?.maxTotalTokens,
        Number.NaN
      ),
      storage_limit_gb: safeNumber(
        plan.storage_limit_gb ?? plan.limits?.storage_limit_gb ?? plan.limits?.maxStorageGb,
        Number.NaN
      ),
      token_overage_rate: safeNumber(
        plan.token_overage_rate ?? plan.limits?.token_overage_rate,
        Number.NaN
      ),
      storage_overage_rate: safeNumber(
        plan.storage_overage_rate ?? plan.limits?.storage_overage_rate,
        Number.NaN
      ),
      is_active:
        plan.is_active === undefined
          ? plan.isActive === false
            ? 0
            : 1
          : safeNumber(plan.is_active, 0),
    })),
    notConfigured: source?.type === 'not_configured',
  };
};

const parseFeatureList = (features: any): string[] => {
  if (Array.isArray(features)) return features.map(String).filter(Boolean);
  if (typeof features !== 'string' || !features.trim()) return [];
  try {
    const parsed = JSON.parse(features);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([feature]) => feature);
    }
  } catch {
    return features
      .split('\n')
      .map((feature) => feature.trim())
      .filter(Boolean);
  }
  return [];
};

const buildOrganizationPlanPayload = (formData: any) => ({
  name: String(formData.name || '').trim(),
  priceMonthly: safeNumber(formData.price_monthly, 0),
  priceYearly: safeNumber(formData.price_yearly, 0),
  currency: formData.currency || 'USD',
  features: parseFeatureList(formData.features),
  limits: {
    token_limit: safeNumber(formData.token_limit, 0),
    maxTotalTokens: safeNumber(formData.token_limit, 0),
    storage_limit_gb: safeNumber(formData.storage_limit_gb, 0),
    maxStorageGb: safeNumber(formData.storage_limit_gb, 0),
    token_overage_rate: safeNumber(formData.token_overage_rate, 0),
    storage_overage_rate: safeNumber(formData.storage_overage_rate, 0),
    stripe_price_id: formData.stripe_price_id || null,
  },
  isActive: formData.is_active === undefined ? true : Boolean(formData.is_active),
});

const formatCompactNumber = (value: unknown) => {
  const parsed = safeNumber(value, Number.NaN);
  if (!Number.isFinite(parsed)) return EMPTY_VALUE;
  return parsed.toLocaleString();
};

const OverviewTab: React.FC = () => {
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [operationalCosts, setOperationalCosts] = useState<{
    items: any[];
    totalCost: number;
  } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setWarning(null);
    const warnings: string[] = [];
    try {
      const [revenue, usage, costs] = await Promise.all([
        Api.get('/billing/admin/revenue').catch((error) => {
          console.warn('[BillingCenterView] Revenue metrics unavailable', error);
          warnings.push('Revenue metrics are temporarily unavailable.');
          return null;
        }),
        Api.get('/billing/admin/usage').catch((error) => {
          console.warn('[BillingCenterView] Usage metrics unavailable', error);
          warnings.push('Usage metrics are temporarily unavailable.');
          return null;
        }),
        Api.get('/billing/admin/operational-costs').catch((error) => {
          console.warn('[BillingCenterView] Operational costs unavailable', error);
          warnings.push('Operational cost metrics are temporarily unavailable.');
          return null;
        }),
      ]);
      setRevenueStats(normalizeRevenueStats(revenue));
      setUsageStats(normalizeUsageStats(usage));
      setOperationalCosts(normalizeOperationalCosts(costs));
      setWarning(warnings.length > 0 ? warnings.join(' ') : null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setRevenueStats(null);
      setUsageStats(null);
      setOperationalCosts(null);
      setWarning('Billing metrics are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: unknown) => safeMoney(amount, 'USD', { fallback: EMPTY_VALUE });

  const formatNumber = (num: unknown) => {
    const value = safeNumber(num, Number.NaN);
    if (!Number.isFinite(value)) return EMPTY_VALUE;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  const totalPlanSubscriptions =
    revenueStats?.planDistribution.reduce((sum, p) => sum + p.count, 0) || 0;
  const grossProfit =
    Number.isFinite(safeNumber(revenueStats?.mrr, Number.NaN)) &&
    Number.isFinite(safeNumber(operationalCosts?.totalCost, Number.NaN))
      ? safeNumber(revenueStats?.mrr) - safeNumber(operationalCosts?.totalCost)
      : Number.NaN;
  const overviewUnavailable = Boolean(warning) && !revenueStats && !usageStats && !operationalCosts;

  return (
    <div className="space-y-6">
      {overviewUnavailable ? (
        <DegradedState title="Billing overview unavailable" description={warning ?? undefined} />
      ) : (
        warning && <DegradedState title="Billing metrics degraded" description={warning} />
      )}

      {overviewUnavailable ? null : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <DollarSign className="w-7 h-7 opacity-80" />
                <span className="flex items-center gap-1 text-xs text-emerald-100">
                  <ArrowUpRight className="w-3 h-3" /> MRR
                </span>
              </div>
              <p className="text-3xl font-bold mt-3">{formatCurrency(revenueStats?.mrr)}</p>
              <p className="text-emerald-100 text-xs mt-1">Monthly Recurring Revenue</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <BarChart3 className="w-7 h-7 opacity-80" />
                <span className="flex items-center gap-1 text-xs text-blue-100">
                  <ArrowUpRight className="w-3 h-3" /> ARR
                </span>
              </div>
              <p className="text-3xl font-bold mt-3">{formatCurrency(revenueStats?.arr)}</p>
              <p className="text-blue-100 text-xs mt-1">Annual Recurring Revenue</p>
            </div>

            <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <Users className="w-7 h-7 opacity-80" />
                <span className="text-xs text-primary-100">Active</span>
              </div>
              <p className="text-3xl font-bold mt-3">
                {formatNumber(revenueStats?.activeSubscriptions)}
              </p>
              <p className="text-primary-100 text-xs mt-1">Active Subscriptions</p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <Activity className="w-7 h-7 opacity-80" />
                <span className="text-xs text-amber-100">This Month</span>
              </div>
              <p className="text-3xl font-bold mt-3">
                {formatNumber(usageStats?.totalTokensThisMonth)}
              </p>
              <p className="text-amber-100 text-xs mt-1">Tokens Consumed</p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Distribution */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-c-border-subtle">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                <PieChart className="w-5 h-5 text-blue-400" />
                Plan Distribution
              </h3>

              <div className="space-y-4">
                {revenueStats?.planDistribution.map((plan, idx) => {
                  const percentage =
                    totalPlanSubscriptions > 0
                      ? Math.round((plan.count / totalPlanSubscriptions) * 100)
                      : 0;
                  const colors = [
                    'bg-blue-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-pink-500',
                    'bg-blue-500',
                  ];

                  return (
                    <div key={plan.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-900 dark:text-slate-200">{plan.name}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {formatNumber(plan.count)} (
                          {safePercent(plan.count, totalPlanSubscriptions)})
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[idx % colors.length]} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {(!revenueStats?.planDistribution ||
                  revenueStats.planDistribution.length === 0) && (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                    No subscriptions yet
                  </p>
                )}
              </div>
            </div>

            {/* Usage Overview */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-c-border-subtle">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                <Activity className="w-5 h-5 text-blue-400" />
                Usage Overview
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Tokens</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatNumber(usageStats?.totalTokensThisMonth)}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">This month</p>
                </div>

                <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Storage Used</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {Number.isFinite(safeNumber(usageStats?.totalStorageGB, Number.NaN))
                      ? `${safeNumber(usageStats?.totalStorageGB).toFixed(2)} GB`
                      : EMPTY_VALUE}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                    Across all orgs
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active Orgs</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatNumber(usageStats?.activeOrganizations)}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">With usage</p>
                </div>

                <div className="bg-slate-50 dark:bg-navy-950 rounded-lg p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Gross Profit</p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      Number.isFinite(grossProfit)
                        ? grossProfit >= 0
                          ? 'text-emerald-400'
                          : 'text-danger-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {formatCurrency(grossProfit)}
                  </p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">MRR - Costs</p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue by Plan Table */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-c-border-subtle">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Revenue by Plan
            </h3>

            <div className="overflow-x-auto">
              <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-c-border-subtle">
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Price</th>
                    <th className="pb-3 font-medium">Subscribers</th>
                    <th className="pb-3 font-medium text-right">Monthly Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {revenueStats?.planDistribution.map((plan) => (
                    <tr key={plan.name} className="text-slate-900 dark:text-white">
                      <td className="py-3 font-medium">{plan.name}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-500">
                        {formatCurrency(plan.price_monthly)}/mo
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-500">
                        {formatNumber(plan.count)}
                      </td>
                      <td className="py-3 text-right font-semibold text-emerald-400">
                        {formatCurrency(
                          safeNumber(plan.price_monthly, Number.NaN) *
                            safeNumber(plan.count, Number.NaN)
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!revenueStats?.planDistribution ||
                    revenueStats.planDistribution.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No revenue data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Costs */}
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-c-border-subtle">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <Server className="w-5 h-5 text-blue-400" />
              Operational Costs (Backend)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Estimated costs based on current provider pricing.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-c-border-subtle">
                    <th className="pb-3 font-medium">Provider</th>
                    <th className="pb-3 font-medium">Model</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {operationalCosts?.items.map((item: any, idx: number) => (
                    <tr key={idx} className="text-slate-900 dark:text-white">
                      <td className="py-3 font-medium capitalize text-slate-900 dark:text-white">
                        {item.provider}
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {item.model}
                      </td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-500">
                        {formatNumber(item.totalTokens)}
                      </td>
                      <td className="py-3 text-right font-semibold text-danger-400">
                        {safeMoney(item.cost, 'USD')}
                      </td>
                    </tr>
                  ))}
                  {!operationalCosts && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        Operational cost metrics unavailable
                      </td>
                    </tr>
                  )}
                  {operationalCosts && operationalCosts.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No operational cost records yet
                      </td>
                    </tr>
                  )}
                </tbody>
                {operationalCosts &&
                  operationalCosts.items.length > 0 &&
                  Number.isFinite(safeNumber(operationalCosts.totalCost, Number.NaN)) && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-c-border-subtle">
                        <td colSpan={3} className="py-3 font-bold text-slate-900 dark:text-white">
                          Total Operational Cost
                        </td>
                        <td className="py-3 text-right font-bold text-lg text-danger-400">
                          {safeMoney(operationalCosts.totalCost, 'USD')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==================== PLANS TAB ====================
interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  token_limit: number;
  storage_limit_gb: number;
  token_overage_rate: number;
  storage_overage_rate: number;
  stripe_price_id: string | null;
  features?: string;
  is_active: number;
  created_at: string;
}

interface UserLicensePlan {
  id: string;
  name: string;
  price_monthly: number;
  features?: string;
  is_active: number;
  created_at: string;
}

const PlansTab: React.FC = () => {
  const [planType, setPlanType] = useState<'organization' | 'user'>('organization');
  const [orgPlans, setOrgPlans] = useState<SubscriptionPlan[]>([]);
  const [userPlans, setUserPlans] = useState<UserLicensePlan[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [planLoadErrors, setPlanLoadErrors] = useState<{
    organization: string | null;
    user: string | null;
  }>({ organization: null, user: null });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [orgFormData, setOrgFormData] = useState<Partial<SubscriptionPlan>>({});
  const [userFormData, setUserFormData] = useState<Partial<UserLicensePlan>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    setNotice(null);
    setPlanLoadErrors({ organization: null, user: null });
    const notices: string[] = [];
    const nextErrors = { organization: null as string | null, user: null as string | null };
    try {
      const [orgData, userData] = await Promise.all([
        Api.get('/billing/admin/plans').catch((error) => {
          console.warn('[BillingCenterView] Organization plans unavailable', error);
          nextErrors.organization = 'Organization plans are temporarily unavailable.';
          notices.push(nextErrors.organization);
          return null;
        }),
        Api.get('/billing/admin/user-plans').catch((error) => {
          console.warn('[BillingCenterView] User plans unavailable', error);
          nextErrors.user = 'User license plans are temporarily unavailable.';
          notices.push(nextErrors.user);
          return null;
        }),
      ]);
      const orgPayload = normalizePlansPayload(orgData);
      const userPayload = normalizePlansPayload(userData);
      setOrgPlans(orgPayload.plans);
      setUserPlans(userPayload.plans);
      if (orgPayload.notConfigured || userPayload.notConfigured) {
        notices.push(
          'Some billing plan surfaces are not configured yet and are shown in degraded mode.'
        );
      }
      setNotice(notices.length > 0 ? notices.join(' ') : null);
      setPlanLoadErrors(nextErrors);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      setOrgPlans([]);
      setUserPlans([]);
      setNotice('Billing plans are temporarily unavailable.');
      setPlanLoadErrors({
        organization: 'Organization plans are temporarily unavailable.',
        user: 'User license plans are temporarily unavailable.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const activeForm = planType === 'organization' ? orgFormData : userFormData;
    if (!String(activeForm.name || '').trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (
      !Number.isFinite(safeNumber(activeForm.price_monthly, Number.NaN)) ||
      safeNumber(activeForm.price_monthly) < 0
    ) {
      toast.error('Plan price must be a non-negative number');
      return;
    }
    setSaving(true);
    try {
      if (planType === 'organization') {
        const endpoint = '/billing/admin/plans';
        const payload = buildOrganizationPlanPayload(orgFormData);
        if (editingId) {
          await Api.put(`${endpoint}/${editingId}`, payload);
        } else {
          await Api.post(endpoint, payload);
        }
      } else {
        toast.error('User license plans are not configured for this environment');
        return;
      }
      await fetchPlans();
      resetForm();
      toast.success('Plan saved successfully');
    } catch (error) {
      console.error('Failed to save plan:', error);
      toast.error('Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (planType === 'user') {
      toast.error('User license plans are not configured for this environment');
      return;
    }
    if (!confirm('Are you sure you want to deactivate this plan?')) return;
    try {
      const endpoint =
        planType === 'organization'
          ? `/billing/admin/plans/${id}`
          : `/billing/admin/user-plans/${id}`;
      await Api.delete(endpoint);
      await fetchPlans();
      toast.success('Plan deactivated');
    } catch (error) {
      console.error('Failed to delete plan:', error);
      toast.error('Failed to delete plan');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setShowNewForm(false);
    setOrgFormData({});
    setUserFormData({});
  };

  const handleNewPlan = () => {
    setShowNewForm(true);
    setEditingId(null);
    if (planType === 'organization') {
      setOrgFormData({
        name: '',
        price_monthly: 0,
        token_limit: 100000,
        storage_limit_gb: 5,
        token_overage_rate: 0.015,
        storage_overage_rate: 0.1,
        features: '{}',
      });
    } else {
      setUserFormData({
        name: '',
        price_monthly: 0,
        features: '{}',
      });
    }
  };

  const handleEdit = (plan: any) => {
    setEditingId(plan.id);
    setShowNewForm(false);
    if (planType === 'organization') {
      setOrgFormData({ ...plan });
    } else {
      setUserFormData({ ...plan });
    }
  };

  const plans = planType === 'organization' ? orgPlans : userPlans;
  const activePlanLoadError =
    planType === 'organization' ? planLoadErrors.organization : planLoadErrors.user;

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {notice}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPlanType('organization');
              resetForm();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              planType === 'organization'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700'
            }`}
          >
            <Building2 size={16} />
            Organization Plans
          </button>
          <button
            onClick={() => {
              setPlanType('user');
              resetForm();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              planType === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700'
            }`}
          >
            <Users size={16} />
            User Licenses
          </button>
        </div>
        <button
          onClick={handleNewPlan}
          disabled={Boolean(activePlanLoadError) || planType === 'user'}
          title={
            activePlanLoadError ||
            (planType === 'user'
              ? 'User license plan creation is not configured for this environment'
              : undefined)
          }
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New {planType === 'organization' ? 'Plan' : 'License'}
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activePlanLoadError ? (
          <div className="col-span-full">
            <DegradedState
              title={
                planType === 'organization'
                  ? 'Organization plans unavailable'
                  : 'User license plans unavailable'
              }
              description={activePlanLoadError}
            />
          </div>
        ) : (
          <>
            {/* New Form Card */}
            {showNewForm && (
              <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border-2 border-dashed border-blue-500/50">
                <PlanForm
                  type={planType}
                  formData={planType === 'organization' ? orgFormData : userFormData}
                  setFormData={planType === 'organization' ? setOrgFormData : setUserFormData}
                  onSave={handleSave}
                  onCancel={resetForm}
                  saving={saving}
                  isNew
                />
              </div>
            )}

            {/* Existing Plans */}
            {plans.map((plan: any) => (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-navy-900 rounded-xl p-6 border transition-all ${
                  plan.is_active
                    ? 'border-slate-200 dark:border-c-border-subtle hover:border-slate-300 dark:hover:border-c-border'
                    : 'border-slate-200 dark:border-c-border-subtle opacity-60'
                }`}
              >
                {editingId === plan.id ? (
                  <PlanForm
                    type={planType}
                    formData={planType === 'organization' ? orgFormData : userFormData}
                    setFormData={planType === 'organization' ? setOrgFormData : setUserFormData}
                    onSave={handleSave}
                    onCancel={resetForm}
                    saving={saving}
                  />
                ) : (
                  <PlanCard
                    plan={plan}
                    type={planType}
                    onEdit={() => handleEdit(plan)}
                    onDelete={() => handleDelete(plan.id)}
                  />
                )}
              </div>
            ))}

            {plans.length === 0 && !showNewForm && !loading && (
              <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                No {planType === 'organization' ? 'organization plans' : 'user licenses'} found.
                Create one to get started.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const PlanForm: React.FC<{
  type: 'organization' | 'user';
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}> = ({ type, formData, setFormData, onSave, onCancel, saving, isNew }) => (
  <div className="space-y-4">
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
      {isNew ? `New ${type === 'organization' ? 'Plan' : 'License'}` : 'Edit'}
    </h3>

    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
        Name
      </label>
      <input
        type="text"
        value={formData.name || ''}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none"
      />
    </div>

    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
        Price ($/month)
      </label>
      <input
        type="number"
        value={
          Number.isFinite(safeNumber(formData.price_monthly, Number.NaN))
            ? formData.price_monthly
            : ''
        }
        onChange={(e) =>
          setFormData({
            ...formData,
            price_monthly: e.target.value === '' ? '' : Number(e.target.value),
          })
        }
        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none"
      />
    </div>

    {type === 'organization' && (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
              Tokens
            </label>
            <input
              type="number"
              value={
                Number.isFinite(safeNumber(formData.token_limit, Number.NaN))
                  ? formData.token_limit
                  : ''
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  token_limit: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
              Storage (GB)
            </label>
            <input
              type="number"
              value={
                Number.isFinite(safeNumber(formData.storage_limit_gb, Number.NaN))
                  ? formData.storage_limit_gb
                  : ''
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  storage_limit_gb: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
            Stripe Price ID
          </label>
          <input
            type="text"
            value={formData.stripe_price_id || ''}
            onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono focus:border-blue-500 outline-none"
            placeholder="price_..."
          />
        </div>
      </>
    )}

    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1 block">
        Features (JSON)
      </label>
      <textarea
        value={
          typeof formData.features === 'string'
            ? formData.features
            : JSON.stringify(formData.features || {}, null, 2)
        }
        onChange={(e) => setFormData({ ...formData, features: e.target.value })}
        className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-c-border-subtle rounded-lg px-3 py-2 text-slate-900 dark:text-white text-xs font-mono h-20 focus:border-blue-500 outline-none resize-none"
      />
    </div>

    <div className="flex gap-2 pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Save className="w-4 h-4" /> Save
          </>
        )}
      </button>
      <button
        onClick={onCancel}
        className="px-4 py-2 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/20 rounded-lg text-sm"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const PlanCard: React.FC<{
  plan: any;
  type: 'organization' | 'user';
  onEdit: () => void;
  onDelete: () => void;
}> = ({ plan, type, onEdit, onDelete }) => (
  <>
    <div className="absolute top-4 right-4">
      <span
        className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
          plan.is_active
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        {plan.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>

    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-3xl font-bold text-blue-400">
        {safeMoney(plan.price_monthly, 'USD')}
      </span>
      <span className="text-slate-500 dark:text-slate-400">/mo</span>
    </div>

    {type === 'organization' && (
      <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-500">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          {formatCompactNumber(plan.token_limit)} tokens
        </div>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          {Number.isFinite(safeNumber(plan.storage_limit_gb, Number.NaN))
            ? `${safeNumber(plan.storage_limit_gb)} GB storage`
            : `${EMPTY_VALUE} storage`}
        </div>
      </div>
    )}

    <div className="mt-4 pt-4 border-t border-c-border-subtle">
      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono overflow-hidden h-10">
        {typeof plan.features === 'string'
          ? plan.features.substring(0, 80)
          : JSON.stringify(plan.features || {})}
      </div>
    </div>

    <div className="mt-4 flex gap-2">
      <button
        onClick={onEdit}
        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-slate-100 dark:bg-navy-950/20 text-slate-900 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-800/40 transition-colors"
      >
        <Edit2 className="w-4 h-4" /> Edit
      </button>
      <button
        onClick={onDelete}
        className="px-3 py-2 text-sm text-danger-400 rounded-lg hover:bg-danger-500/10 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </>
);

// ==================== TOKEN ECONOMY TAB ====================
const TokenEconomyTab: React.FC = () => {
  const [stats, setStats] = useState({
    activeModels: 0,
    activePackages: 0,
    platformMargin: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const errors: string[] = [];
      const [providers, packages, margins, balance] = await Promise.all([
        Api.getLLMProviders().catch(() => {
          errors.push('LLM providers are unavailable.');
          return null;
        }),
        Api.getTokenPackages().catch(() => {
          errors.push('Token packages are unavailable.');
          return null;
        }),
        Api.getBillingMargins().catch(() => {
          errors.push('Billing margins are unavailable.');
          return null;
        }),
        Api.getTokenBalance().catch(() => {
          errors.push('Token balance is unavailable.');
          return null;
        }),
      ]);

      if (errors.length > 0) {
        setLoadError(errors.join(' '));
      }

      const providerList = Array.isArray(providers) ? providers : [];
      const packageList = Array.isArray(packages) ? packages : [];
      const marginList = Array.isArray(margins) ? margins : [];
      const platformMargin = marginList.find((m: any) => m.source_type === 'platform');

      setStats({
        activeModels: providerList.filter((p: any) => p.is_active).length,
        activePackages: packageList.filter((p: any) => p.is_active).length,
        platformMargin: platformMargin ? platformMargin.margin_percent : 0,
        balance: Number.isFinite(safeNumber(balance, Number.NaN)) ? safeNumber(balance) : 0,
      });
    } catch (error) {
      console.error('Failed to load billing stats', error);
      setLoadError('Token economy metrics are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-600 dark:text-slate-500" />
        </div>
      ) : loadError ? (
        <DegradedState title="Token economy metrics unavailable" description={loadError} />
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="text-slate-600 dark:text-slate-500 text-xs font-medium uppercase">
                  Active AI Models
                </span>
                <Zap size={18} className="text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.activeModels}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="text-slate-600 dark:text-slate-500 text-xs font-medium uppercase">
                  Active Packages
                </span>
                <Package size={18} className="text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.activePackages}
              </div>
            </div>
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="text-slate-600 dark:text-slate-500 text-xs font-medium uppercase">
                  Platform Margin
                </span>
                <TrendingUp size={18} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">{stats.platformMargin}%</div>
            </div>
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-c-border-subtle rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <span className="text-slate-600 dark:text-slate-500 text-xs font-medium uppercase">
                  System Balance
                </span>
                <DollarSign size={18} className="text-primary-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {(stats.balance / 1000).toFixed(1)}k
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pricing & Margins Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminLLMMultipliers />
        </div>
        <div className="lg:col-span-1">
          <AdminMarginConfig />
        </div>
      </div>

      {/* Token Packages */}
      <AdminTokenPackages />
    </div>
  );
};

// ==================== TRANSACTIONS TAB ====================
const TransactionsTab: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'purchase' | 'usage' | 'refund'>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    setNotice(null);
    setLoadError(null);
    try {
      const data = await Api.get('/billing/admin/transactions?limit=100');
      const payload = data?.data ?? data;
      setTransactions(Array.isArray(payload?.transactions) ? payload.transactions : []);
      if (payload?.type === 'not_configured') {
        setNotice('Billing transactions are not configured yet for this environment.');
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      setTransactions([]);
      setLoadError('Billing transactions are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions =
    filter === 'all' ? transactions : transactions.filter((t) => t.type === filter);

  const formatNumber = (num: unknown) => {
    const value = safeNumber(num, Number.NaN);
    if (!Number.isFinite(value)) return EMPTY_VALUE;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'usage':
        return 'bg-blue-500/20 text-blue-400';
      case 'refund':
        return 'bg-danger-500/20 text-danger-400';
      case 'bonus':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {notice}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'purchase', 'usage', 'refund'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              disabled={!!loadError}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-c-border-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-950 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-4 px-6 text-left font-medium">Date</th>
              <th className="py-4 px-6 text-left font-medium">Organization</th>
              <th className="py-4 px-6 text-left font-medium">Type</th>
              <th className="py-4 px-6 text-left font-medium">Description</th>
              <th className="py-4 px-6 text-right font-medium">Amount</th>
              <th className="py-4 px-6 text-right font-medium">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading transactions...
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="p-6">
                  <DegradedState title="Billing transactions unavailable" description={loadError} />
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, idx) => (
                <tr
                  key={tx.id || idx}
                  className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                >
                  <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-sm">
                    {safeDate(tx.created_at)}
                  </td>
                  <td className="py-4 px-6 text-slate-900 dark:text-white font-medium text-sm">
                    {tx.organization_name || tx.organization_id?.slice(0, 8) || EMPTY_VALUE}
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getTypeColor(tx.type)}`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600 dark:text-slate-500 text-sm max-w-xs truncate">
                    {tx.description || EMPTY_VALUE}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {Number.isFinite(safeNumber(tx.amount_usd, Number.NaN)) ? (
                      <span
                        className={
                          safeNumber(tx.amount_usd) > 0 ? 'text-emerald-400' : 'text-danger-400'
                        }
                      >
                        {safeNumber(tx.amount_usd) > 0 ? '+' : ''}
                        {safeMoney(tx.amount_usd, 'USD')}
                      </span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400">{EMPTY_VALUE}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-sm">
                    <span
                      className={safeNumber(tx.tokens) > 0 ? 'text-emerald-400' : 'text-danger-400'}
                    >
                      {safeNumber(tx.tokens) > 0 ? '+' : ''}
                      {formatNumber(tx.tokens)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ContractsTab: React.FC = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    organizationId: '',
    subscriptionPlanId: '',
    billingRail: 'manual_invoice',
    contractStatus: 'active',
    renewalAt: '',
    accessExpiresAt: '',
    externalInvoiceRef: '',
    notes: '',
    reason: '',
    limitsOverride: {
      maxProjects: '',
      maxUsers: '',
      maxAICallsPerDay: '',
      maxInitiatives: '',
      maxStorageMb: '',
      maxTotalTokens: '',
    },
  });

  const loadContracts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getManagedContracts();
      setContracts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setContracts([]);
      setLoadError(error?.message || 'Managed contracts are temporarily unavailable.');
      toast.error(error?.message || 'Failed to load managed contracts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleSubmit = async () => {
    if (!form.organizationId || !form.subscriptionPlanId || !form.reason) {
      toast.error('Organization, plan, and reason are required');
      return;
    }
    setSaving(true);
    try {
      const limitsOverride = Object.fromEntries(
        Object.entries(form.limitsOverride).filter(([, value]) => String(value).trim() !== '')
      );
      await Api.upsertManualContract({
        ...form,
        renewalAt: form.renewalAt || null,
        accessExpiresAt: form.accessExpiresAt || null,
        limitsOverride: Object.keys(limitsOverride).length > 0 ? limitsOverride : null,
      });
      toast.success('Manual contract saved');
      setForm((prev) => ({
        ...prev,
        externalInvoiceRef: '',
        notes: '',
        reason: '',
        limitsOverride: {
          maxProjects: '',
          maxUsers: '',
          maxAICallsPerDay: '',
          maxInitiatives: '',
          maxStorageMb: '',
          maxTotalTokens: '',
        },
      }));
      await loadContracts();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save contract');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-c-border-subtle">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Manual Contracts
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Grant paid access for invoice-based customers without Stripe auto-charging.
            </p>
          </div>
          <button
            onClick={loadContracts}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle text-sm text-slate-700 dark:text-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={form.organizationId}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, organizationId: e.target.value }))}
            placeholder="Organization ID"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <input
            value={form.subscriptionPlanId}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, subscriptionPlanId: e.target.value }))}
            placeholder="Plan ID"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <select
            value={form.billingRail}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, billingRail: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          >
            <option value="manual_invoice">manual_invoice</option>
            <option value="hybrid_usage_invoice">hybrid_usage_invoice</option>
          </select>
          <select
            value={form.contractStatus}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, contractStatus: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          >
            <option value="active">active</option>
            <option value="renewal_due">renewal_due</option>
            <option value="grace">grace</option>
            <option value="suspended">suspended</option>
          </select>
          <input
            type="date"
            value={form.renewalAt}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, renewalAt: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <input
            type="date"
            value={form.accessExpiresAt}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, accessExpiresAt: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <input
            value={form.externalInvoiceRef}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, externalInvoiceRef: e.target.value }))}
            placeholder="External invoice reference"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <input
            value={form.reason}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Reason / change summary"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
          />
          <textarea
            value={form.notes}
            disabled={!!loadError}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Internal notes"
            className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent min-h-[88px]"
          />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 dark:border-c-border-subtle p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Manual limit overrides
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Leave empty to inherit the selected plan package. Fill any field to pin a custom limit
              for this invoice-managed customer.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['maxProjects', 'Projects'],
              ['maxUsers', 'Users'],
              ['maxAICallsPerDay', 'AI calls / day'],
              ['maxInitiatives', 'Initiatives'],
              ['maxStorageMb', 'Storage (MB)'],
              ['maxTotalTokens', 'Total tokens'],
            ].map(([key, label]) => (
              <input
                key={key}
                type="number"
                min="0"
                value={(form.limitsOverride as any)[key]}
                disabled={!!loadError}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    limitsOverride: {
                      ...prev.limitsOverride,
                      [key]: e.target.value,
                    },
                  }))
                }
                placeholder={label}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-c-border-subtle bg-transparent"
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving || !!loadError}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Contract'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-c-border-subtle overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-c-border-subtle flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Managed accounts</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {contracts.length} orgs
          </span>
        </div>
        {loading ? (
          <div className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
            Loading contracts...
          </div>
        ) : loadError ? (
          <div className="p-6">
            <DegradedState title="Managed contracts unavailable" description={loadError} />
          </div>
        ) : contracts.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
            No manual contracts configured yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/5">
            {contracts.map((contract) => (
              <div
                key={`${contract.organization_id}-${contract.subscription_plan_id}`}
                className="px-6 py-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {contract.organization_name || contract.organization_id}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {contract.plan_name || contract.subscription_plan_id} • {contract.billing_rail}{' '}
                    • {contract.contract_status}
                  </p>
                  {(contract.renewal_at || contract.access_expires_at) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Renewal: {contract.renewal_at || '-'} | Access until:{' '}
                      {contract.access_expires_at || '-'}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Limits: {contract.max_projects ?? '-'} projects, {contract.max_users ?? '-'}{' '}
                    users, {contract.max_ai_calls_per_day ?? '-'} AI/day,{' '}
                    {contract.max_total_tokens ?? '-'} tokens, {contract.max_storage_mb ?? '-'} MB
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <p>{contract.external_invoice_ref || 'No invoice ref'}</p>
                  <p className="mt-1">{safeDate(contract.updated_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export const BillingCenterView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BillingTab>('overview');

  const tabs: { id: BillingTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp size={18} /> },
    { id: 'plans', label: 'Subscription Plans', icon: <Package size={18} /> },
    { id: 'contracts', label: 'Manual Contracts', icon: <Building2 size={18} /> },
    { id: 'token-economy', label: 'Token Economy', icon: <Coins size={18} /> },
    { id: 'transactions', label: 'Transactions', icon: <Receipt size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50 dark:bg-navy-950 relative">
      <InfoButton cardId="superadmin-billing" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <CreditCard size={20} className="text-slate-900 dark:text-white" />
            </div>
            Billing Center
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage subscriptions, token pricing, and revenue analytics
          </p>
        </div>
        <InfoButton
          cardId="superadmin-billing"
          position="header-inline"
          size="md"
          showLabel
          label="Help"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 bg-white dark:bg-navy-900/50 p-1 rounded-xl w-fit border border-slate-200 dark:border-c-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/20'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'contracts' && <ContractsTab />}
      {activeTab === 'token-economy' && <TokenEconomyTab />}
      {activeTab === 'transactions' && <TransactionsTab />}
      {activeTab === 'analytics' && <SubscriptionAnalytics />}
    </div>
  );
};

export default BillingCenterView;
