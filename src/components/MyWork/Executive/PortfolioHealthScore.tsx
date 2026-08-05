/**
 * PortfolioHealthScore - Executive-grade health score visualization
 * BCG/McKinsey style: Large, prominent, data-dense
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HealthBreakdown {
  execution: number; // Task completion rate
  decisions: number; // Decision velocity
  capacity: number; // Capacity balance / overload pressure
  risk: number; // Risk mitigation
}

interface PortfolioHealthProps {
  score?: number;
  previousScore?: number;
  breakdown?: HealthBreakdown;
  trend?: 'up' | 'down' | 'stable';
  loading?: boolean;
  compact?: boolean;
}

// Animated number counter
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({
  value,
  duration = 1000,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{displayValue}</span>;
};

// Score ring SVG component
const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 200 }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getScoreColor = (value: number) => {
    if (value >= 80) return '#10B981'; // Emerald
    if (value >= 60) return '#3B82F6'; // Blue
    if (value >= 40) return '#F59E0B'; // Amber
    return '#F43F5E'; // Rose
  };

  const getGlowColor = (value: number) => {
    if (value >= 80) return 'rgba(16, 185, 129, 0.4)';
    if (value >= 60) return 'rgba(59, 130, 246, 0.4)';
    if (value >= 40) return 'rgba(245, 158, 11, 0.4)';
    return 'rgba(244, 63, 94, 0.4)';
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-700 dark:text-slate-200 dark:text-white/10"
      />
      {/* Score ring with glow */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={getScoreColor(score)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        style={{
          filter: `drop-shadow(0 0 8px ${getGlowColor(score)})`,
        }}
      />
    </svg>
  );
};

// Breakdown bar component
const BreakdownBar: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-sm font-bold text-navy-900 dark:text-white tabular-nums">
            {value}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              value >= 80
                ? 'bg-emerald-500'
                : value >= 60
                  ? 'bg-blue-500'
                  : value >= 40
                    ? 'bg-amber-500'
                    : 'bg-danger-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export const PortfolioHealthScore: React.FC<PortfolioHealthProps> = ({
  score = 0,
  previousScore,
  breakdown,
  trend = 'stable',
  loading = false,
  compact = false,
}) => {
  const { t } = useTranslation();

  const hasData =
    typeof score === 'number' &&
    (score > 0 ||
      (previousScore !== undefined && previousScore > 0) ||
      (breakdown !== undefined &&
        (breakdown.execution > 0 ||
          breakdown.decisions > 0 ||
          breakdown.capacity > 0 ||
          breakdown.risk > 0)));

  const scoreDiff = previousScore !== undefined ? score - previousScore : 0;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-500'
      : trend === 'down'
        ? 'text-danger-500'
        : 'text-slate-500 dark:text-slate-400 dark:text-slate-500';

  const getScoreLabel = (value: number) => {
    if (value >= 80)
      return { label: t('executive.health.excellent', 'Excellent'), color: 'text-emerald-500' };
    if (value >= 60) return { label: t('executive.health.good', 'Good'), color: 'text-blue-500' };
    if (value >= 40)
      return { label: t('executive.health.attention', 'Needs Attention'), color: 'text-amber-500' };
    return { label: t('executive.health.critical', 'Critical'), color: 'text-danger-500' };
  };

  const scoreInfo = hasData
    ? getScoreLabel(score)
    : {
        label: t('executive.health.noData', 'No data'),
        color: 'text-slate-500 dark:text-slate-400',
      };

  // A1.1: Filter out breakdown items that have no real data (value === 0 means not populated)
  const hasBreakdownData =
    breakdown &&
    (breakdown.execution > 0 ||
      breakdown.decisions > 0 ||
      breakdown.capacity > 0 ||
      breakdown.risk > 0);

  if (loading) {
    return (
      <div
        data-testid="portfolio-health"
        className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 ${compact ? 'p-4' : 'p-6'} animate-pulse`}
      >
        <div className="flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-slate-200 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <motion.div
        data-testid="portfolio-health"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 flex items-center gap-4"
      >
        <div className="relative">
          <ScoreRing score={hasData ? score : 0} size={80} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-navy-900 dark:text-white tabular-nums">
              {hasData ? <AnimatedNumber value={score} /> : '—'}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
            {t('executive.health.portfolio', 'Portfolio Health')}
          </p>
          <p className={`text-sm font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</p>
          {hasData && scoreDiff !== 0 && (
            <div className={`flex items-center gap-1 mt-1 ${trendColor}`}>
              <TrendIcon size={12} />
              <span className="text-xs font-medium">
                {scoreDiff > 0 ? '+' : ''}
                {scoreDiff}%
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-testid="portfolio-health"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl bg-white dark:bg-navy-900/50"
    >
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity size={16} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('executive.health.title', 'Portfolio Health')}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('executive.health.subtitle', 'Overall execution performance')}
              </p>
            </div>
          </div>

          {hasData && scoreDiff !== 0 && (
            <div className="flex items-center gap-1.5">
              <TrendIcon size={13} className={trendColor} />
              <span className={`text-xs font-semibold ${trendColor}`}>
                {scoreDiff > 0 ? '+' : ''}
                {scoreDiff}%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('executive.health.vsLastWeek', 'vs last week')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Score Display */}
      <div className="p-6">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Score Ring – A1.1: data source: computed from /my-work/stats completion + on-time rates */}
          <div className="relative flex-shrink-0">
            <ScoreRing score={hasData ? score : 0} size={200} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {hasData ? (
                <>
                  <span className="text-5xl font-bold text-navy-900 dark:text-white tabular-nums">
                    <AnimatedNumber value={score} duration={1500} />
                  </span>
                  <span className={`text-sm font-semibold mt-1 ${scoreInfo.color}`}>
                    {scoreInfo.label}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-bold text-slate-700 dark:text-slate-400">—</span>
                  <span className="text-sm font-semibold mt-1 text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t('executive.health.noData', 'No data')}
                  </span>
                </>
              )}
            </div>

            {/* Score legend — makes the ring's color coding readable.
                Colors match ScoreRing thresholds; crimson (primary) is never
                used as a data color here. */}
            {hasData && (
              <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t('executive.health.legendHealthy', '80+')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {t('executive.health.legendGood', '60–79')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('executive.health.legendWatch', '40–59')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-danger-500" />
                  {t('executive.health.legendCritical', '<40')}
                </span>
              </div>
            )}
          </div>

          {/* Breakdown Grid – A1.1: only show bars that have real data (>0) */}
          {hasBreakdownData ? (
            <div className="flex-1 w-full space-y-4">
              {breakdown!.execution > 0 && (
                <BreakdownBar
                  label={t('executive.health.execution', 'Execution')}
                  value={breakdown!.execution}
                  icon={<Target size={16} className="text-slate-900 dark:text-white" />}
                  color="bg-emerald-500"
                />
              )}
              {breakdown!.decisions > 0 && (
                <BreakdownBar
                  label={t('executive.health.decisions', 'Decision Velocity')}
                  value={breakdown!.decisions}
                  icon={<Zap size={16} className="text-slate-900 dark:text-white" />}
                  color="bg-blue-500"
                />
              )}
              {breakdown!.capacity > 0 && (
                <BreakdownBar
                  label={t('executive.health.capacity', 'Team Capacity')}
                  value={breakdown!.capacity}
                  icon={<CheckCircle2 size={16} className="text-slate-900 dark:text-white" />}
                  // `bg-navy-900` is near-black, and the icon inside is
                  // `text-slate-900` — in LIGHT mode that rendered a black icon
                  // on a black tile (invisible). The tile is decorative here,
                  // so it takes a mid-weight neutral that reads in both themes.
                  color="bg-slate-400 dark:bg-slate-600"
                />
              )}
              {breakdown!.risk > 0 && (
                <BreakdownBar
                  label={t('executive.health.risk', 'Risk Mitigation')}
                  value={breakdown!.risk}
                  icon={<AlertTriangle size={16} className="text-slate-900 dark:text-white" />}
                  color="bg-amber-500"
                />
              )}
            </div>
          ) : (
            <div className="flex-1 w-full flex flex-col items-center justify-center py-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                {t('executive.health.noBreakdown', 'Breakdown data not yet available')}
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-400 mt-1">
                {t(
                  'executive.health.noBreakdownHint',
                  'Data will appear as tasks and decisions are tracked'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/*
        M02-008: this card used to stamp its OWN `new Date()` here, hard-coded
        to pl-PL, so the Manager surface showed two different clocks in two
        different formats ("Ostatnia aktualizacja: 22:54" beside "Updated:
        10:54 PM") for one and the same read. The snapshot's read time is now
        stated once, by `ManagerScopeBar`, and this footer is gone. Do not
        reintroduce a per-card timestamp — a second clock is a second claim.
      */}
    </motion.div>
  );
};

export default PortfolioHealthScore;
