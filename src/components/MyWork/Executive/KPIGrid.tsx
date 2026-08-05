/**
 * KPIGrid — the four Manager headline figures.
 *
 * M02-008: every value here comes from ONE `ManagerSnapshot`. The grid no
 * longer accepts loose numbers, because that is precisely how it ended up
 * printing "0% · 0/1" (tasks CREATED in the last 7 days) directly above
 * "Overdue 71" (the ALL-TIME open backlog), and a "Decisions pending" headline
 * that was really the page size of a `LIMIT 10` list.
 *
 * Two hard rules for this file:
 *   1. No arithmetic that mixes two populations. Ratios use a numerator and a
 *      denominator the server computed together.
 *   2. Every card states its BASIS — "Mine" or "Organization" — so a reader can
 *      see why the owner overdue count differs from the org-wide one.
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { interpretCapacity } from './executiveData';
import type { ManagerSnapshot } from './managerSnapshot';

interface KPIGridProps {
  /** `null` while loading, on error, or when the viewer is not a manager. */
  snapshot: ManagerSnapshot | null;
  loading?: boolean;
  /**
   * Only sections the HOST actually routes may be passed here. A card whose
   * destination is unhandled must not render as clickable (M02-011).
   */
  onNavigate?: (section: string, options?: { filter?: string }) => void;
}

// Individual KPI Card
const KPICard: React.FC<{
  title: string;
  /** "Mine" / "Organization" — never omit; an unlabelled number is the bug. */
  basisLabel: string;
  icon: React.ReactNode;
  iconBg: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendLabel?: string;
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  details?: { label: string; value: string | number; highlight?: boolean }[];
  onClick?: () => void;
  delay?: number;
  testId?: string;
}> = ({
  title,
  basisLabel,
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
  testId,
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-500';
    if (trend === 'down') return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-500 dark:text-slate-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.08, duration: 0.22 }}
      onClick={onClick}
      data-testid={testId}
      data-kpi-status={status}
      className={`rounded-xl bg-white dark:bg-navy-900/50 p-4 transition-colors duration-150 group ${
        onClick
          ? 'cursor-pointer hover:bg-slate-50/60 dark:hover:bg-white/[0.03]'
          : 'cursor-default'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            <TrendIcon size={13} />
            {trendLabel && <span className="text-[11px] font-medium">{trendLabel}</span>}
          </div>
        )}
      </div>

      {/* Title + basis */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        <span
          data-testid={testId ? `${testId}-basis` : undefined}
          className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
        >
          {basisLabel}
        </span>
      </div>

      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
          {value}
        </span>
        {subValue && <span className="text-xs text-slate-500 dark:text-slate-400">{subValue}</span>}
      </div>

      {/* Details */}
      {details && details.length > 0 && (
        <div className="space-y-1 pt-2.5 border-t border-slate-200/50 dark:border-white/[0.04]">
          {details.map((detail, idx) =>
            // A hint-only row (no label) wraps full-width as guidance copy —
            // used by degraded/empty states to say *why* there is no number.
            detail.label ? (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    detail.highlight
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {detail.value}
                </span>
              </div>
            ) : (
              <p key={idx} className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {detail.value}
              </p>
            )
          )}
        </div>
      )}
    </motion.div>
  );
};

const RiskLevelBadge: React.FC<{ level: string }> = ({ level }) => {
  const { t } = useTranslation();
  const config = {
    low: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: t('executive.kpi.riskLow', 'Low'),
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: t('executive.kpi.riskMedium', 'Medium'),
    },
    high: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: t('executive.kpi.riskHigh', 'High'),
    },
    critical: {
      bg: 'bg-danger-100 dark:bg-danger-900/30',
      text: 'text-danger-700 dark:text-danger-300',
      label: t('executive.kpi.riskCritical', 'Critical'),
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
            ? 'bg-danger-500 animate-pulse'
            : level === 'high'
              ? 'bg-amber-500'
              : level === 'medium'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
        }`}
      />
      {cfg.label}
    </span>
  );
};

export const KPIGrid: React.FC<KPIGridProps> = ({ snapshot, loading = false, onNavigate }) => {
  const { t } = useTranslation();

  const mine = t('executive.kpi.basisOwner', 'Mine');
  const org = t('executive.kpi.basisOrg', 'Organization');
  const noData = t('executive.kpi.noData', 'No data');

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

  // No snapshot → four honest "—" cards. The grid keeps its four slots so the
  // layout does not silently lose a KPI (the Risk card used to vanish when its
  // source request failed, leaving three cards and an empty column).
  const tasks = snapshot?.owner.tasks ?? null;
  const decisions = snapshot?.owner.decisions ?? null;
  const risk = snapshot?.risk ?? null;

  const capacity = interpretCapacity(
    snapshot
      ? {
          avgCapacity: snapshot.team.avgUtilizationPct,
          overloaded: snapshot.team.overloaded,
          available: snapshot.team.available,
          memberCount: snapshot.team.memberCount,
        }
      : null
  );
  const capacityHint =
    capacity.hint === 'no-members'
      ? t('executive.kpi.capacityNoMembers', 'Assign team members to a project to track capacity')
      : capacity.hint === 'unbounded-estimates'
        ? t(
            'executive.kpi.capacityNeedsConfig',
            'Task estimates exceed a weekly budget — set up capacity planning to see real utilization'
          )
        : null;

  const windowDays = snapshot?.window.days ?? 7;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Task execution — WINDOW-scoped ratio. `Overdue` below it is the OPEN
          BACKLOG and is labelled as such, so the two can no longer be read as
          the same population. */}
      <KPICard
        testId="kpi-tasks"
        title={t('executive.kpi.tasks', 'Task Execution')}
        basisLabel={mine}
        icon={<CheckCircle2 size={16} className="text-emerald-500" />}
        iconBg="bg-emerald-500/10"
        value={tasks ? `${tasks.completionPct}%` : '—'}
        subValue={
          tasks
            ? t('executive.kpi.completedInWindow', '{{done}}/{{total}} · last {{days}} days', {
                done: tasks.windowCompleted,
                total: Math.max(tasks.windowCreated, tasks.windowCompleted),
                days: windowDays,
              })
            : noData
        }
        trend={tasks?.trend}
        status={
          !tasks
            ? 'neutral'
            : tasks.completionPct >= 75
              ? 'success'
              : tasks.completionPct >= 50
                ? 'warning'
                : 'danger'
        }
        details={
          tasks
            ? [
                {
                  label: t('executive.kpi.onTime', 'On-time'),
                  value: `${tasks.onTimePct}%`,
                },
                {
                  label: t('executive.kpi.overdueOfOpen', 'Overdue (of {{open}} open)', {
                    open: tasks.openTotal,
                  }),
                  value: tasks.overdue,
                  highlight: tasks.overdue > 0,
                },
              ]
            : []
        }
        onClick={onNavigate ? () => onNavigate('tasks', { filter: 'overdue' }) : undefined}
        delay={0}
      />

      {/* Decisions — a real COUNT(*), not the length of a paged list. */}
      <KPICard
        testId="kpi-decisions"
        title={t('executive.kpi.decisions', 'Decisions Pending')}
        basisLabel={mine}
        icon={<FileQuestion size={16} className="text-blue-500" />}
        iconBg="bg-blue-500/10"
        value={decisions ? decisions.pending : '—'}
        subValue={decisions ? t('executive.kpi.awaiting', 'awaiting') : noData}
        status={
          !decisions
            ? 'neutral'
            : decisions.critical > 0
              ? 'danger'
              : decisions.pending > 5
                ? 'warning'
                : 'success'
        }
        details={
          decisions
            ? [
                {
                  label: t('executive.kpi.critical', 'Critical'),
                  value: decisions.critical,
                  highlight: decisions.critical > 0,
                },
                {
                  label: t('executive.kpi.avgWait', 'Avg wait'),
                  value: `${decisions.avgWaitDays}d`,
                },
              ]
            : []
        }
        onClick={onNavigate ? () => onNavigate('decisions', { filter: 'pending' }) : undefined}
        delay={1}
      />

      {/* Team capacity — org-wide. `interpretCapacity` degrades an uncredible
          reading (lifetime backlog ÷ weekly budget) to "needs setup". */}
      <KPICard
        testId="kpi-capacity"
        title={t('executive.kpi.teamCapacity', 'Team Capacity')}
        basisLabel={org}
        icon={<Users size={16} className="text-blue-500" />}
        iconBg="bg-blue-500/10"
        value={capacity.displayValue}
        subValue={
          capacity.state === 'ok'
            ? t('executive.kpi.utilized', 'utilized')
            : capacity.state === 'needs-config'
              ? t('executive.kpi.needsSetup', 'Needs setup')
              : noData
        }
        status={
          capacity.state !== 'ok'
            ? 'neutral'
            : capacity.overloaded > 2
              ? 'danger'
              : (capacity.rawPercent ?? 0) > 90
                ? 'warning'
                : 'success'
        }
        details={
          capacity.state === 'ok'
            ? [
                {
                  label: t('executive.kpi.overloaded', 'Overloaded'),
                  value: capacity.overloaded,
                  highlight: capacity.overloaded > 0,
                },
                { label: t('executive.kpi.available', 'Available'), value: capacity.available },
              ]
            : capacityHint
              ? [{ label: '', value: capacityHint }]
              : []
        }
        // No My Work destination for a team roster — read-only, not a dead click.
        delay={2}
      />

      {/* Risk — `blockers` IS the owner overdue count and `escalations` IS the
          org escalated-decision count, both from this snapshot. The AI copy
          elsewhere on the page reads the same fields. */}
      <KPICard
        testId="kpi-risk"
        title={t('executive.kpi.riskLevel', 'Risk Level')}
        basisLabel={risk ? `${mine} · ${org}` : org}
        icon={
          <AlertTriangle
            size={16}
            className={
              !risk
                ? 'text-slate-600'
                : risk.level === 'critical'
                  ? 'text-danger-500'
                  : risk.level === 'high' || risk.level === 'medium'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
            }
          />
        }
        iconBg={
          !risk
            ? 'bg-slate-500/10'
            : risk.level === 'critical'
              ? 'bg-danger-500/10'
              : risk.level === 'high' || risk.level === 'medium'
                ? 'bg-amber-500/10'
                : 'bg-emerald-500/10'
        }
        value={risk ? <RiskLevelBadge level={risk.level} /> : '—'}
        subValue={risk ? undefined : noData}
        status={
          !risk
            ? 'neutral'
            : risk.level === 'critical'
              ? 'danger'
              : risk.level === 'high'
                ? 'warning'
                : 'neutral'
        }
        details={
          risk
            ? [
                {
                  label: t('executive.kpi.overdueTasksMine', 'Overdue tasks (mine)'),
                  value: risk.blockers,
                  highlight: risk.blockers > 2,
                },
                {
                  label: t('executive.kpi.escalationsOrg', 'Escalated decisions (org)'),
                  value: risk.escalations,
                  highlight: risk.escalations > 0,
                },
              ]
            : []
        }
        onClick={onNavigate ? () => onNavigate('tasks', { filter: 'overdue' }) : undefined}
        delay={3}
      />
    </div>
  );
};

export default KPIGrid;
