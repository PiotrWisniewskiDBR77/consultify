/**
 * KPIGrid - Executive KPI Dashboard Grid
 * BCG/McKinsey style: 4-quadrant layout, data-dense, actionable
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface KPIData {
  tasks: {
    completed: number;
    total: number;
    overdueCount: number;
    onTimeRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  decisions: {
    pending: number;
    avgWaitDays: number;
    critical: number;
    trend: 'up' | 'down' | 'stable';
  };
  team: {
    avgCapacity: number;
    overloaded: number;
    available: number;
    trend: 'up' | 'down' | 'stable';
  };
  risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    blockers: number;
    escalations: number;
    trend: 'up' | 'down' | 'stable';
  };
}

interface KPIGridProps {
  data?: Partial<KPIData>;
  loading?: boolean;
  onNavigate?: (section: string) => void;
}

// Individual KPI Card
const KPICard: React.FC<{
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  trendLabel?: string;
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  details?: { label: string; value: string | number; highlight?: boolean }[];
  onClick?: () => void;
  delay?: number;
}> = ({
  title,
  icon,
  iconBg,
  value,
  subValue,
  trend,
  trendLabel,
  status = 'neutral',
  details,
  onClick,
  delay = 0,
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const getTrendColor = () => {
    // For some metrics, down is good (e.g., overdue, wait time)
    if (trend === 'up') return 'text-emerald-500';
    if (trend === 'down') return 'text-rose-500';
    return 'text-slate-400 dark:text-slate-500';
  };

  const getStatusBorder = () => {
    switch (status) {
      case 'success':
        return 'border-l-emerald-500';
      case 'warning':
        return 'border-l-amber-500';
      case 'danger':
        return 'border-l-rose-500';
      default:
        return 'border-l-slate-300 dark:border-l-white/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, duration: 0.4 }}
      onClick={onClick}
      className={`
                bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 
                border-l-4 ${getStatusBorder()}
                p-4 hover:shadow-lg transition-all cursor-pointer group
            `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shadow-lg`}
        >
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            <TrendIcon size={14} />
            {trendLabel && <span className="text-xs font-medium">{trendLabel}</span>}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        {title}
      </p>

      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-navy-900 dark:text-white tabular-nums">
          {value}
        </span>
        {subValue && <span className="text-sm text-slate-400 dark:text-slate-500">{subValue}</span>}
      </div>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-navy-700">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
              <span
                className={`font-semibold tabular-nums ${
                  detail.highlight ? 'text-rose-500' : 'text-navy-900 dark:text-white'
                }`}
              >
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hover Arrow */}
      <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-brand font-medium flex items-center gap-1">
          View details <ArrowRight size={12} />
        </span>
      </div>
    </motion.div>
  );
};

// Risk Level Badge
const RiskLevelBadge: React.FC<{ level: string }> = ({ level }) => {
  const config = {
    low: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: 'Low',
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Medium',
    },
    high: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'High',
    },
    critical: {
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-300',
      label: 'Critical',
    },
  };

  const cfg = config[level as keyof typeof config] || config.medium;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === 'critical'
            ? 'bg-rose-500 animate-pulse'
            : level === 'high'
              ? 'bg-orange-500'
              : level === 'medium'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
        }`}
      />
      {cfg.label}
    </span>
  );
};

export const KPIGrid: React.FC<KPIGridProps> = ({ data, loading = false, onNavigate }) => {
  const { t } = useTranslation();

  // Real data only - no mock fallbacks
  const kpiData: KPIData = {
    tasks: {
      completed: data?.tasks?.completed ?? 0,
      total: data?.tasks?.total ?? 0,
      overdueCount: data?.tasks?.overdueCount ?? 0,
      onTimeRate: data?.tasks?.onTimeRate ?? 0,
      trend: data?.tasks?.trend ?? 'stable',
    },
    decisions: {
      pending: data?.decisions?.pending ?? 0,
      avgWaitDays: data?.decisions?.avgWaitDays ?? 0,
      critical: data?.decisions?.critical ?? 0,
      trend: data?.decisions?.trend ?? 'stable',
    },
    team: {
      avgCapacity: data?.team?.avgCapacity ?? 0,
      overloaded: data?.team?.overloaded ?? 0,
      available: data?.team?.available ?? 0,
      trend: data?.team?.trend ?? 'stable',
    },
    risk: {
      level: data?.risk?.level ?? 'low',
      blockers: data?.risk?.blockers ?? 0,
      escalations: data?.risk?.escalations ?? 0,
      trend: data?.risk?.trend ?? 'stable',
    },
  };

  // A1.1: Protect against division by zero – show "No data" when there are no tasks
  const hasTaskData = kpiData.tasks.total > 0;
  const completionRate = hasTaskData
    ? Math.round((kpiData.tasks.completed / kpiData.tasks.total) * 100)
    : null;

  // A1.1: Detect whether real data was loaded from API
  // The parent (ExecutiveDashboard) passes data; if the API call failed or returned empty,
  // the values stay at their initial zeros. We check if the data prop section exists.
  const hasDecisionData = data?.decisions !== undefined;
  const hasTeamData = data?.team !== undefined;
  const hasRiskData = data?.risk !== undefined;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 animate-pulse"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/10 mb-4" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded mb-2" />
            <div className="h-8 w-24 bg-slate-200 dark:bg-white/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Tasks KPI – A1.1: data source: /my-work/stats?period=week */}
      <KPICard
        title={t('executive.kpi.tasks', 'Task Execution')}
        icon={<CheckCircle2 size={22} className="text-white" />}
        iconBg="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
        value={hasTaskData ? `${completionRate}%` : '—'}
        subValue={
          hasTaskData
            ? `${kpiData.tasks.completed}/${kpiData.tasks.total}`
            : t('executive.kpi.noData', 'No data')
        }
        trend={hasTaskData ? kpiData.tasks.trend : undefined}
        status={
          !hasTaskData
            ? 'neutral'
            : (completionRate ?? 0) >= 75
              ? 'success'
              : (completionRate ?? 0) >= 50
                ? 'warning'
                : 'danger'
        }
        details={
          hasTaskData
            ? [
                {
                  label: t('executive.kpi.onTime', 'On-time'),
                  value: `${kpiData.tasks.onTimeRate}%`,
                },
                {
                  label: t('executive.kpi.overdue', 'Overdue'),
                  value: kpiData.tasks.overdueCount,
                  highlight: kpiData.tasks.overdueCount > 0,
                },
              ]
            : []
        }
        onClick={() => onNavigate?.('tasks')}
        delay={0}
      />

      {/* Decisions KPI – A1.1: data source: /decisions?limit=10 */}
      <KPICard
        title={t('executive.kpi.decisions', 'Decisions Pending')}
        icon={<FileQuestion size={22} className="text-white" />}
        iconBg="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30"
        value={hasDecisionData ? kpiData.decisions.pending : '—'}
        subValue={
          hasDecisionData
            ? t('executive.kpi.awaiting', 'awaiting')
            : t('executive.kpi.noData', 'No data')
        }
        trend={hasDecisionData ? kpiData.decisions.trend : undefined}
        status={
          !hasDecisionData
            ? 'neutral'
            : kpiData.decisions.critical > 0
              ? 'danger'
              : kpiData.decisions.pending > 5
                ? 'warning'
                : 'success'
        }
        details={
          hasDecisionData
            ? [
                {
                  label: t('executive.kpi.critical', 'Critical'),
                  value: kpiData.decisions.critical,
                  highlight: kpiData.decisions.critical > 0,
                },
                {
                  label: t('executive.kpi.avgWait', 'Avg wait'),
                  value: `${kpiData.decisions.avgWaitDays}d`,
                },
              ]
            : []
        }
        onClick={() => onNavigate?.('decisions')}
        delay={1}
      />

      {/* Team Capacity KPI – A1.1: data source: /my-work/team-workload */}
      <KPICard
        title={t('executive.kpi.teamCapacity', 'Team Capacity')}
        icon={<Users size={22} className="text-white" />}
        iconBg="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30"
        value={hasTeamData ? `${kpiData.team.avgCapacity}%` : '—'}
        subValue={
          hasTeamData
            ? t('executive.kpi.utilized', 'utilized')
            : t('executive.kpi.noData', 'No data')
        }
        trend={hasTeamData ? kpiData.team.trend : undefined}
        status={
          !hasTeamData
            ? 'neutral'
            : kpiData.team.overloaded > 2
              ? 'danger'
              : kpiData.team.avgCapacity > 90
                ? 'warning'
                : 'success'
        }
        details={
          hasTeamData
            ? [
                {
                  label: t('executive.kpi.overloaded', 'Overloaded'),
                  value: kpiData.team.overloaded,
                  highlight: kpiData.team.overloaded > 0,
                },
                { label: t('executive.kpi.available', 'Available'), value: kpiData.team.available },
              ]
            : []
        }
        onClick={() => onNavigate?.('team')}
        delay={2}
      />

      {/* Risk Level KPI – A1.1: data source: derived from overdue tasks */}
      <KPICard
        title={t('executive.kpi.riskLevel', 'Risk Level')}
        icon={<AlertTriangle size={22} className="text-white" />}
        iconBg={`bg-gradient-to-br ${
          !hasRiskData
            ? 'from-slate-400 to-slate-500 shadow-slate-500/30'
            : kpiData.risk.level === 'critical'
              ? 'from-rose-500 to-red-600 shadow-rose-500/30'
              : kpiData.risk.level === 'high'
                ? 'from-orange-500 to-red-600 shadow-orange-500/30'
                : kpiData.risk.level === 'medium'
                  ? 'from-amber-500 to-orange-600 shadow-amber-500/30'
                  : 'from-emerald-500 to-green-600 shadow-emerald-500/30'
        }`}
        value={hasRiskData ? kpiData.risk.level.toUpperCase() : '—'}
        subValue={
          hasRiskData
            ? ((<RiskLevelBadge level={kpiData.risk.level} />) as any)
            : t('executive.kpi.noData', 'No data')
        }
        trend={hasRiskData ? kpiData.risk.trend : undefined}
        status={
          !hasRiskData
            ? 'neutral'
            : kpiData.risk.level === 'critical'
              ? 'danger'
              : kpiData.risk.level === 'high'
                ? 'warning'
                : 'neutral'
        }
        details={
          hasRiskData
            ? [
                {
                  label: t('executive.kpi.blockers', 'Blockers'),
                  value: kpiData.risk.blockers,
                  highlight: kpiData.risk.blockers > 2,
                },
                {
                  label: t('executive.kpi.escalations', 'Escalations'),
                  value: kpiData.risk.escalations,
                  highlight: kpiData.risk.escalations > 0,
                },
              ]
            : []
        }
        onClick={() => onNavigate?.('risks')}
        delay={3}
      />
    </div>
  );
};

export default KPIGrid;
