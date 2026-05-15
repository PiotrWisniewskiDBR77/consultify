/**
 * SuperAdminDashboard - Command Center
 *
 * Dense, scannable layout:
 * - Compact metric strip (no giant cards)
 * - Quick actions as icon buttons, not full cards
 * - Inline signals summary
 * - Activity feed
 */

import {
  Activity,
  Brain,
  Building,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface SuperAdminStats {
  totalOrgs: number;
  totalUsers: number;
  revenue: number;
  aiCalls: number;
  tokens: number;
  activeUsers7d: number;
  liveUsers: number;
  pendingRequests: number;
}

interface ActivityItem {
  id?: string;
  user_name?: string;
  user_email?: string;
  action?: string;
  entity_type?: string;
  entity_name?: string;
  entity_id?: string;
  created_at?: string;
}

type SignalType = 'SYSTEM_ALERT' | 'CLIENT_TICKET' | 'USER_FEEDBACK';

type SignalItem = {
  id: string;
  type: SignalType;
  title?: string | null;
  message?: string | null;
  severity?: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' | string | null;
  created_at?: string | null;
};

interface SuperAdminDashboardProps {
  stats: SuperAdminStats;
  activities: ActivityItem[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToOrganizations: () => void;
  onNavigateToUsers: () => void;
  onNavigateToBilling: () => void;
}

const MetricPill: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}> = ({ icon: Icon, label, value, sub, accent }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] min-w-0">
    <div
      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        accent
          ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</div>
      <div className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums leading-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</div>}
    </div>
  </div>
);

const ActionChip: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
}> = ({ icon: Icon, label, onClick, badge }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all text-sm"
  >
    <Icon
      size={14}
      className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"
    />
    <span className="text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
      {label}
    </span>
    {badge !== undefined && badge > 0 && (
      <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
        {badge}
      </span>
    )}
    <ChevronRight
      size={12}
      className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors"
    />
  </button>
);

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityDot(severity?: string | null): string {
  const s = String(severity || '').toUpperCase();
  if (s === 'CRITICAL') return 'bg-red-500';
  if (s === 'HIGH') return 'bg-amber-500';
  if (s === 'WARNING') return 'bg-yellow-500';
  return 'bg-slate-400 dark:bg-slate-500';
}

const ActivityRow: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
  const actionColors: Record<string, string> = {
    created: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    deleted: 'text-red-600 dark:text-red-400 bg-red-500/10',
    updated: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    login: 'text-slate-600 dark:text-slate-400 bg-slate-500/10',
  };

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-slate-100/80 dark:border-white/[0.04] last:border-b-0 text-sm">
      <span className="text-slate-600 dark:text-slate-300 min-w-[90px] max-w-[120px] truncate font-medium text-xs">
        {activity.user_name || activity.user_email || 'System'}
      </span>
      <span
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionColors[activity.action || ''] || 'text-slate-500 bg-slate-100 dark:bg-slate-800/50'}`}
      >
        {activity.action}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        {activity.entity_type}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 truncate flex-1">
        {activity.entity_name || activity.entity_id?.slice(0, 8) || ''}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto whitespace-nowrap tabular-nums">
        {formatTimeAgo(activity.created_at)}
      </span>
    </div>
  );
};

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  stats,
  activities,
  loading,
  onRefresh,
  onNavigateToOrganizations,
  onNavigateToUsers,
  onNavigateToBilling,
}) => {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const fetchSignals = useCallback(async () => {
    try {
      const data = (await Api.getSuperAdminSignals()) as SignalItem[];
      setSignals(Array.isArray(data) ? data : []);
    } catch {
      /* signals are non-critical for dashboard */
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const signalCounts = useMemo(() => {
    const system = signals.filter((s) => s.type === 'SYSTEM_ALERT');
    const tickets = signals.filter((s) => s.type === 'CLIENT_TICKET');
    const feedback = signals.filter((s) => s.type === 'USER_FEEDBACK');
    const critical = signals.filter((s) => String(s.severity || '').toUpperCase() === 'CRITICAL');
    return { system, tickets, feedback, critical, total: signals.length };
  }, [signals]);

  const topSignals = useMemo(() => {
    return [...signals]
      .sort((a, b) => {
        const sev = { CRITICAL: 0, HIGH: 1, WARNING: 2, INFO: 3 };
        const sa = sev[String(a.severity || 'INFO').toUpperCase() as keyof typeof sev] ?? 3;
        const sb = sev[String(b.severity || 'INFO').toUpperCase() as keyof typeof sev] ?? 3;
        return sa - sb;
      })
      .slice(0, 5);
  }, [signals]);

  return (
    <div className="p-5 space-y-5 overflow-y-auto">
      {/* Row 1: Quick actions + Refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <ActionChip icon={Building} label="Organizations" onClick={onNavigateToOrganizations} />
        <ActionChip icon={UserPlus} label="Invite User" onClick={onNavigateToUsers} />
        <ActionChip icon={TrendingUp} label="Revenue" onClick={onNavigateToBilling} />
        {stats.pendingRequests > 0 && (
          <ActionChip
            icon={Clock}
            label="Pending"
            onClick={onNavigateToOrganizations}
            badge={stats.pendingRequests}
          />
        )}
        <div className="flex-1" />
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Row 2: Metric strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <MetricPill icon={Building} label="Organizations" value={stats.totalOrgs} />
        <MetricPill icon={Users} label="Total Users" value={stats.totalUsers} />
        <MetricPill
          icon={Activity}
          label="Live Now"
          value={stats.liveUsers}
          accent={stats.liveUsers > 0}
        />
        <MetricPill icon={Users} label="Active 7d" value={stats.activeUsers7d} />
        <MetricPill icon={Brain} label="AI Calls 7d" value={stats.aiCalls.toLocaleString()} />
        <MetricPill icon={Zap} label="Tokens 7d" value={`${(stats.tokens / 1000).toFixed(1)}k`} />
        <MetricPill icon={DollarSign} label="MRR Est" value={`$${stats.revenue.toFixed(0)}`} />
      </div>

      {/* Row 3: Two-column — Signals summary + Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5">
        {/* Signals summary */}
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Signals</h3>
              {signalCounts.total > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 tabular-nums">
                  {signalCounts.total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {signalCounts.system.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {signalCounts.system.length} alerts
                </span>
              )}
              {signalCounts.tickets.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {signalCounts.tickets.length} tickets
                </span>
              )}
              {signalCounts.feedback.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {signalCounts.feedback.length} feedback
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
            {signalsLoading ? (
              <div className="py-6 flex items-center justify-center text-slate-400">
                <Loader2 size={14} className="animate-spin" />
              </div>
            ) : topSignals.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No active signals
              </div>
            ) : (
              topSignals.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${severityDot(s.severity)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {s.title || 'Untitled'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {s.message || 'No details'}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-600 whitespace-nowrap tabular-nums shrink-0">
                    {formatTimeAgo(s.created_at ?? undefined)}
                  </span>
                </div>
              ))
            )}
          </div>

          {signalCounts.total > 5 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-white/[0.06]">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                +{signalCounts.total - 5} more — see Signals tab
              </span>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.01]">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Activity
            </h3>
            {activities.length > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Last {Math.min(activities.length, 20)} events
              </span>
            )}
          </div>
          <div className="px-4 max-h-[360px] overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 text-xs py-8 text-center">
                No recent activity recorded yet.
              </p>
            ) : (
              activities
                .slice(0, 20)
                .map((act, idx) => <ActivityRow key={act.id || idx} activity={act} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
