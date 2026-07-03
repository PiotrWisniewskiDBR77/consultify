/**
 * UsageDashboardView - Comprehensive usage analytics dashboard
 * Displays real-time usage data for tokens, storage, seats, and costs
 */

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Cpu,
  DollarSign,
  Download,
  HardDrive,
  PieChart,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DegradedState } from '../../components/Admin/AdminState';
import { useAppStore } from '../../store/useAppStore';
import { getOrganizationContextQuotaCopy } from '../../utils/organizationContextQuotaCopy';

interface UsageSummary {
  currentPeriod: {
    start: string;
    end: string;
    daysElapsed: number;
    daysRemaining: number;
  };
  tokens: {
    used: number;
    limit: number;
    percentage: number;
    trend: number;
    requests: number;
  };
  storage: {
    used: number;
    usedFormatted: string;
    limit: number;
    limitFormatted: string;
    percentage: number;
  };
  seats: {
    used: number;
    limit: number;
    percentage: number;
  };
  cost: {
    current: number;
    projected: number;
    planBase: number;
  };
  breakdown: {
    byUser: Array<{
      id: string;
      name: string;
      email: string;
      tokens: number;
      cost: number;
      requests: number;
    }>;
    byProject: Array<{ id: string; name: string; tokens: number; cost: number; requests: number }>;
    byFeature: Array<{ feature: string; tokens: number; cost: number; requests: number }>;
  };
  trend: Array<{ date: string; tokens: number; cost: number; requests: number }>;
  projectedUsage: number;
}

interface UsageDashboardViewProps {
  className?: string;
}

const COLORS = ['#64748b', '#94a3b8', '#475569', '#334155', '#1e293b', '#0f172a'];

export const UsageDashboardView: React.FC<UsageDashboardViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrganization } = useAppStore();
  const stripeEnabled = ['true', '1', 'yes'].includes(
    String(import.meta.env.VITE_STRIPE_ENABLED || '')
      .trim()
      .toLowerCase()
  );

  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  const [breakdownView, setBreakdownView] = useState<'user' | 'project' | 'feature'>('user');

  useEffect(() => {
    loadUsageSummary();
  }, [currentOrganization?.id, timeRange]);

  const loadUsageSummary = async () => {
    if (!currentOrganization?.id) return;

    setLoading(!usage); // Only show full loading on initial load
    setRefreshing(!!usage);

    try {
      setLoadError(null);
      const response = await fetch(`/api/billing/usage-summary?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      console.error('Error loading usage summary:', error);
      setUsage(null);
      setLoadError(error instanceof Error ? error.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/billing/export?type=usage&format=csv`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Usage data exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getUsageStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-danger-400';
    if (percentage >= 75) return 'text-amber-400';
    return 'text-c-text-muted';
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-danger-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-slate-500';
  };

  const currentBreakdown = useMemo(() => {
    if (!usage?.breakdown) return [];
    switch (breakdownView) {
      case 'user':
        return usage.breakdown.byUser || [];
      case 'project':
        return usage.breakdown.byProject || [];
      case 'feature':
        return usage.breakdown.byFeature || [];
      default:
        return [];
    }
  }, [usage, breakdownView]);

  const pieData = useMemo(() => {
    return currentBreakdown.slice(0, 6).map((item: any, index) => ({
      name: item.name || item.feature || 'Unknown',
      value: item.tokens,
      color: COLORS[index % COLORS.length],
    }));
  }, [currentBreakdown]);

  const organizationContextQuota = getOrganizationContextQuotaCopy(usage?.storage.percentage || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-c-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Activity size={18} className="text-c-text-muted" />
            {t('admin.billing.usageDashboard', 'Usage Dashboard')}
          </h2>
          <p className="text-sm text-c-text-muted mt-0.5">
            {usage?.currentPeriod && (
              <>
                {new Date(usage.currentPeriod.start).toLocaleDateString()} -{' '}
                {new Date(usage.currentPeriod.end).toLocaleDateString()}
                <span className="mx-2">•</span>
                {usage.currentPeriod.daysRemaining} days remaining
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-c-surface/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            {(['7', '30', '90'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                disabled={!!loadError}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeRange === range
                    ? 'bg-c-surface/[0.08] text-c-text'
                    : 'text-c-text-muted hover:text-slate-300'
                }`}
              >
                {range}d
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={!!loadError || !usage}
            className="admin-btn admin-btn-subtle flex items-center gap-2"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={loadUsageSummary}
            disabled={refreshing}
            className="admin-btn admin-btn-subtle"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loadError ? (
        <DegradedState title="Usage dashboard unavailable" description={loadError} />
      ) : null}

      {!loadError && (
        <>
          {!stripeEnabled && (
            <div className="admin-card border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-300">
                Self-service checkout is currently disabled.
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                To activate an enterprise tier, use Billing & FinOps and contact sales.
              </p>
            </div>
          )}

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tokens */}
            <div className="admin-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-c-text-muted" />
                  <span className="text-xs text-c-text-muted uppercase tracking-wider">
                    AI Tokens
                  </span>
                </div>
                {usage?.tokens.trend !== undefined && usage.tokens.trend !== 0 && (
                  <span
                    className={`flex items-center text-xs ${usage.tokens.trend > 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                  >
                    {usage.tokens.trend > 0 ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {Math.abs(usage.tokens.trend)}%
                  </span>
                )}
              </div>
              <div className="mb-2">
                <span className="text-2xl font-semibold text-c-text">
                  {formatNumber(usage?.tokens.used || 0)}
                </span>
                <span className="text-c-text-muted text-sm ml-1">
                  / {formatNumber(usage?.tokens.limit || 0)}
                </span>
              </div>
              <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5 mb-2">
                <div
                  className={`${getProgressBarColor(usage?.tokens.percentage || 0)} rounded-full h-1.5 transition-all`}
                  style={{ width: `${Math.min(usage?.tokens.percentage || 0, 100)}%` }}
                />
              </div>
              <p className={`text-xs ${getUsageStatusColor(usage?.tokens.percentage || 0)}`}>
                {usage?.tokens.percentage}% used • {usage?.tokens.requests} requests
              </p>
            </div>

            {/* Storage */}
            <div className="admin-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-c-text-muted" />
                  <span className="text-xs text-c-text-muted uppercase tracking-wider">
                    Storage
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-2xl font-semibold text-c-text">
                  {usage?.storage.usedFormatted || '0 B'}
                </span>
                <span className="text-c-text-muted text-sm ml-1">
                  / {usage?.storage.limitFormatted || '5 GB'}
                </span>
              </div>
              <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5 mb-2">
                <div
                  className={`${getProgressBarColor(usage?.storage.percentage || 0)} rounded-full h-1.5 transition-all`}
                  style={{ width: `${Math.min(usage?.storage.percentage || 0, 100)}%` }}
                />
              </div>
              <p className={`text-xs ${getUsageStatusColor(usage?.storage.percentage || 0)}`}>
                {usage?.storage.percentage}% used
              </p>
            </div>

            {/* Seats */}
            <div className="admin-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-c-text-muted" />
                  <span className="text-xs text-c-text-muted uppercase tracking-wider">
                    Seats
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-2xl font-semibold text-c-text">{usage?.seats.used || 0}</span>
                <span className="text-c-text-muted text-sm ml-1">
                  / {usage?.seats.limit || 0}
                </span>
              </div>
              <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5 mb-2">
                <div
                  className={`${getProgressBarColor(usage?.seats.percentage || 0)} rounded-full h-1.5 transition-all`}
                  style={{ width: `${Math.min(usage?.seats.percentage || 0, 100)}%` }}
                />
              </div>
              <p className={`text-xs ${getUsageStatusColor(usage?.seats.percentage || 0)}`}>
                {usage?.seats.percentage}% used
              </p>
            </div>

            {/* Cost */}
            <div className="admin-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-c-text-muted" />
                  <span className="text-xs text-c-text-muted uppercase tracking-wider">
                    Est. Cost
                  </span>
                </div>
                <span className="text-xs text-c-text-muted">this period</span>
              </div>
              <div className="mb-2">
                <span className="text-2xl font-semibold text-c-text">
                  ${(usage?.cost.current || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-c-text-muted">Projected:</span>
                <span className="text-amber-400">${(usage?.cost.projected || 0).toFixed(2)}</span>
              </div>
              <p className="text-xs text-c-text-muted mt-1">
                Base plan: ${usage?.cost.planBase || 0}/mo
              </p>
            </div>
          </div>

          {/* Organization Context Storage */}
          <div
            className={`admin-card p-4 border ${
              organizationContextQuota.tone === 'critical'
                ? 'border-danger-500/30 bg-danger-500/5'
                : organizationContextQuota.tone === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-white/[0.08]'
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <HardDrive
                  size={20}
                  className={
                    organizationContextQuota.tone === 'critical'
                      ? 'text-danger-400'
                      : organizationContextQuota.tone === 'warning'
                        ? 'text-amber-400'
                        : 'text-c-text-muted'
                  }
                />
                <div>
                  <p className="text-xs text-c-text-muted uppercase tracking-wider">
                    Organization Context Storage
                  </p>
                  <h3
                    className={`text-sm font-medium mt-1 ${
                      organizationContextQuota.tone === 'critical'
                        ? 'text-danger-300'
                        : organizationContextQuota.tone === 'warning'
                          ? 'text-amber-300'
                          : 'text-c-text'
                    }`}
                  >
                    {organizationContextQuota.title}
                  </h3>
                  <p className="text-sm text-c-text-muted mt-1 max-w-3xl">
                    {organizationContextQuota.description}
                  </p>
                  <p className="text-xs text-c-text-muted mt-2">
                    Counts backend-uploaded context files and derived knowledge artifacts used by
                    document library, Interview Insight Creator, chat, reports, and future AI
                    workflows.
                  </p>
                </div>
              </div>
              <div className="min-w-[220px]">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-lg font-semibold text-c-text">
                    {usage?.storage.usedFormatted || '0 B'}
                  </span>
                  <span className="text-xs text-c-text-muted">
                    / {usage?.storage.limitFormatted || '5 GB'}
                  </span>
                </div>
                <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5 mb-2">
                  <div
                    className={`${getProgressBarColor(usage?.storage.percentage || 0)} rounded-full h-1.5 transition-all`}
                    style={{ width: `${Math.min(usage?.storage.percentage || 0, 100)}%` }}
                  />
                </div>
                <p className={`text-xs ${getUsageStatusColor(usage?.storage.percentage || 0)}`}>
                  {usage?.storage.percentage || 0}% used
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Usage Trend Chart */}
            <div className="lg:col-span-2 admin-card p-4">
              <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-c-text-muted" />
                Usage Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usage?.trend || []}>
                    <defs>
                      <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value) => [
                        formatNumber(typeof value === 'number' ? value : 0),
                        'Tokens',
                      ]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      fill="url(#tokenGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown Pie Chart */}
            <div className="admin-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-c-text flex items-center gap-2">
                  <PieChart size={14} className="text-c-text-muted" />
                  Breakdown
                </h3>
                <select
                  value={breakdownView}
                  onChange={(e) => setBreakdownView(e.target.value as any)}
                  disabled={!!loadError || !usage}
                  className="text-xs bg-c-surface/[0.03] border border-white/[0.08] rounded-lg px-2 py-1 text-slate-300"
                >
                  <option value="user">By User</option>
                  <option value="project">By Project</option>
                  <option value="feature">By Feature</option>
                </select>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value) => [
                        formatNumber(typeof value === 'number' ? value : 0),
                        'Tokens',
                      ]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Table */}
          <div className="admin-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-c-text flex items-center gap-2">
                <BarChart3 size={14} className="text-c-text-muted" />
                Detailed Usage by{' '}
                {breakdownView === 'user'
                  ? 'User'
                  : breakdownView === 'project'
                    ? 'Project'
                    : 'Feature'}
              </h3>
              <div className="flex bg-c-surface/[0.03] border border-white/[0.08] rounded-lg p-0.5">
                {(['user', 'project', 'feature'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setBreakdownView(view)}
                    disabled={!!loadError || !usage}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${
                      breakdownView === view
                        ? 'bg-c-surface/[0.08] text-c-text'
                        : 'text-c-text-muted hover:text-slate-300'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */  className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                      {breakdownView === 'user'
                        ? 'User'
                        : breakdownView === 'project'
                          ? 'Project'
                          : 'Feature'}
                    </th>
                    <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                      Tokens
                    </th>
                    <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                      Requests
                    </th>
                    <th className="text-right text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4">
                      Cost
                    </th>
                    <th className="text-left text-xs font-medium text-c-text-muted uppercase tracking-wider py-3 px-4 w-32">
                      Usage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentBreakdown.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-8 text-c-text-muted text-sm"
                      >
                        No usage data available
                      </td>
                    </tr>
                  ) : (
                    currentBreakdown.map((item: any, index) => {
                      const maxTokens = Math.max(...currentBreakdown.map((i: any) => i.tokens));
                      const percentage = maxTokens > 0 ? (item.tokens / maxTokens) * 100 : 0;

                      return (
                        <tr
                          key={item.id || item.feature || index}
                          className="border-b border-white/[0.03] hover:bg-c-surface/[0.02]"
                        >
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm text-c-text">
                                {item.name || item.feature || 'Unknown'}
                              </p>
                              {item.email && (
                                <p className="text-xs text-c-text-muted">
                                  {item.email}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-c-text font-medium">
                              {formatNumber(item.tokens)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-c-text-muted">
                              {formatNumber(item.requests)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-c-text-muted">
                              ${item.cost?.toFixed(2) || '0.00'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-full bg-c-surface/[0.05] rounded-full h-1.5">
                              <div
                                className="bg-c-surface-raised/300 rounded-full h-1.5 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Projected Usage Alert */}
          {usage && usage.tokens.percentage >= 75 && (
            <div
              className={`admin-card p-4 border ${
                usage.tokens.percentage >= 90
                  ? 'border-danger-500/30 bg-danger-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <Zap
                  className={usage.tokens.percentage >= 90 ? 'text-danger-400' : 'text-amber-400'}
                  size={20}
                />
                <div className="flex-1">
                  <h4
                    className={`text-sm font-medium ${usage.tokens.percentage >= 90 ? 'text-danger-400' : 'text-amber-400'}`}
                  >
                    {usage.tokens.percentage >= 90 ? 'Usage Critical' : 'High Usage Warning'}
                  </h4>
                  <p className="text-sm text-c-text-muted mt-1">
                    You've used {usage.tokens.percentage}% of your monthly token quota.
                    {usage.projectedUsage > usage.tokens.limit && (
                      <>
                        {' '}
                        Based on current usage, you're projected to exceed your limit by{' '}
                        {formatNumber(usage.projectedUsage - usage.tokens.limit)} tokens.
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/admin/billing')}
                  className="admin-btn admin-btn-accent text-sm"
                >
                  {stripeEnabled ? 'Upgrade Plan' : 'Contact Sales'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UsageDashboardView;
