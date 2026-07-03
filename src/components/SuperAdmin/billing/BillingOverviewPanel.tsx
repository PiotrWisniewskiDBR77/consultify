/**
 * BillingOverviewPanel - Billing Statistics & Overview
 *
 * Features:
 * - Subscription stats (MRR, ARR, churn)
 * - Revenue charts
 * - Plan distribution
 */

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  Loader2,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../../services/api';

interface BillingStats {
  mrr: number;
  arr: number;
  revenue: {
    total: number;
    invoiceCount: number;
    period: number;
  };
  subscriptions: {
    byPlan: Array<{
      plan_name: string;
      price_monthly: number;
      subscriber_count: number;
    }>;
    trends: Array<{
      date: string;
      new_subscriptions: number;
      churned: number;
    }>;
  };
  unpaidInvoices: {
    count: number;
    totalAmount: number;
  };
}

export const BillingOverviewPanel: React.FC = () => {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Api.get(`/billing/stats?period=${period}`);
      setStats(result);
    } catch (error) {
      console.error('Failed to fetch billing stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-c-text">Billing Overview</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-c-surface-raised rounded-lg p-1">
            {(['7', '30', '90'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  period === p
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-500 hover:text-white'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
          <button
            onClick={fetchStats}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-emerald-400">Monthly Recurring Revenue</span>
            <DollarSign size={20} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-c-text">{formatCurrency(stats?.mrr || 0)}</span>
          </div>
          <p className="text-sm text-emerald-400/70 mt-2">ARR: {formatCurrency(stats?.arr || 0)}</p>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600 dark:text-slate-500">Revenue ({period}d)</span>
            <TrendingUp size={20} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-c-text">
              {formatCurrency(stats?.revenue.total || 0)}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {stats?.revenue.invoiceCount || 0} paid invoices
          </p>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600 dark:text-slate-500">Active Subscriptions</span>
            <Users size={20} className="text-primary-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-c-text">
              {stats?.subscriptions.byPlan.reduce((sum, p) => sum + p.subscriber_count, 0) || 0}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Across {stats?.subscriptions.byPlan.filter((p) => p.subscriber_count > 0).length || 0}{' '}
            plans
          </p>
        </div>

        <div
          className={`rounded-xl p-4 border ${
            (stats?.unpaidInvoices.count || 0) > 0
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-c-surface-raised/50 border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className={`text-sm ${(stats?.unpaidInvoices.count || 0) > 0 ? 'text-amber-400' : 'text-slate-600 dark:text-slate-500'}`}
            >
              Unpaid Invoices
            </span>
            <AlertCircle
              size={20}
              className={
                (stats?.unpaidInvoices.count || 0) > 0
                  ? 'text-amber-400'
                  : 'text-slate-600 dark:text-slate-500'
              }
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-c-text">
              {stats?.unpaidInvoices.count || 0}
            </span>
          </div>
          <p
            className={`text-sm mt-2 ${(stats?.unpaidInvoices.count || 0) > 0 ? 'text-amber-400/70' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {formatCurrency(stats?.unpaidInvoices.totalAmount || 0)} outstanding
          </p>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <PieChart size={20} className="text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-c-text">Plan Distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-500">Subscribers by plan</p>
            </div>
          </div>

          <div className="space-y-4">
            {stats?.subscriptions.byPlan.map((plan, idx) => {
              const total = stats.subscriptions.byPlan.reduce(
                (sum, p) => sum + p.subscriber_count,
                0
              );
              const percentage = total > 0 ? (plan.subscriber_count / total) * 100 : 0;
              const colors = [
                'bg-c-surface',
                'bg-blue-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-danger-500',
              ];

              return (
                <div key={plan.plan_name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-c-text">{plan.plan_name}</span>
                    <span className="text-slate-600 dark:text-slate-500">
                      {plan.subscriber_count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[idx % colors.length]} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {!stats?.subscriptions.byPlan.length && (
              <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                No subscriptions yet
              </p>
            )}
          </div>
        </div>

        <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BarChart3 size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-c-text">Subscription Trends</h3>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                New vs churned ({period} days)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {stats?.subscriptions.trends.slice(-7).map((day) => (
              <div
                key={day.date}
                className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-sm text-slate-600 dark:text-slate-500">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <ArrowUpRight size={14} />
                    <span className="text-sm">+{day.new_subscriptions}</span>
                  </div>
                  <div className="flex items-center gap-1 text-danger-400">
                    <ArrowDownRight size={14} />
                    <span className="text-sm">-{day.churned}</span>
                  </div>
                </div>
              </div>
            ))}

            {!stats?.subscriptions.trends.length && (
              <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                No trend data available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plan Pricing */}
      <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <CreditCard size={20} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-c-text">Plans Revenue Breakdown</h3>
            <p className="text-sm text-slate-600 dark:text-slate-500">Monthly revenue by plan</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {stats?.subscriptions.byPlan.map((plan) => (
            <div key={plan.plan_name} className="bg-c-surface/50 rounded-lg p-4">
              <h4 className="font-medium text-c-text mb-2">{plan.plan_name}</h4>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(plan.price_monthly * plan.subscriber_count)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {plan.subscriber_count} × {formatCurrency(plan.price_monthly)}/mo
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillingOverviewPanel;
