/**
 * MetricCard - Minimalist metric display card
 * 
 * Design: Clean, monochrome with subtle accent
 * Usage: Dashboard stats, KPIs, summary numbers
 * 
 * Key principles:
 * - No colorful icon backgrounds
 * - Label above value (better scanning)
 * - Tabular nums for number alignment
 * - Optional trend indicator (only semantic color)
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
    label: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        label?: string;
        direction?: 'up' | 'down' | 'neutral';
    };
    className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    subtitle,
    icon: Icon,
    trend,
    className = ''
}) => {
    const getTrendConfig = () => {
        if (!trend) return null;
        
        const direction = trend.direction ?? (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral');
        
        const configs = {
            up: { icon: TrendingUp, color: 'text-emerald-400', prefix: '+' },
            down: { icon: TrendingDown, color: 'text-red-400', prefix: '' },
            neutral: { icon: Minus, color: 'text-slate-500', prefix: '' },
        };
        
        return configs[direction];
    };

    const trendConfig = getTrendConfig();

    return (
        <div className={`space-y-1 ${className}`}>
            {/* Label row with optional icon */}
            <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className="text-slate-500" />}
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {label}
                </span>
            </div>
            
            {/* Value */}
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-50 tabular-nums leading-tight">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
            </div>
            
            {/* Subtitle or Trend */}
            {(subtitle || trend) && (
                <div className="flex items-center gap-2">
                    {trend && trendConfig && (
                        <span className={`flex items-center gap-1 text-xs ${trendConfig.color}`}>
                            <trendConfig.icon size={12} />
                            <span>
                                {trendConfig.prefix}{Math.abs(trend.value)}%
                                {trend.label && <span className="text-slate-500 ml-1">{trend.label}</span>}
                            </span>
                        </span>
                    )}
                    {subtitle && !trend && (
                        <span className="text-xs text-slate-500">{subtitle}</span>
                    )}
                </div>
            )}
        </div>
    );
};

// Compact variant for dense layouts
export const MetricCardCompact: React.FC<MetricCardProps> = ({
    label,
    value,
    subtitle,
    icon: Icon,
    className = ''
}) => {
    return (
        <div className={`bg-slate-800/50 border border-white/[0.06] rounded-lg p-3 ${className}`}>
            <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon size={12} className="text-slate-500" />}
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    {label}
                </span>
            </div>
            <p className="text-xl font-semibold text-white tabular-nums">{value}</p>
            {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
    );
};

// Grid variant with card wrapper
interface MetricCardWithCardProps extends MetricCardProps {
    variant?: 'default' | 'bordered';
}

export const MetricCardWithCard: React.FC<MetricCardWithCardProps> = ({
    variant = 'default',
    ...props
}) => {
    const wrapperClass = variant === 'bordered' 
        ? 'border border-white/[0.06] rounded-xl p-4'
        : 'bg-slate-800/50 rounded-xl p-4';
    
    return (
        <div className={wrapperClass}>
            <MetricCard {...props} />
        </div>
    );
};

export default MetricCard;
