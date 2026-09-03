/**
 * ProgressView - Personal analytics dashboard
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - Tasks completed stats
 * - On-time delivery rate
 * - Velocity trend with sparkline
 * - Average completion time
 * - Period selector
 */

import { motion } from 'framer-motion';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';

interface PersonalStats {
  completed: number;
  total: number;
  onTimeRate: number;
  avgDays: number;
  velocityHistory: number[];
  velocityChange: number;
  trend: 'up' | 'down' | 'stable';
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
  };
}

type Period = 'week' | 'month' | 'quarter';

/**
 * Simple Sparkline Component
 */
const Sparkline: React.FC<{ data: number[]; color?: string }> = ({
  data,
  color = 'text-primary-500',
}) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 120;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="4"
          fill="currentColor"
          className={color}
        />
      )}
    </svg>
  );
};

/**
 * Progress Bar Component
 */
const ProgressBar: React.FC<{ value: number; max?: number; color?: string }> = ({
  value,
  max = 100,
  color = 'bg-primary-500',
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  progress?: { value: number; max: number };
  sparkline?: number[];
  className?: string;
}> = ({ icon, label, value, subValue, trend, trendValue, progress, sparkline, className = '' }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-green-500'
      : trend === 'down'
        ? 'text-rose-500'
        : 'text-slate-600 dark:text-slate-500';

  return (
    <div className={`p-4 bg-slate-50 dark:bg-navy-800 rounded-xl ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-500 dark:text-slate-400">{icon}</span>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon size={14} />
            <span className="text-xs font-medium">{trendValue}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-navy-900 dark:text-white">{value}</span>
        {subValue && <span className="text-sm text-slate-600 dark:text-slate-500">{subValue}</span>}
      </div>
      {progress && (
        <div className="mt-3">
          <ProgressBar value={progress.value} max={progress.max} />
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3">
          <Sparkline data={sparkline} />
        </div>
      )}
    </div>
  );
};

/**
 * Period Selector Component
 */
const PeriodSelector: React.FC<{
  value: Period;
  onChange: (period: Period) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const periods: { id: Period; label: string }[] = [
    { id: 'week', label: t('progress.period.week', 'This Week') },
    { id: 'month', label: t('progress.period.month', 'This Month') },
    { id: 'quarter', label: t('progress.period.quarter', 'This Quarter') },
  ];

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
        className="appearance-none bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-navy-900 dark:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 pointer-events-none"
      />
    </div>
  );
};

/**
 * ProgressView Component - Main Export
 */
export const ProgressView: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<PersonalStats>({
    completed: 0,
    total: 0,
    onTimeRate: 0,
    avgDays: 0,
    velocityHistory: [],
    velocityChange: 0,
    trend: 'stable',
    byPriority: { high: 0, medium: 0, low: 0 },
    byStatus: { completed: 0, inProgress: 0, todo: 0, overdue: 0 },
  });

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await Api.get(`/my-work/stats?period=${period}`);
      if (response) {
        setStats({
          completed: response.completed || 0,
          total: response.total || 0,
          onTimeRate: response.onTimeRate || 0,
          avgDays: response.avgDays || 0,
          velocityHistory: response.velocityHistory || [3, 5, 4, 7, 6, 8, 7],
          velocityChange: response.velocityChange || 0,
          trend: response.trend || 'stable',
          byPriority: response.byPriority || { high: 0, medium: 0, low: 0 },
          byStatus: response.byStatus || { completed: 0, inProgress: 0, todo: 0, overdue: 0 },
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({
        completed: 0,
        total: 0,
        onTimeRate: 0,
        avgDays: 0,
        velocityHistory: [],
        velocityChange: 0,
        trend: 'stable',
        byPriority: { high: 0, medium: 0, low: 0 },
        byStatus: { completed: 0, inProgress: 0, todo: 0, overdue: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-8">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900 dark:text-white">
                {t('progress.title', 'Your Progress')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('progress.subtitle', 'Personal analytics and metrics')}
              </p>
            </div>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Tasks Completed */}
          <StatCard
            icon={<CheckCircle2 size={18} />}
            label={t('progress.tasksCompleted', 'Tasks Completed')}
            value={stats.completed}
            subValue={`/ ${stats.total}`}
            progress={{ value: stats.completed, max: stats.total }}
          />

          {/* On-Time Rate */}
          <StatCard
            icon={<Target size={18} />}
            label={t('progress.onTimeRate', 'On-Time Rate')}
            value={`${stats.onTimeRate}%`}
            trend={stats.onTimeRate >= 80 ? 'up' : stats.onTimeRate >= 60 ? 'stable' : 'down'}
            trendValue={
              stats.onTimeRate >= 80
                ? 'Excellent'
                : stats.onTimeRate >= 60
                  ? 'Good'
                  : 'Needs improvement'
            }
          />

          {/* Velocity Trend */}
          <StatCard
            icon={<TrendingUp size={18} />}
            label={t('progress.velocity', 'Velocity')}
            value={stats.velocityHistory[stats.velocityHistory.length - 1] || 0}
            subValue={t('progress.tasksPerWeek', 'tasks/week')}
            trend={stats.trend}
            trendValue={`${stats.velocityChange > 0 ? '+' : ''}${stats.velocityChange}%`}
            sparkline={stats.velocityHistory}
          />

          {/* Avg Completion Time */}
          <StatCard
            icon={<Clock size={18} />}
            label={t('progress.avgCompletion', 'Avg Completion')}
            value={stats.avgDays.toFixed(1)}
            subValue={t('progress.days', 'days')}
            trend={stats.avgDays <= 3 ? 'up' : stats.avgDays <= 5 ? 'stable' : 'down'}
            trendValue={stats.avgDays <= 3 ? 'Fast' : stats.avgDays <= 5 ? 'Normal' : 'Slow'}
          />
        </div>

        {/* Priority Distribution */}
        <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
            {t('progress.byPriority', 'Tasks by Priority')}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 w-16">
                {t('progress.high', 'High')}
              </span>
              <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{
                    width: `${stats.total > 0 ? (stats.byPriority.high / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-navy-900 dark:text-white w-8 text-right">
                {stats.byPriority.high}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 w-16">
                {t('progress.medium', 'Medium')}
              </span>
              <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${stats.total > 0 ? (stats.byPriority.medium / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-navy-900 dark:text-white w-8 text-right">
                {stats.byPriority.medium}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 w-16">
                {t('progress.low', 'Low')}
              </span>
              <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${stats.total > 0 ? (stats.byPriority.low / stats.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-sm font-medium text-navy-900 dark:text-white w-8 text-right">
                {stats.byPriority.low}
              </span>
            </div>
          </div>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              {stats.byStatus.completed}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {t('progress.status.completed', 'Completed')}
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {stats.byStatus.inProgress}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {t('progress.status.inProgress', 'In Progress')}
            </p>
          </div>
          <div className="text-center p-3 bg-slate-100 dark:bg-white/5 rounded-lg">
            <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
              {stats.byStatus.todo}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('progress.status.todo', 'To Do')}
            </p>
          </div>
          <div className="text-center p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
              {stats.byStatus.overdue}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {t('progress.status.overdue', 'Overdue')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressView;
