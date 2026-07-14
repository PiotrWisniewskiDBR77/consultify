/**
 * Subscription Analytics Dashboard
 * MRR/ARR tracking, churn analysis, LTV calculations, cohort analysis
 */

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { isBillingSelfServeEnabled } from '../../utils/billingSelfServeFlag';

interface MRRData {
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

interface MRRTrend {
  period: { days: number; granularity: string };
  data: Array<{
    date: string;
    mrr: number;
    new_mrr: number;
    expansion_mrr: number;
    churn_mrr: number;
    growth: number;
  }>;
  summary: {
    startMRR: number;
    endMRR: number;
    totalGrowth: string;
    avgGrowth: string;
  };
}

interface ChurnData {
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

interface LTVData {
  ltv: number;
  arpa: number;
  avgLifespanMonths: number;
  avgRevenuePerCustomer: number;
  monthlyChurnRate: string;
  ltvToCac: string | null;
}

interface CohortData {
  period: { cohortMonths: number; retentionMonths: number };
  cohorts: Array<{
    cohort: string;
    startingCount: number;
    currentActive: number;
    retentionRate: string;
  }>;
}

interface ExpansionData {
  period: { months: number };
  data: Array<{
    month: string;
    expansion_mrr: number;
    contraction_mrr: number;
    netExpansion: number;
  }>;
  totals: {
    totalExpansion: number;
    totalContraction: number;
    netTotal: number;
  };
}

export const SubscriptionAnalytics: React.FC = () => {
  const { t } = useTranslation();
  // Decision D8: revenue analytics (MRR/churn/cohort/expansion) are not built
  // out yet — the underlying endpoints return 503/404. Gate the whole surface
  // behind the billing self-serve flag (default OFF) so we never fire dead
  // requests or render fabricated metrics. Show an honest "not available yet"
  // empty state instead.
  const analyticsEnabled = isBillingSelfServeEnabled();
  const [mrr, setMRR] = useState<MRRData | null>(null);
  const [mrrTrend, setMRRTrend] = useState<MRRTrend | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [ltv, setLTV] = useState<LTVData | null>(null);
  const [cohorts, setCohorts] = useState<CohortData | null>(null);
  const [expansion, setExpansion] = useState<ExpansionData | null>(null);
  const [loading, setLoading] = useState(analyticsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    if (!analyticsEnabled) return;
    fetchAllData();
  }, [selectedPeriod, analyticsEnabled]);

  if (!analyticsEnabled) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center dark:border-navy-700 dark:bg-white/5">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600 dark:bg-crimson-500/10 dark:text-crimson-400">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('billing.analytics.unavailableTitle', 'Revenue analytics coming soon')}
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {t(
            'billing.analytics.unavailableBody',
            'MRR, churn, cohort and expansion analytics are not available yet. They will appear here once self-serve billing is enabled.'
          )}
        </p>
      </div>
    );
  }

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mrrRes, trendRes, churnRes, ltvRes, cohortsRes, expansionRes] = await Promise.all([
        Api.get('/revenue/analytics/mrr'),
        Api.get(`/revenue/analytics/mrr/trend?days=${selectedPeriod}`),
        Api.get('/revenue/analytics/churn'),
        Api.get('/revenue/analytics/ltv'),
        Api.get('/revenue/analytics/cohorts'),
        Api.get('/revenue/analytics/expansion'),
      ]);

      setMRR(mrrRes.mrr);
      setMRRTrend(trendRes.trend);
      setChurn(churnRes.churn);
      setLTV(ltvRes.ltv);
      setCohorts(cohortsRes.cohorts);
      setExpansion(expansionRes.expansion);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, decimals = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount / 100);
  };

  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400">
        <p>{error}</p>
        <button onClick={fetchAllData} className="mt-2 text-sm underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Subscription Analytics
        </h2>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-500" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={fetchAllData}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">MRR</span>
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <DollarSign className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(mrr?.totalMRR || 0)}
          </p>
          {mrrTrend?.summary && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                parseFloat(mrrTrend.summary.totalGrowth) >= 0 ? 'text-green-600' : 'text-danger-600'
              }`}
            >
              {parseFloat(mrrTrend.summary.totalGrowth) >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {formatPercent(mrrTrend.summary.totalGrowth)}
              <span className="text-slate-500 dark:text-slate-400 ml-1">vs prev period</span>
            </div>
          )}
        </div>

        {/* ARR Card */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">ARR</span>
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(mrr?.arr || 0)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {mrr?.activeSubscriptions || 0} active subscriptions
          </p>
        </div>

        {/* Churn Rate Card */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Churn Rate
            </span>
            <div className="p-2 rounded-lg bg-danger-100 dark:bg-danger-900/30">
              <TrendingDown className="w-4 h-4 text-danger-600 dark:text-danger-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {churn?.averages?.mrrChurnRate || '0'}%
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Monthly MRR churn</p>
        </div>

        {/* LTV Card */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">LTV</span>
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(ltv?.ltv || 0)}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            ARPA: {formatCurrency(ltv?.arpa || 0)}/mo
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Trend Chart */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">MRR Trend</h3>
          <div className="h-64 flex items-end gap-1">
            {mrrTrend?.data?.slice(-30).map((day, i) => {
              const maxMRR = Math.max(...(mrrTrend?.data?.map((d) => d.mrr) || [1]));
              const height = (day.mrr / maxMRR) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-primary-500 dark:bg-primary-600 rounded-t hover:bg-primary-600 dark:hover:bg-primary-500 transition-colors cursor-pointer group relative"
                  style={{ height: `${Math.max(height, 2)}%` }}
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                    {formatCurrency(day.mrr)}
                  </div>
                </div>
              );
            })}
          </div>
          {mrrTrend?.data && mrrTrend.data.length > 0 && (
            <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{mrrTrend.data[0]?.date}</span>
              <span>{mrrTrend.data[mrrTrend.data.length - 1]?.date}</span>
            </div>
          )}
        </div>

        {/* Plan Distribution */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Revenue by Plan
          </h3>
          <div className="space-y-4">
            {mrr?.byPlan?.map((plan, i) => {
              const totalMRR = mrr?.totalMRR || 1;
              const percentage = (plan.plan_mrr / totalMRR) * 100;
              const colors = [
                'bg-navy-900',
                'bg-blue-500',
                'bg-green-500',
                'bg-amber-500',
                'bg-pink-500',
              ];
              return (
                <div key={plan.plan_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {plan.plan_name}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {plan.subscriber_count} subs • {formatCurrency(plan.plan_mrr)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[i % colors.length]} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!mrr?.byPlan || mrr.byPlan.length === 0) && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No plan distribution data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Churn & Expansion Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn Analysis */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Churn Analysis
          </h3>
          <div className="overflow-x-auto">
            <table
              /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full"
            >
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Churned</th>
                  <th className="pb-2 text-right">MRR Lost</th>
                  <th className="pb-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {churn?.data?.slice(0, 6).map((row, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-navy-700">
                    <td className="py-2 text-slate-900 dark:text-white">
                      {formatMonth(row.month)}
                    </td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                      {row.churnedCustomers}
                    </td>
                    <td className="py-2 text-right text-danger-600 dark:text-danger-400">
                      {formatCurrency(row.churnedMRR)}
                    </td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                      {row.mrrChurnRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!churn?.data || churn.data.length === 0) && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No churn data available
              </div>
            )}
          </div>
        </div>

        {/* Expansion Revenue */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Expansion Revenue
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Expansion</th>
                  <th className="pb-2 text-right">Contraction</th>
                  <th className="pb-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {expansion?.data?.slice(0, 6).map((row, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-navy-700">
                    <td className="py-2 text-slate-900 dark:text-white">
                      {formatMonth(row.month)}
                    </td>
                    <td className="py-2 text-right text-green-600 dark:text-green-400">
                      +{formatCurrency(row.expansion_mrr)}
                    </td>
                    <td className="py-2 text-right text-danger-600 dark:text-danger-400">
                      -{formatCurrency(row.contraction_mrr)}
                    </td>
                    <td
                      className={`py-2 text-right font-medium ${
                        row.netExpansion >= 0 ? 'text-green-600' : 'text-danger-600'
                      }`}
                    >
                      {row.netExpansion >= 0 ? '+' : ''}
                      {formatCurrency(row.netExpansion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!expansion?.data || expansion.data.length === 0) && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No expansion data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cohort Retention */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Cohort Retention
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {cohorts?.cohorts?.map((cohort, i) => (
            <div key={i} className="text-center p-4 rounded-lg bg-slate-50 dark:bg-navy-900/50">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {formatMonth(cohort.cohort)}
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {cohort.retentionRate}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {cohort.currentActive}/{cohort.startingCount} active
              </p>
            </div>
          ))}
          {(!cohorts?.cohorts || cohorts.cohorts.length === 0) && (
            <div className="col-span-full text-center py-8 text-slate-500 dark:text-slate-400">
              No cohort data available
            </div>
          )}
        </div>
      </div>

      {/* LTV Details */}
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Customer Value Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Lifetime Value</p>
            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {formatCurrency(ltv?.ltv || 0)}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">ARPA</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(ltv?.arpa || 0)}/mo
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Revenue/Customer</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(ltv?.avgRevenuePerCustomer || 0)}
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Lifespan</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {ltv?.avgLifespanMonths || 0} mo
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Monthly Churn</p>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
              {ltv?.monthlyChurnRate || 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionAnalytics;
