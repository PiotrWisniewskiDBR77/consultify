/**
 * TeamPerformancePreview - Quick team status overview
 * BCG/McKinsey style: Heatmap, data-dense, actionable
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  capacity: number;
  tasksCompleted: number;
  tasksTotal: number;
  trend: 'up' | 'down' | 'stable';
}

interface TeamPerformancePreviewProps {
  members?: TeamMember[];
  avgCapacity?: number;
  avgVelocity?: number;
  velocityTrend?: 'up' | 'down' | 'stable';
  loading?: boolean;
  onViewAll?: () => void;
  onMemberClick?: (id: string) => void;
}

// Capacity indicator with color
const CapacityIndicator: React.FC<{ capacity: number }> = ({ capacity }) => {
  const getColor = () => {
    if (capacity > 100) return 'bg-danger-500';
    if (capacity > 85) return 'bg-amber-500';
    if (capacity > 60) return 'bg-emerald-500';
    return 'bg-blue-500';
  };

  const getTextColor = () => {
    if (capacity > 100) return 'text-danger-600 dark:text-danger-400';
    if (capacity > 85) return 'text-amber-600 dark:text-amber-400';
    return 'text-navy-900 dark:text-white';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(capacity, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${getColor()}`}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-10 text-right ${getTextColor()}`}>
        {capacity}%
      </span>
    </div>
  );
};

// Team member row
const TeamMemberRow: React.FC<{
  member: TeamMember;
  onClick?: () => void;
}> = ({ member, onClick }) => {
  const { t } = useTranslation();
  const isOverloaded = member.capacity > 100;
  const TrendIcon =
    member.trend === 'up' ? TrendingUp : member.trend === 'down' ? TrendingDown : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-150 ${
        onClick ? 'cursor-pointer hover:bg-slate-50/60 dark:hover:bg-white/[0.03]' : ''
      }`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-white/10">
        {member.initials}
      </div>

      {/* Name & Progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
            {member.name}
          </span>
          {isOverloaded && <AlertTriangle size={12} className="text-danger-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {member.tasksCompleted}/{member.tasksTotal} {t('executive.team.tasks', 'tasks')}
          </span>
          {TrendIcon && (
            <TrendIcon
              size={10}
              className={member.trend === 'up' ? 'text-emerald-500' : 'text-danger-500'}
            />
          )}
        </div>
      </div>

      {/* Capacity */}
      <CapacityIndicator capacity={member.capacity} />
    </motion.div>
  );
};

export const TeamPerformancePreview: React.FC<TeamPerformancePreviewProps> = ({
  members = [],
  avgCapacity = 0,
  avgVelocity = 0,
  velocityTrend = 'stable',
  loading = false,
  onViewAll,
  onMemberClick,
}) => {
  const { t } = useTranslation();

  // Real data only - no mock fallbacks
  const displayMembers: TeamMember[] = members;

  const calculatedAvgCapacity =
    avgCapacity ||
    (displayMembers.length > 0
      ? Math.round(displayMembers.reduce((sum, m) => sum + m.capacity, 0) / displayMembers.length)
      : 0);
  const overloadedCount = displayMembers.filter((m) => m.capacity > 100).length;
  const availableCount = displayMembers.filter((m) => m.capacity < 50).length;

  const VelocityTrendIcon =
    velocityTrend === 'up' ? TrendingUp : velocityTrend === 'down' ? TrendingDown : null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="h-6 w-40 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded mb-1" />
                <div className="h-3 w-16 bg-slate-100 dark:bg-white/5 rounded" />
              </div>
              <div className="w-20 h-2 bg-slate-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl bg-white dark:bg-navy-900/50 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Users size={16} className="text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('executive.team.title', 'Team Performance')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {displayMembers.length} {t('executive.team.members', 'members')}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-5 pb-3 shrink-0">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              {t('executive.team.avgCapacity', 'Avg Capacity')}
            </p>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {calculatedAvgCapacity}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              {t('executive.team.overloaded', 'Overloaded')}
            </p>
            <p
              className={`text-base font-semibold tabular-nums ${overloadedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}`}
            >
              {overloadedCount}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              {t('executive.team.available', 'Available')}
            </p>
            <p
              className={`text-base font-semibold tabular-nums ${availableCount > 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}
            >
              {availableCount}
            </p>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="flex-1 overflow-y-auto p-3">
        {displayMembers.length > 0 ? (
          <div className="space-y-1">
            {displayMembers.slice(0, 6).map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                {/* No handler → no click affordance (M02-011: no dead actions). */}
                <TeamMemberRow
                  member={member}
                  onClick={onMemberClick ? () => onMemberClick(member.id) : undefined}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users size={32} className="text-slate-600 dark:text-slate-400 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('executive.team.noMembers', 'No team members found')}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {onViewAll && (
        <div className="px-5 py-3 shrink-0">
          <button
            onClick={onViewAll}
            className="w-full text-center text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 flex items-center justify-center gap-1 transition-colors duration-150"
          >
            {t('executive.team.viewAll', 'View full team report')}
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default TeamPerformancePreview;
