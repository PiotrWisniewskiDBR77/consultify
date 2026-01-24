/**
 * TrendIndicator Component
 *
 * Displays trend direction and change percentage for metrics.
 * Used in MetricCards and period comparison displays.
 *
 * PMO Standards: PMBOK 7 Measurement Performance Domain
 */

import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';

type TrendDirection = 'UP' | 'DOWN' | 'STABLE';

interface TrendIndicatorProps {
  trend: TrendDirection;
  changePercent?: number;
  changeValue?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  invertColors?: boolean; // For metrics where DOWN is good (e.g., blockers)
  className?: string;
}

// Trend configuration
const getTrendConfig = (trend: TrendDirection, invertColors: boolean) => {
  const configs = {
    UP: {
      icon: TrendingUp,
      arrowIcon: ArrowUp,
      color: invertColors ? 'text-red-500' : 'text-emerald-500',
      bgColor: invertColors ? 'bg-red-500/10' : 'bg-emerald-500/10',
      label: invertColors ? 'Increased' : 'Improved',
    },
    DOWN: {
      icon: TrendingDown,
      arrowIcon: ArrowDown,
      color: invertColors ? 'text-emerald-500' : 'text-red-500',
      bgColor: invertColors ? 'bg-emerald-500/10' : 'bg-red-500/10',
      label: invertColors ? 'Decreased' : 'Declined',
    },
    STABLE: {
      icon: Minus,
      arrowIcon: Minus,
      color: 'text-slate-400 dark:text-slate-500',
      bgColor: 'bg-slate-400/10',
      label: 'No change',
    },
  };
  return configs[trend];
};

// Size configurations
const sizeConfigs = {
  sm: {
    icon: 12,
    text: 'text-xs',
    padding: 'px-1.5 py-0.5',
    gap: 'gap-0.5',
  },
  md: {
    icon: 14,
    text: 'text-sm',
    padding: 'px-2 py-1',
    gap: 'gap-1',
  },
  lg: {
    icon: 18,
    text: 'text-base',
    padding: 'px-3 py-1.5',
    gap: 'gap-1.5',
  },
};

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  trend,
  changePercent,
  changeValue,
  unit = '',
  size = 'md',
  showLabel = false,
  invertColors = false,
  className = '',
}) => {
  const config = getTrendConfig(trend, invertColors);
  const sizeConfig = sizeConfigs[size];
  const ArrowIcon = config.arrowIcon;

  const hasChange = changePercent !== undefined || changeValue !== undefined;
  const displayValue =
    changePercent !== undefined
      ? `${changePercent > 0 ? '+' : ''}${changePercent}%`
      : changeValue !== undefined
        ? `${changeValue > 0 ? '+' : ''}${changeValue}${unit}`
        : null;

  return (
    <span
      className={`
                inline-flex items-center ${sizeConfig.gap} ${sizeConfig.padding}
                rounded-full font-medium ${sizeConfig.text}
                ${config.color} ${config.bgColor}
                ${className}
            `}
    >
      <ArrowIcon size={sizeConfig.icon} />
      {hasChange && displayValue && <span>{displayValue}</span>}
      {showLabel && <span className="hidden sm:inline">{config.label}</span>}
    </span>
  );
};

/**
 * Compact trend arrow for inline use
 */
export const TrendArrow: React.FC<{
  trend: TrendDirection;
  invertColors?: boolean;
  size?: number;
  className?: string;
}> = ({ trend, invertColors = false, size = 14, className = '' }) => {
  const config = getTrendConfig(trend, invertColors);
  const Icon = config.arrowIcon;

  return <Icon size={size} className={`${config.color} ${className}`} />;
};

/**
 * Trend with sparkline-style mini chart
 */
export const TrendWithSparkline: React.FC<{
  trend: TrendDirection;
  changePercent: number;
  sparklineData?: number[];
  invertColors?: boolean;
  className?: string;
}> = ({ trend, changePercent, sparklineData = [], invertColors = false, className = '' }) => {
  const config = getTrendConfig(trend, invertColors);

  // Generate simple SVG sparkline
  const maxVal = Math.max(...sparklineData, 1);
  const minVal = Math.min(...sparklineData, 0);
  const range = maxVal - minVal || 1;
  const width = 60;
  const height = 20;

  const points = sparklineData
    .map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width;
      const y = height - ((val - minVal) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {sparklineData.length > 1 && (
        <svg width={width} height={height} className="opacity-60">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={config.color}
          />
        </svg>
      )}
      <TrendIndicator
        trend={trend}
        changePercent={changePercent}
        invertColors={invertColors}
        size="sm"
      />
    </div>
  );
};

/**
 * Period comparison display
 */
export const PeriodComparison: React.FC<{
  current: number;
  previous: number;
  label: string;
  unit?: string;
  invertColors?: boolean;
  className?: string;
}> = ({ current, previous, label, unit = '', invertColors = false, className = '' }) => {
  const change = current - previous;
  const changePercent = previous !== 0 ? Math.round((change / previous) * 100) : 0;
  const trend: TrendDirection = change > 0 ? 'UP' : change < 0 ? 'DOWN' : 'STABLE';
  const config = getTrendConfig(trend, invertColors);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-navy-900 dark:text-white">
          {current}
          {unit}
        </span>
        <span className={`text-sm ${config.color}`}>
          vs {previous}
          {unit}
        </span>
      </div>
      <TrendIndicator
        trend={trend}
        changeValue={change}
        unit={unit}
        invertColors={invertColors}
        size="sm"
      />
    </div>
  );
};

export default TrendIndicator;
