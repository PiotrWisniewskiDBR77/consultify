import {
  Activity,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  PieChart,
  Server,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { DegradedState } from '../../components/Admin/AdminState';
import { Api } from '../../services/api';
import { EMPTY_VALUE, safeMoney, safeNumber, safePercent } from '../../utils/safeFormat';

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
  periodStart: string;
}

const normalizeRevenueStats = (payload: any): RevenueStats | null => {
  const source = payload?.data ?? payload;
  if (!source || typeof source !== 'object' || source.type === 'not_configured') return null;
  return {
    mrr: safeNumber(source.mrr, Number.NaN),
    arr: safeNumber(source.arr, Number.NaN),
    activeSubscriptions: safeNumber(source.activeSubscriptions, Number.NaN),
    planDistribution: Array.isArray(source.planDistribution)
      ? source.planDistribution.map((plan: any) => ({
          name: plan.name ?? plan.plan ?? plan.plan_name ?? EMPTY_VALUE,
          price_monthly: safeNumber(plan.price_monthly ?? plan.price ?? plan.monthlyPrice, 0),
          count: safeNumber(plan.count ?? plan.subscribers ?? plan.subscriber_count, 0),
        }))
      : [],
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
    periodStart: source.periodStart || '',
  };
};

const normalizeOperationalCosts = (payload: any): { items: any[]; totalCost: number } | null => {
  const source = payload?.data ?? payload;
  if (!source || typeof source !== 'object' || source.type === 'not_configured') return null;
  return {
    items: Array.isArray(source.items)
      ? source.items
      : Array.isArray(source.costs)
        ? source.costs
        : [],
    totalCost: safeNumber(source.totalCost, Number.NaN),
  };
};

export const SuperAdminRevenueView: React.FC = () => {
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [operationalCosts, setOperationalCosts] = useState<{
    items: any[];
    totalCost: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const notices: string[] = [];
    try {
      setNotice(null);
      const [revenue, usage, costs] = await Promise.all([
        Api.get('/billing/admin/revenue').catch((error) => {
          console.warn('[SuperAdminRevenueView] Revenue metrics unavailable', error);
          notices.push('Revenue metrics are temporarily unavailable.');
          return null;
        }),
        Api.get('/billing/admin/usage').catch((error) => {
          console.warn('[SuperAdminRevenueView] Usage metrics unavailable', error);
          notices.push('Usage metrics are temporarily unavailable.');
          return null;
        }),
        Api.get('/billing/admin/operational-costs').catch((error) => {
          console.warn('[SuperAdminRevenueView] Operational costs unavailable', error);
          notices.push('Operational cost metrics are temporarily unavailable.');
          return null;
        }),
      ]);
      setRevenueStats(normalizeRevenueStats(revenue));
      setUsageStats(normalizeUsageStats(usage));
      setOperationalCosts(normalizeOperationalCosts(costs));
      setNotice(notices.length > 0 ? notices.join(' ') : null);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setRevenueStats(null);
      setUsageStats(null);
      setOperationalCosts(null);
      setNotice('Revenue dashboard metrics are temporarily unavailable.');
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const totalPlanSubscriptions =
    revenueStats?.planDistribution.reduce((sum, p) => sum + p.count, 0) || 0;
  const dashboardUnavailable = Boolean(notice) && !revenueStats && !usageStats && !operationalCosts;

  return (
    <div className="space-y-6">
      {dashboardUnavailable ? (
        <DegradedState
          title="Revenue dashboard unavailable"
          description={notice || 'Revenue dashboard metrics are temporarily unavailable.'}
        />
      ) : (
        notice && <DegradedState title="Revenue metrics degraded" description={notice} />
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
          Revenue Dashboard
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Financial metrics and usage analytics
        </p>
      </div>

      {dashboardUnavailable ? null : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* MRR Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <DollarSign className="w-8 h-8 opacity-80" />
                <span className="flex items-center gap-1 text-sm text-emerald-100">
                  <ArrowUpRight className="w-4 h-4" />
                  MRR
                </span>
              </div>
              <p className="text-3xl font-bold mt-4">{formatCurrency(revenueStats?.mrr)}</p>
              <p className="text-emerald-100 text-sm mt-1">Monthly Recurring Revenue</p>
            </div>

            {/* ARR Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <BarChart3 className="w-8 h-8 opacity-80" />
                <span className="flex items-center gap-1 text-sm text-blue-100">
                  <ArrowUpRight className="w-4 h-4" />
                  ARR
                </span>
              </div>
              <p className="text-3xl font-bold mt-4">{formatCurrency(revenueStats?.arr)}</p>
              <p className="text-blue-100 text-sm mt-1">Annual Recurring Revenue</p>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 opacity-80" />
                <span className="text-sm text-primary-100">Active</span>
              </div>
              <p className="text-3xl font-bold mt-4">
                {formatNumber(revenueStats?.activeSubscriptions)}
              </p>
              <p className="text-primary-100 text-sm mt-1">Active Subscriptions</p>
            </div>

            {/* Token Usage */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <Activity className="w-8 h-8 opacity-80" />
                <span className="text-sm text-amber-100">This Month</span>
              </div>
              <p className="text-3xl font-bold mt-4">
                {formatNumber(usageStats?.totalTokensThisMonth)}
              </p>
              <p className="text-amber-100 text-sm mt-1">Tokens Consumed</p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-indigo-600" />
                Plan Distribution
              </h3>

              <div className="space-y-4">
                {revenueStats?.planDistribution.map((plan, idx) => {
                  const percentage =
                    totalPlanSubscriptions > 0
                      ? Math.round((plan.count / totalPlanSubscriptions) * 100)
                      : 0;
                  const colors = [
                    'bg-indigo-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                    'bg-pink-500',
                    'bg-blue-500',
                  ];

                  return (
                    <div key={plan.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">{plan.name}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatNumber(plan.count)} (
                          {safePercent(plan.count, totalPlanSubscriptions)})
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No subscriptions yet
                  </p>
                )}
              </div>
            </div>

            {/* Usage Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-indigo-600" />
                Usage Overview
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatNumber(usageStats?.totalTokensThisMonth)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This month</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Storage Used</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {Number.isFinite(safeNumber(usageStats?.totalStorageGB, Number.NaN))
                      ? `${safeNumber(usageStats?.totalStorageGB).toFixed(2)} GB`
                      : EMPTY_VALUE}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Across all orgs</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active Orgs</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {formatNumber(usageStats?.activeOrganizations)}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">With usage</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg/Org</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {Number.isFinite(safeNumber(usageStats?.activeOrganizations, Number.NaN)) &&
                    safeNumber(usageStats?.activeOrganizations) > 0
                      ? formatNumber(
                          Math.round(
                            safeNumber(usageStats?.totalTokensThisMonth, 0) /
                              safeNumber(usageStats?.activeOrganizations, 1)
                          )
                        )
                      : EMPTY_VALUE}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tokens/org</p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              Revenue by Plan
            </h3>

            <div className="overflow-x-auto">
              <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full"
              >
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium">Price</th>
                    <th className="pb-3 font-medium">Subscribers</th>
                    <th className="pb-3 font-medium text-right">Monthly Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {revenueStats?.planDistribution.map((plan) => (
                    <tr key={plan.name} className="text-gray-900 dark:text-white">
                      <td className="py-3 font-medium">{plan.name}</td>
                      <td className="py-3">{formatCurrency(plan.price_monthly)}/mo</td>
                      <td className="py-3">{formatNumber(plan.count)}</td>
                      <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
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
                      <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        No revenue data available
                      </td>
                    </tr>
                  )}
                </tbody>
                {revenueStats?.planDistribution && revenueStats.planDistribution.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                      <td colSpan={3} className="py-3 font-bold text-gray-900 dark:text-white">
                        Total
                      </td>
                      <td className="py-3 text-right font-bold text-xl text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(revenueStats.mrr)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Operational Costs (Backend) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
              <Server className="w-5 h-5 text-indigo-600" />
              Operational Costs (Backend)
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Estimated costs based on current provider pricing configuration.
            </p>

            <div className="overflow-x-auto">
              <table /* §27-exempt: data-viz/render analityczny read-only (koszty operacyjne + tfoot suma), nie lista encji */ className="w-full"
              >
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Provider</th>
                    <th className="pb-3 font-medium">Model</th>
                    <th className="pb-3 font-medium text-right">Tokens</th>
                    <th className="pb-3 font-medium text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {operationalCosts?.items.map((item: any, idx: number) => (
                    <tr key={idx} className="text-gray-900 dark:text-white">
                      <td className="py-3 font-medium capitalize">{item.provider}</td>
                      <td className="py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {item.model}
                      </td>
                      <td className="py-3 text-right">
                        {formatNumber(item.totalTokens || item.requests)}
                      </td>
                      <td className="py-3 text-right font-semibold text-danger-500">
                        {safeMoney(item.cost, 'USD')}
                      </td>
                    </tr>
                  ))}
                  {!operationalCosts && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        Operational cost metrics unavailable
                      </td>
                    </tr>
                  )}
                  {operationalCosts && operationalCosts.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        No operational cost records yet
                      </td>
                    </tr>
                  )}
                </tbody>
                {operationalCosts &&
                  operationalCosts.items.length > 0 &&
                  Number.isFinite(safeNumber(operationalCosts.totalCost, Number.NaN)) && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                        <td colSpan={3} className="py-3 font-bold text-gray-900 dark:text-white">
                          Total Operational Cost
                        </td>
                        <td className="py-3 text-right font-bold text-xl text-danger-500">
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

export default SuperAdminRevenueView;
