/**
 * Metric Card Component
 * Displays a single KPI/metric with value, target, and trend
 */

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

import { RAGStatus } from '../../../../types';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  target?: string | number;
  status?: RAGStatus;
  trend?: 'IMPROVING' | 'STABLE' | 'DECLINING';
  variance?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusColors = {
  GREEN: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5',
  AMBER: 'text-amber-500 border-amber-500/20 bg-amber-500/5',
  RED: 'text-rose-500 border-rose-500/20 bg-rose-500/5',
  GREY: 'text-slate-400 dark:text-slate-500 border-slate-400/20 bg-slate-400/5',
};

const trendIcons = {
  IMPROVING: { icon: TrendingUp, color: 'text-emerald-500' },
  STABLE: { icon: Minus, color: 'text-slate-400 dark:text-slate-500' },
  DECLINING: { icon: TrendingDown, color: 'text-rose-500' },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  target,
  status = 'GREY',
  trend,
  variance,
  size = 'md',
  className = '',
}) => {
  const statusStyle = statusColors[status] || statusColors.GREY;
  const TrendIcon = trend ? trendIcons[trend]?.icon : null;
  const trendColor = trend ? trendIcons[trend]?.color : '';

  const sizeStyles = {
    sm: { container: 'p-3', value: 'text-2xl', label: 'text-xs' },
    md: { container: 'p-4', value: 'text-3xl', label: 'text-sm' },
    lg: { container: 'p-6', value: 'text-4xl', label: 'text-base' },
  };

  const styles = sizeStyles[size];

  return (
    <div className={`rounded-xl border ${statusStyle} ${styles.container} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium text-slate-500 dark:text-slate-400 ${styles.label}`}>
          {label}
        </span>
        {TrendIcon && <TrendIcon size={16} className={trendColor} />}
      </div>

      <div className="flex items-baseline gap-1">
        <span className={`font-bold ${styles.value} text-navy-900 dark:text-white`}>{value}</span>
        {unit && <span className="text-slate-400 dark:text-slate-500 text-sm">{unit}</span>}
      </div>

      {(target !== undefined || variance !== undefined) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {target !== undefined && (
            <span>
              Target: {target}
              {unit}
            </span>
          )}
          {variance !== undefined && (
            <span className={variance >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {variance >= 0 ? '+' : ''}
              {variance}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Metric Cards Grid
 */
interface MetricCardsGridProps {
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
    target?: string | number;
    status?: RAGStatus;
    trend?: 'IMPROVING' | 'STABLE' | 'DECLINING';
  }[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export const MetricCardsGrid: React.FC<MetricCardsGridProps> = ({
  metrics,
  columns = 4,
  className = '',
}) => {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

export default MetricCard;
