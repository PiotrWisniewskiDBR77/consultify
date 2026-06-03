/**
 * EscalationDashboard - Dashboard for escalation management
 * Shows aging decisions, blocking decisions, overloaded owners, and escalation metrics
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  Lock,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import DecisionCard, { Decision } from './DecisionCard';

interface AgingDecision {
  id: string;
  title: string;
  daysWaiting: number;
  ownerName?: string;
  decision_type: string;
}

interface BlockingDecision {
  id: string;
  title: string;
  blockedCount: number;
  ownerName?: string;
  decision_type: string;
}

interface OverloadedOwner {
  userId: string;
  name: string;
  email: string;
  pendingCount: number;
}

interface BottleneckData {
  aging: AgingDecision[];
  blocking: BlockingDecision[];
  ownerOverload: OverloadedOwner[];
}

interface EscalationMetrics {
  totalPending: number;
  totalEscalated: number;
  totalOverdue: number;
  avgResolutionDays: number;
  escalationRate: number;
  redAlerts: number;
  amberAlerts: number;
  blockedItems: number;
}

interface EscalationDashboardProps {
  projectId?: string;
  onDecisionClick?: (decisionId: string) => void;
  onUserClick?: (userId: string) => void;
}

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { direction: 'up' | 'down'; value: string };
  color: 'red' | 'amber' | 'green' | 'purple' | 'blue';
  onClick?: () => void;
}> = ({ title, value, subtitle, icon, trend, color, onClick }) => {
  const colorStyles = {
    red: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-800/50',
      icon: 'text-rose-500',
      value: 'text-rose-700 dark:text-rose-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800/50',
      icon: 'text-amber-500',
      value: 'text-amber-700 dark:text-amber-300',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800/50',
      icon: 'text-green-500',
      value: 'text-green-700 dark:text-green-300',
    },
    purple: {
      bg: 'bg-primary-50 dark:bg-primary-900/20',
      border: 'border-primary-200 dark:border-primary-800/50',
      icon: 'text-primary-500',
      value: 'text-primary-700 dark:text-primary-300',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800/50',
      icon: 'text-blue-500',
      value: 'text-blue-700 dark:text-blue-300',
    },
  };

  const styles = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`
        p-4 rounded-xl border ${styles.bg} ${styles.border}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`${styles.icon}`}>{icon}</span>
        {trend && (
          <span
            className={`text-xs flex items-center gap-0.5 ${
              trend.direction === 'up' ? 'text-rose-500' : 'text-green-500'
            }`}
          >
            {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold ${styles.value}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{title}</div>
      {subtitle && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</div>
      )}
    </motion.div>
  );
};

// Alert Section Component
const AlertSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  color: 'amber' | 'red' | 'purple';
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, count, color, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorStyles = {
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800/50',
      badge: 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300',
      icon: 'text-amber-500',
    },
    red: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-800/50',
      badge: 'bg-rose-100 dark:bg-rose-800/50 text-rose-700 dark:text-rose-300',
      icon: 'text-rose-500',
    },
    purple: {
      bg: 'bg-primary-50 dark:bg-primary-900/20',
      border: 'border-primary-200 dark:border-primary-800/50',
      badge: 'bg-primary-100 dark:bg-primary-800/50 text-primary-700 dark:text-primary-300',
      icon: 'text-primary-500',
    },
  };

  const styles = colorStyles[color];

  if (count === 0) return null;

  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <span className={styles.icon}>{icon}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
            {count}
          </span>
        </div>
        <ChevronRight
          size={16}
          className={`text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const EscalationDashboard: React.FC<EscalationDashboardProps> = ({
  projectId,
  onDecisionClick,
  onUserClick,
}) => {
  const { t } = useTranslation();
  const [bottlenecks, setBottlenecks] = useState<BottleneckData | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const effectiveProjectId = projectId || currentProjectId;

  // Fetch data
  const fetchData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const bottleneckUrl = effectiveProjectId
          ? `/decisions/bottlenecks?projectId=${effectiveProjectId}`
          : '/decisions/bottlenecks';

        const decisionsUrl = effectiveProjectId
          ? `/decisions?projectId=${effectiveProjectId}&includeAll=true`
          : '/decisions?includeAll=true';

        const [bottleneckData, decisionsData] = await Promise.all([
          Api.get(bottleneckUrl),
          Api.get(decisionsUrl),
        ]);

        setBottlenecks(bottleneckData);

        const decisionsList = Array.isArray(decisionsData)
          ? decisionsData
          : decisionsData?.decisions || [];
        const enhanced = decisionsList.map((d: Decision) => {
          const daysWaiting =
            d.daysWaiting ||
            Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          return {
            ...d,
            daysWaiting,
            isOverdue: daysWaiting > 7,
            daysOverdue: Math.max(0, daysWaiting - 7),
          };
        });

        setDecisions(enhanced);
      } catch (error) {
        console.error('Failed to fetch escalation data:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [effectiveProjectId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate metrics
  const metrics: EscalationMetrics = useMemo(() => {
    const pending = decisions.filter((d) => ['PENDING', 'ESCALATED'].includes(d.status));
    const escalated = pending.filter((d) => d.status === 'ESCALATED');
    const overdue = pending.filter((d) => d.isOverdue);
    const blocked = pending.reduce((sum, d) => sum + (d.blockedItemsCount || 0), 0);

    const redAlerts = pending.filter(
      (d) => d.escalationLevelName === 'red' || (d.isOverdue && (d.daysOverdue || 0) > 7)
    ).length;
    const amberAlerts = pending.filter(
      (d) =>
        d.escalationLevelName === 'amber' ||
        (d.isOverdue && (d.daysOverdue || 0) <= 7 && (d.daysOverdue || 0) > 0)
    ).length;

    const avgDays =
      pending.length > 0
        ? Math.round(pending.reduce((sum, d) => sum + (d.daysWaiting || 0), 0) / pending.length)
        : 0;

    const escalationRate =
      pending.length > 0 ? Math.round((escalated.length / pending.length) * 100) : 0;

    return {
      totalPending: pending.length,
      totalEscalated: escalated.length,
      totalOverdue: overdue.length,
      avgResolutionDays: avgDays,
      escalationRate,
      redAlerts,
      amberAlerts,
      blockedItems: blocked,
    };
  }, [decisions]);

  // Get critical decisions (for quick action section)
  const criticalDecisions = useMemo(() => {
    return decisions
      .filter(
        (d) =>
          ['PENDING', 'ESCALATED'].includes(d.status) &&
          (d.escalationLevelName === 'red' ||
            d.priority === 'CRITICAL' ||
            (d.isOverdue && (d.daysOverdue || 0) > 7))
      )
      .slice(0, 5);
  }, [decisions]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-500" size={24} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm"
      data-testid="escalation-dashboard"
    >
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-amber-600 text-white rounded-lg shadow-sm">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="font-bold text-navy-900 dark:text-white">
                {t('decisions.escalationDashboard', 'Escalation Dashboard')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('decisions.escalationOverview', 'Decision bottlenecks and alerts')}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title={t('decisions.redAlerts', 'Red Alerts')}
            value={metrics.redAlerts}
            subtitle={t('decisions.criticalEscalations', 'Critical escalations')}
            icon={<Flame size={20} />}
            color="red"
          />
          <MetricCard
            title={t('decisions.amberAlerts', 'Amber Alerts')}
            value={metrics.amberAlerts}
            subtitle={t('decisions.warningLevel', 'Warning level')}
            icon={<AlertCircle size={20} />}
            color="amber"
          />
          <MetricCard
            title={t('decisions.blockedItems', 'Blocked Items')}
            value={metrics.blockedItems}
            subtitle={t('decisions.waitingOnDecisions', 'Waiting on decisions')}
            icon={<Lock size={20} />}
            color="purple"
          />
          <MetricCard
            title={t('decisions.avgWaitTime', 'Avg Wait Time')}
            value={`${metrics.avgResolutionDays}d`}
            subtitle={t('decisions.daysWaiting', 'Days waiting')}
            icon={<Clock size={20} />}
            color={metrics.avgResolutionDays > 5 ? 'amber' : 'green'}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            title={t('decisions.totalPending', 'Total Pending')}
            value={metrics.totalPending}
            icon={<Bell size={18} />}
            color="blue"
          />
          <MetricCard
            title={t('decisions.escalated', 'Escalated')}
            value={metrics.totalEscalated}
            icon={<TrendingUp size={18} />}
            color={metrics.totalEscalated > 0 ? 'amber' : 'green'}
          />
          <MetricCard
            title={t('decisions.escalationRate', 'Escalation Rate')}
            value={`${metrics.escalationRate}%`}
            icon={<Zap size={18} />}
            color={
              metrics.escalationRate > 20 ? 'red' : metrics.escalationRate > 10 ? 'amber' : 'green'
            }
          />
        </div>

        {/* Critical Decisions (Quick Action) */}
        {criticalDecisions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Flame size={14} className="text-rose-500" />
              {t('decisions.criticalDecisions', 'Critical Decisions')}
            </h3>
            <div className="space-y-2">
              {criticalDecisions.map((decision) => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  variant="compact"
                  showActions={false}
                  onClick={onDecisionClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottleneck Alerts */}
        {bottlenecks && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              {t('decisions.bottleneckAlerts', 'Bottleneck Alerts')}
            </h3>

            {/* Aging Decisions */}
            <AlertSection
              title={t('decisions.agingDecisions', 'Aging Decisions')}
              icon={<Clock size={14} />}
              count={bottlenecks.aging?.length || 0}
              color="amber"
            >
              {bottlenecks.aging?.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onDecisionClick?.(d.id)}
                  className="w-full text-left p-2 bg-white dark:bg-navy-900 rounded border border-amber-100 dark:border-amber-800/30 hover:border-amber-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                      {d.title}
                    </span>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 font-medium">
                      {d.daysWaiting}d
                    </span>
                  </div>
                  {d.ownerName && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Owner: {d.ownerName}
                    </span>
                  )}
                </button>
              ))}
            </AlertSection>

            {/* Blocking Decisions */}
            <AlertSection
              title={t('decisions.blockingWork', 'Blocking Work')}
              icon={<Lock size={14} />}
              count={bottlenecks.blocking?.length || 0}
              color="red"
            >
              {bottlenecks.blocking?.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onDecisionClick?.(d.id)}
                  className="w-full text-left p-2 bg-white dark:bg-navy-900 rounded border border-rose-100 dark:border-rose-800/30 hover:border-rose-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                      {d.title}
                    </span>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-800/50 text-rose-700 dark:text-rose-300 font-medium">
                      {d.blockedCount} blocked
                    </span>
                  </div>
                  {d.ownerName && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Owner: {d.ownerName}
                    </span>
                  )}
                </button>
              ))}
            </AlertSection>

            {/* Owner Overload */}
            <AlertSection
              title={t('decisions.overloadedOwners', 'Overloaded Owners')}
              icon={<Users size={14} />}
              count={bottlenecks.ownerOverload?.length || 0}
              color="purple"
              defaultOpen={false}
            >
              {bottlenecks.ownerOverload?.map((owner) => (
                <button
                  key={owner.userId}
                  onClick={() => onUserClick?.(owner.userId)}
                  className="w-full text-left p-2 bg-white dark:bg-navy-900 rounded border border-primary-100 dark:border-primary-800/30 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {owner.name}
                    </span>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-800/50 text-primary-700 dark:text-primary-300 font-medium">
                      {owner.pendingCount} pending
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {owner.email}
                  </span>
                </button>
              ))}
            </AlertSection>
          </div>
        )}

        {/* All Clear State */}
        {metrics.redAlerts === 0 &&
          metrics.amberAlerts === 0 &&
          (bottlenecks?.aging?.length || 0) === 0 &&
          (bottlenecks?.blocking?.length || 0) === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/50"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <AlertCircle size={32} className="text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-green-700 dark:text-green-300 mb-2">
                {t('decisions.allClear', 'All Clear!')}
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                {t('decisions.noBottlenecks', 'No decision bottlenecks or escalations')}
              </p>
            </motion.div>
          )}
      </div>
    </div>
  );
};

export default EscalationDashboard;
