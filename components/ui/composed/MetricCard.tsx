/**
 * MetricCard Component - Apple HIG Design System
 * 
 * A dashboard metric card with value, trend, and sparkline support.
 * 
 * @example
 * <MetricCard
 *   title="Total Users"
 *   value={1234}
 *   change={12.5}
 *   trend="up"
 *   icon={<Users />}
 * />
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { Card } from '../primitives/Card';
import { Skeleton } from '../primitives/Skeleton';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface MetricCardProps {
  /** Metric title/label */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Change percentage */
  change?: number;
  /** Trend direction (overrides change-based calculation) */
  trend?: TrendDirection;
  /** Period description (e.g., "vs last month") */
  period?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Icon background color class */
  iconBg?: string;
  /** Sparkline data points */
  sparkline?: number[];
  /** Loading state */
  loading?: boolean;
  /** Additional className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// Format large numbers
const formatValue = (value: string | number): string => {
  if (typeof value === 'string') return value;
  
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; trend: TrendDirection }> = ({ data, trend }) => {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 32;
  const width = 80;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const trendColor = {
    up: 'stroke-success-500',
    down: 'stroke-danger-500',
    neutral: 'stroke-slate-400',
  }[trend];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        className={`${trendColor} opacity-60`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      title,
      value,
      change,
      trend: trendProp,
      period = 'vs last period',
      icon,
      iconBg = 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
      sparkline,
      loading = false,
      className = '',
      onClick,
    },
    ref
  ) => {
    // Determine trend from change if not explicitly provided
    const trend: TrendDirection = trendProp ?? (change ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : 'neutral');

    const trendStyles = {
      up: 'text-success-600 dark:text-success-400 bg-success-100 dark:bg-success-900/30',
      down: 'text-danger-600 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/30',
      neutral: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
    };

    const TrendIcon = {
      up: TrendingUp,
      down: TrendingDown,
      neutral: Minus,
    }[trend];

    if (loading) {
      return (
        <Card ref={ref} padding="lg" className={className}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Skeleton width="40%" height={14} className="mb-3" />
              <Skeleton width="60%" height={32} className="mb-2" />
              <Skeleton width="50%" height={14} />
            </div>
            <Skeleton variant="circular" size={44} />
          </div>
        </Card>
      );
    }

    return (
      <Card
        ref={ref}
        padding="lg"
        hoverable={!!onClick}
        onClick={onClick}
        className={className}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mb-1">
              {title}
            </p>

            {/* Value */}
            <motion.p
              className="text-2xl font-bold text-navy-900 dark:text-white truncate"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {formatValue(value)}
            </motion.p>

            {/* Trend indicator */}
            {change !== undefined && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendStyles[trend]}`}
                >
                  <TrendIcon size={12} />
                  {Math.abs(change).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {period}
                </span>
              </div>
            )}
          </div>

          {/* Right side: Icon or Sparkline */}
          <div className="flex-shrink-0">
            {sparkline && sparkline.length > 0 ? (
              <Sparkline data={sparkline} trend={trend} />
            ) : icon ? (
              <div className={`p-3 rounded-xl ${iconBg}`}>
                {React.isValidElement(icon)
                  ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })
                  : icon}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }
);

MetricCard.displayName = 'MetricCard';

export default MetricCard;





